import { useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { useBlocker } from "@/v2/hooks/useDevices";
import { Icon } from "@/v2/parent/Icon";
import { useReachable } from "@/v2/hooks/useReachable";
import { useOnline } from "@/v2/hooks/useOnline";

type Status = "offline" | "unreachable" | "box";

let dismissedFor: string | null = null; // the outage (by last_seen) the parent closed; a new outage shows again
let current: Status | null = null; // one status toast for the whole app, whichever shell layout is mounted

const wifi = <Icon name="signal_wifi_statusbar_not_connected" size={16} />;

/** Connection status as sticky toasts themed by severity: amber for this device / can't reach, red for box offline. */
export function BlockerBanner() {
  const { data } = useBlocker();
  const reachable = useReachable();
  const online = useOnline();
  const outage = data?.last_seen ?? "never";
  const status: Status | null = !online
    ? "offline"
    : !reachable
      ? "unreachable"
      : data?.online === false && dismissedFor !== outage
        ? "box"
        : null;

  useEffect(() => {
    if (status === current) return;
    if (current) notifications.hide(`box-${current}`);
    current = status;
    if (!status) return;
    const toast = {
      offline: { color: "sun", icon: wifi, title: "You're offline", message: "Showing what we had. Changes will wait." },
      unreachable: {
        color: "sun",
        icon: wifi,
        title: "Can't reach your home box",
        message: "Showing what we had. Changes will wait until it's back.",
      },
      box: {
        color: "fridgeRed",
        icon: <Icon name="shield" size={16} />,
        title: "Home box offline",
        message: `Devices aren't being locked right now. ${
          outage === "never" ? "It hasn't checked in yet." : `It went quiet at ${new Date(outage).toLocaleString()}.`
        } Paused devices may be back online until it reconnects.`,
      },
    }[status];
    notifications.show({
      id: `box-${status}`,
      autoClose: false,
      ...toast,
      onClose: () => {
        if (current !== status) return; // hidden by a status change, not by the parent
        if (status === "box") dismissedFor = outage;
        current = null;
      },
    });
  }, [status, outage]);

  // leaving the parent shell (log out) takes the toast with it
  useEffect(
    () => () => {
      if (current) notifications.hide(`box-${current}`);
      current = null;
    },
    [],
  );
  return null;
}
