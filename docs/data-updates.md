# Data refresh and polling

Screen updates, device reads, and background phone notifications run on separate schedules.

| Source | Normal cadence | Behavior |
|---|---|---|
| Local light, air conditioner, vacuum, and air fryer | Shared read about every 30 seconds per device | All clients share the result. Some adapters also cache briefly. |
| LG TV | Power and sound subscriptions, shared polling every 30 seconds as fallback | The pointer uses a separate socket. Subscription support varies by app and firmware. |
| Vestel cloud | 60 seconds | Screen refreshes use the shared result. |
| Estimated Vestel countdown | Once per second on screen | Calculated from the last observed time and its timestamp. |
| SSE | On change or a new shared result | One connection per page. Events carry the device ID. |
| SSE heartbeat | 15 seconds | Revalidates the session. |
| Fallback when SSE is unavailable | 30 seconds | The authorized status API reads the shared cache. |
| Automation evaluation | 30 seconds | Requires a recent measurement. |
| Web Push queue | About every 30 seconds | Delivery depends on the device and platform service. |
| Weather | 10 minutes | API reads use the result cached by the server. |
| Daylight | Each local day | Refreshes at local midnight and retries with backoff. |
| MGM | 15 minutes | One job fetches alerts for today and tomorrow. |
| AFAD | 2 minutes | Runs on the server independently of phones. |
| Tapo video | On demand, up to four frames per second | Viewers share one process per camera. It stops when the last viewer leaves. |
| Internet test | Configured by an admin | Chart refreshes use existing measurements. |
| IP recovery | On device error, at most once per two minutes | Verifies identity and a status read at the new address. |

The 15-second server timer checks cache age. Errors are cached briefly. Commands and connection changes invalidate the cache so a subsequent read can verify state. After an LG power-on request, the server attempts status reads at three and eight seconds.

Short activities can end between reads. Manufacturer cloud delays can shift the observation timestamp away from the physical start or finish. These are application schedules.

## Scheduled and user-initiated work

`GET /api/environment` and earthquake reads return stored results. Scheduled jobs run even when every browser is closed. The server stores weather, daylight, and MGM data in `data/environment.json`, along with the last successful result, source time, and error. The first failure waits one minute before retrying. Repeated failures back off up to 15 minutes. Work started under a previous location or permission setting cannot overwrite the new location's result.

Location search, account linking, device commands, manual speed tests, and camera video start on request. The server makes those requests. The browser communicates with its platform Push service when creating a Web Push subscription.
