#!/usr/bin/env bash
set -euo pipefail
umask 077

cd "$HOME/ev-paneli"
exec 9>"$HOME/.evimiz-update.lock"
flock -n 9 || exit 0

[[ -z $(git status --porcelain) ]] || {
    echo 'Update skipped because the checkout has local changes.' >&2
    exit 1
}

old_commit=$(git rev-parse HEAD)
release_repo=https://github.com/onronal/evimiz.git
git fetch --no-tags "$release_repo" \
    refs/heads/main:refs/remotes/evimiz-release/main \
    'refs/tags/v*:refs/tags/evimiz-release/v*'

release=$(git for-each-ref --sort=-version:refname --format='%(refname)' refs/tags/evimiz-release |
    awk '/^refs\/tags\/evimiz-release\/v[0-9]+\.[0-9]+\.[0-9]+$/ && !found { print; found=1 }')
[[ -n "$release" ]] || exit 0
new_commit=$(git rev-parse "$release^{commit}")
[[ "$old_commit" != "$new_commit" ]] || exit 0
git merge-base --is-ancestor "$new_commit" refs/remotes/evimiz-release/main
git merge-base --is-ancestor "$old_commit" "$new_commit"

stage=$(mktemp -d "$HOME/.evimiz-update.XXXXXX")
gateway=false
systemctl --user is-active --quiet ev-paneli-public.service && gateway=true
switching=false
dependencies_moved=false

start_services() {
    systemctl --user start ev-paneli.service
    if "$gateway"; then
        systemctl --user start ev-paneli-public.service
    fi
}

cleanup() {
    local result=$?
    if (( result != 0 )) && "$switching"; then
        echo 'Update failed. Restoring the previous release.' >&2
        if ! restore_release; then
            echo "Rollback failed. Recovery files are in $stage." >&2
            return
        fi
    fi
    rm -rf -- "$stage"
}

restore_release() {
    systemctl --user stop ev-paneli-public.service ev-paneli.service &&
    git switch --detach "$old_commit" || return 1
    if "$dependencies_moved"; then
        rm -rf -- node_modules &&
        mv "$stage/previous-modules" node_modules || return 1
    fi
    start_services
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

git archive "$new_commit" > "$stage/release.tar"
tar -xf "$stage/release.tar" -C "$stage"
(
    cd "$stage"
    npm ci --ignore-scripts
    npm test
    npm run test:integration
)

switching=true
systemctl --user stop ev-paneli-public.service ev-paneli.service
git switch --detach "$new_commit"
mv node_modules "$stage/previous-modules"
dependencies_moved=true
mv "$stage/node_modules" node_modules
start_services

port=4173
if "$gateway"; then
    port=4174
fi
curl --fail --silent --show-error --retry 8 --retry-connrefused \
    --retry-delay 1 --max-time 3 "http://127.0.0.1:$port/login" >/dev/null
echo "Installed ${release##*/} ($new_commit)."
