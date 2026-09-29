# BandFlow workspaces

The repositories are now independent:

```text
D:\Baga Codes and Stuff\
├── Naprock-BandFlow\   Expo app, Node API, and canonical SQLite database
└── naprock\            Flask BLE bridge and ESP32 firmware
```

Open both folders together with `D:\Baga Codes and Stuff\Naprock-BandFlow.code-workspace`.

The app workspace does not track the bridge repository as a submodule. The
repositories communicate through the v1 contract in `contracts/ble-bridge-v1.md`.

To sync partner changes safely:

```powershell
npm run sync:naprock
```

This fetches `upstream/main`, fast-forwards the sibling `naprock` workspace, and
refuses to run while it has uncommitted changes. To also update your fork:

```powershell
npm run sync:naprock -- -PushToFork
```
