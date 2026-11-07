# Third-party components

Evimiz source code is licensed under the [MIT license](../LICENSE). Dependencies and services retain their own terms. Versions below come from `package-lock.json` and installed package metadata.

| Package | Version | License | Use |
|---|---|---|---|
| lgtv2 | 2.1.0 | MIT | LG SSAP connection |
| tuyapi | 7.7.1 | MIT | Tuya local discovery and connection |
| web-push | 3.6.7 | MPL-2.0 | Web Push delivery |
| ws | 8.21.0 | MIT | WebSocket transport for the LG pointer |

Transitive packages carry their own licenses. Install the Python environments and local protocol dependencies, including `smartthings_local`, separately under `data/`. Follow upstream installation instructions and license terms.

Manufacturer accounts and private service client access are governed by their own terms. Product names identify compatibility. Evimiz is an independent project.

Install FFmpeg on the host. Its license and codec terms depend on the build. The joystick uses native Pointer Events.
