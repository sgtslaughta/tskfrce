import { useBlocker } from "@/v2/hooks/useDevices";
import { Icon } from "@/v2/parent/Icon";
import { useReachable } from "@/v2/hooks/useReachable";
import { useEffect } from "react";
import { notifications } from "@mantine/notifications";

const ID = "box-offline";
let dismissedFor: string | null = null; // the outage (by last_seen) the parent closed; a new outage toasts again
let quiet = false // our own hides (leaving parent pages, box back) aren't the parent dismissing it
const hide = () => {
  quiet = true;
  notifications.hide(ID); // onClose runs synchronously
  quiet = false;
};

/** Warns parents when the home box stops checking in (dismissable toast) or can't be reached (banner). */
export function BlockerBanner() {
  const { data } = useBlocker();
  const reachable = useReachable();
  const offline = reachable && data?.online === false;
  const outage = data?.last_seen ?? "never";
  useEffect(() => {
    if (!offline) return hide();
    if (dismissedFor === outage) return;
    notifications.show({
      id: ID,
      color: "yellow",
      title: "Home box offline",
      message: `${outage === "never" ? "Hasn’t checked in yet." : `Went quiet at ${new Date(outage).toLocaleString()}.`} Paused devices may be back online until it reconnects.`,
      autoClose: false,
      onClose: () => {
        if (!quiet) dismissedFor = outage;
      },
    });
    return hide; // not on kid screens (view as kid) or after logout
  }, [offline, outage]);
  // mockup 05 "You're offline": the box itself can't be reached, so what's on screen may be stale
  if (!reachable)
    return (
      <div className="p-banner" data-tone="red" role="alert">
        <div className="p-banner-title">
          <Icon name="wifi_off" />
          Can&apos;t reach your home box
        </div>
        <div className="p-banner-body">Showing what we had. Changes will wait until it&apos;s back.</div>
      </div>
    );
  return null;
}
