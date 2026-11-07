# Contributing and local development

Read the [README](../README.en.md), [architecture](architecture.md), and [device adapter contract](device-integration.md) before working on an integration. Coding agents also follow [AGENTS.md](../AGENTS.md).

## Workflow

1. Run `npm ci` with Node.js 22.12 or later.
2. Set up a clean local `data/` directory with your own credentials.
3. Keep device types and device instances separate.
4. Run `npm run check` and, after staging, `npm run check:public`.
5. Document which model, firmware, and actions were verified. Distinguish fixture tests from physical verification.

## Tests

- `tests/unit.test.mjs` covers rules, boundaries, and synthetic protocol clients.
- `tests/http.test.mjs` covers API permissions, CSRF, and gateway streams using a temporary clean setup.
- Get explicit permission before testing a command on physical hardware. Test status reads separately.
- Use synthetic identities and fixtures for history, maps, tokens, and network lists.

## Pull requests

Describe the problem, the new behavior, affected models, and how you verified the change. Cite primary protocol sources for new device support and update the docs. Keep account credentials, service keys, and `data/` files out of the PR.

Contribute code compatible with the project's MIT license. Preserve upstream attribution and license terms. Manufacturer service terms apply independently.
