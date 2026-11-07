# Security and private data

Evimiz is in active development and has yet to undergo an independent security audit. The initial `admin/admin` login is restricted to local setup. Device pages and APIs require a password change.

- Git ignores `data/`. It contains password hashes, session records, device keys, IP and MAC addresses, location, maps, observations, Web Push subscriptions, and VAPID keys.
- Keep dependencies, Python environments, logs, private `.env` files, and certificates out of releases.
- Review screenshots separately for location, account, and network details. The source scan covers text and known secret patterns.
- Manage access to the server and its backups. Encrypt backups separately when needed.
- Account setup routes require a local admin. The HTTPS gateway preserves dashboard authentication.
- LG and Samsung MAC matching depends on trust in the local network. Keep protocol and private-address checks enabled.
- Apply manufacturer security updates. Firmware, account, and service changes can affect integrations.

Use GitHub's private vulnerability reporting channel if enabled. Otherwise request a private conversation in a public issue and share details privately. Keep working exploits, keys, and household data out of public issues. A dedicated security email address has yet to be verified.
