# Device adapter contract

Use this guide to add a model or protocol while preserving existing device identities, permissions, and private data.

## 1. Define the support boundary

Identify the brand, product category, model, firmware, transport, authentication, status fields, and commands. Verify the protocol against primary documentation or primary source code with a compatible license. Build model-specific mappings when data points or MIoT fields differ. Distinguish devices on the same account by physical identity.

## 2. Model identity and connection settings

- `type` is the product class, such as `light` or `climate`.
- `id` is a server-generated `device-<uuid>` for the instance.
- `adapter` selects an explicitly registered protocol implementation.
- `legacy: true` identifies the six original fixed connections. New records use per-instance connections.
- `data/state.json` stores device names, models, and room assignments.
- `data/device-connections/<id>.json` stores server-only credentials. API responses expose safe metadata.
- Room IDs and maps describe layout. Use the session and role checks for access control.

Validate new fields with allowlists and enforce key, token, model, and port bounds. The current local transport accepts private IPv4 addresses. Keep arbitrary URLs, file paths, Python modules, shell commands, and JavaScript expressions out of executable configuration. New addressing schemes such as IPv6 or mDNS need their own validation and tests.

## 3. Register the adapter and UI

1. In `devices.mjs`, add catalog `id`, `label`, `brand`, `adapter`, `instructions`, and `capabilities`. Advertise `temperature` for measured temperature. Declare supported `notificationKinds` such as `started` and `completed`, and set `reminderSupported` when appropriate. Extend `model.mjs` for supported reminders.
2. In `device-engine.mjs`, register `status(device, config)` and, where supported, `command(device, config, input)` in `adapters`. Put complex protocol logic in its own module.
3. Extend `validateConnection()`. Keep raw credentials out of responses and errors.
4. Extend history or reminder handling explicitly if applicable. `layout.mjs` validates room assignments against device IDs.
5. Extend the connection form in `static/admin.js`. Clear credential fields after saving. Keep saved credentials server-side.
6. In `static/device-list.js`, expose supported capabilities. Validate temperature and mode bounds and show rejected commands as failures.

A status response uses fields supported by the device. User-facing status text follows the app language.

```js
{
  connected: true,
  at: new Date().toISOString(),
  kind: device.type,
  state: 'Çalışıyor',
  running: true,
  completed: false,
  remainingMinutes: 45,
  temperature: null,
  unit: 'C'
}
```
Use `null` or omit unavailable fields. `temperature` means measured temperature. `at` records the read time when the device supplies no event timestamp. `configured` indicates that connection settings exist.

Command results should include `accepted`, `confirmed` when possible, and a readable `message`. Use a status read to verify the outcome. Vestel and air fryer adapters are read-only.

## 4. API permissions and CSRF

| Endpoint | Access |
|---|---|
| `GET /api/devices` | Signed-in users can read safe catalog and device metadata. |
| `POST /api/devices`, `/api/devices/update` | Admins manage device records and visibility. |
| `POST /api/devices/:id/connection` | Admins manage private connection settings. |
| `GET /api/devices/:id/status` | Signed-in users read device status. Camera status requires an admin. |
| `POST /api/devices/:id/commands` | Admins and members can send adapter-validated commands. Camera direction uses a separate admin route. |

Room settings, data sources, map labels, users, and integration setup require an admin. Keep new endpoints behind the session, role, origin, and CSRF checks in `server.mjs`. `static/session.js` adds CSRF tokens to browser writes. Keep `data/` outside static serving.

## 5. Activity and vacuum rooms

`activity.mjs` tracks start and completion transitions and deduplicates events. For new instances, track by `device.id`. Store that ID in the event's `device` field and the product class in `deviceType`. A first observation of a completed state does not establish a past finish. A pause and resume belong to the same run. Short activities can finish between reads. See [polling intervals](data-updates.md).

The vacuum adapter uses an increase in its cleaning counter to verify completion. `rooms.mjs` validates each room command against the instance's map ID and room list. Map retrieval for new instances is separate. The default shared map belongs to the legacy connection. Keep real maps out of tests and screenshots.

## 6. Shared status and extra settings

Use `deviceStatus(device)` in `device-engine.mjs` and its shared cache. The browser subscribes through `watchDevice(id, callback)` and reads authorized status after a notification. Publish native Push updates only from a verified device session. Keep credentials and addresses out of SSE events. Invalidate the cache after commands and avoid automatically repeating physical actions.

Register per-device settings editors through `extraSettingsEditors` in `static/admin.js`. Admins write settings. When adding a cleaning device, update the cleaning classification in `vacation.mjs` and history handling. Derive activity from verified observations and retain unknown states.

The LG adapter in `lg.mjs` provides a reference for local discovery, per-device pairing, reads, and allowlisted commands. Keep `lg-setup` and `/api/lg/*` blocked by the public gateway. Pairing starts through explicit setup. Wake-on-LAN delivery and confirmed power-on are separate outcomes. Preserve certificate and private-network checks.

## 7. Verify and document

- Test connection validation, unknown models, malformed addresses and keys, and isolation between instances.
- Test admin, member, anonymous, and CSRF rejection paths through HTTP.
- Cover first observation, start, pause, resume, completion, repeated reads, and errors.
- Verify cache sharing, backoff, session invalidation, disconnect cleanup, and stale reads after newer notifications.
- Use synthetic fixtures. Get scoped permission for physical tests and preserve the starting settings.

Run `npm test` and `npm run test:integration`. Update the README support table and setup instructions. Once changes are staged, review `git diff --cached` and run `npm run check:public`. Use synthetic values in `examples/` and keep credentials under `data/`.
