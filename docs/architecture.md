# Architecture

See the [README](../README.en.md) for setup and the [device adapter contract](device-integration.md) for new integrations.

## Web application and authentication

`server.mjs` serves HTML pages and the JSON API. `auth.mjs` handles users, scrypt password hashes, sessions, the initial password change, and roles. `static/session.js` checks the session at startup and attaches CSRF tokens to write requests. The server enforces access.

The initial `admin/admin` login is restricted to loopback. Protected pages and APIs require a password change. User and role changes invalidate sessions. Ordinary sessions live in memory. The Remember me option stores a hashed session identifier in private `data/sessions.json` for 30 days. Runtime data stays under `data/`.

## Device instances

- `devices.mjs` defines the catalog, capabilities, and registry validation.
- `device-engine.mjs` registers adapters, validates private connections, and routes reads and commands.
- `settings.devices` holds device metadata with UUID-based IDs for new instances.
- `settings.layout` stores room assignments and display order.
- `data/device-connections/<id>.json` stores each instance's private connection settings.
- `legacy` records preserve the six original fixed connections. New devices use their own credentials.

Adapters validate model-specific settings, private IPv4 addresses, keys, and device IDs as appropriate. Vestel and the Xiaomi air fryer are read-only.

## Activity, history, and room commands

`activity.mjs` derives events from state transitions. Legacy events use a type ID. New events store the instance ID and `deviceType`. `model.mjs` calculates reminders from the last observed start for each instance. Observation time can differ from the physical event time. Short activities can finish between reads.

`rooms.mjs` validates vacuum commands against the selected instance's map ID and room IDs. An admin can change room labels in the panel. New devices use `data/device-maps/<id>.json`. The original Xiaomi map belongs to the legacy connection.

`history.mjs` returns display-safe cleaning records in pages of 20. `/api/state?summary=1` returns summary data without downloading the full history. The admin UI registers extra settings editors under each device's own section.

## Overview and environmental data

`overview.js` loads the indoor and outdoor readings, daylight, and connection summary. `/api/temperature` reads the device selected in `settings.indoorTemperatureSource`. The UI hides indoor temperature when no source is configured. Adapters advertise the `temperature` capability to participate.

`external-data.mjs` shares in-flight requests, persists the last successful result, and backs off on failure. Its read method serves stored results. The server checks due work at startup, after settings writes, and every 30 seconds. Weather refreshes every 10 minutes, MGM every 15 minutes, and daylight once per local day. The independent AFAD job runs every two minutes. New results emit an `environment` event. Results from an old location or permission setting cannot overwrite the current data. After old work finishes, the new location can refresh immediately. Manual location searches follow a separate request path. The overview and internet pages share `internet-graph.js`.

## Automations and vacation mode

`automations.mjs` defines the rule schema and evaluation. The server evaluates enabled rules every 30 seconds and saves the trigger key before attempting a command. Missing or stale measurements prevent execution. Members can read rules. Admins manage them.

`vacation.mjs` interprets observed active and inactive states. Vacation mode suspends automations and cleaning reminders. The server continues to observe supported non-cleaning devices. The first active observation is recorded separately from a later observed start.

## Shared device state and live screens

`device-status.mjs` provides a cache, one in-flight read per device instance, and error backoff. HTTP clients and background jobs use `deviceStatus()`. A connection update or command invalidates the relevant cache. Pointer movement leaves the status cache available. A stale read cannot replace a newer TV notification or be returned in place of it. After command invalidation, clients share a fresh read.

The server checks enabled devices every 15 seconds. Normal reads share a 30-second cache. Vestel screens can read the local snapshot more often while cloud polling stays at 60 seconds. Xiaomi activity jobs also use shared reads. An additional browser tab shares existing device work.

`device-events.mjs` uses authenticated SSE at `/api/device-events` to send device IDs. Clients fetch authorized status from the shared cache. Sessions are revalidated for each event and every 15-second heartbeat. Limits are six streams per user and 64 overall. Slow streams are closed, and the gateway propagates disconnects to the application.

`static/device-live.js` shares one EventSource per visible page. It disconnects when hidden and reconnects on return. If SSE is unavailable, it falls back to 30-second polling. LG subscribes to power and sound once per connection, with shared polling as fallback. Other adapters generally use periodic reads.

## Remote access and Web Push

`public-proxy.mjs` listens on loopback port 4174. Point Funnel at the gateway. The gateway blocks private setup routes, checks the public POST origin, and pins the upstream Host header to the configured HTTPS hostname. The server and gateway read the origin from private `data/public-access.json`. Each installation configures its own Tailscale account, HTTPS hostname, and Funnel access.

`push.mjs` manages subscriptions, persistent VAPID keys, and the background delivery queue. Background Web Push and browser SSE run independently. See [remote access](remote-access.md) and [notifications](notifications.md) for setup in Turkish.

## Camera video and control

`camera.mjs` validates the C200 RTSP input. The admin-only video route starts FFmpeg on demand. Viewers share one process per camera, and the last disconnect stops it. The first JPEG confirms video availability. Frame sizes are bounded. The server drops frames while waiting for a slow client to drain and closes the client if that wait exceeds about 15 seconds. Camera credentials, RTSP URLs, and FFmpeg diagnostics stay on the server. Video frames stay in memory.

`camera-ptz.mjs` sends admin-only ONVIF direction commands to the same camera. The analog control sends short moves sequentially. The server handles motion and the stop request. The LG TV and camera cards share the full-screen layout. See the [Tapo guide](integrations/tapo.md) for the tested device and setup.

## Shutdown and verification

`shutdown.mjs` handles SIGTERM and SIGINT once. It stops accepting new HTTP connections and scheduling work, releases SSE and camera streams, closes LG connections, and waits for queued writes. A camera child process that remains alive after SIGTERM is sent SIGKILL after one second. Shutdown waits for retiring children too. The overall deadline is five seconds. Failure or timeout returns a nonzero exit code.

Run `npm run check` for unit tests, clean-install HTTP tests, and documentation links. Run `npm run check:public` to scan tracked files for private runtime paths and known secret patterns. See [Contributing](contributing.md) and [Security](security.md).
