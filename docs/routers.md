# Router compatibility

The home box pauses a device by stepping in between it and your router. Some routers stop it from doing that. When you press "Test block" on a device and the result says the device stayed online and never talked to the box, your router is probably the reason. Check the list below for your router, and if yours isn't listed, please tell us so we can add it.

| Router | Works? | Notes |
|---|---|---|
| Most ISP routers | Works | — |
| Eero (mesh) | Often resists | Try disabling "Client steering". |
| Google Wifi / Nest Wifi | Often resists | — |
| UniFi with "Client device isolation" | Resists until isolation is off | Turn off "Client device isolation" for the network the box is on. |
| Asus AiMesh | Usually works | — |

## Report your router

If you tried "Test block" and your router isn't on this list, or it's listed but doesn't match what you see, [open a router report](../../issues/new?labels=router). Include your router's make and model, and what "Test block" said.
