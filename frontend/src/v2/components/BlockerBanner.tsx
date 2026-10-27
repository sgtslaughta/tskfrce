import { useState } from "react";
import { useBlocker } from "@/v2/hooks/useDevices";
import { Icon } from "@/v2/parent/Icon";
import { useReachable } from "@/v2/hooks/useReachable";
import { useOnline } from "@/v2/hooks/useOnline";

let dismissedFor: string | null = null; // the outage (by last_seen) the parent closed; a new outage shows again

/** Mockup 05 banners: amber "You're offline" (this device), red "Home box offline" (Details, dismissable) and amber "can't reach the box". */
export function BlockerBanner() {
  const { data } = useBlocker();
  const reachable = useReachable();
  const online = useOnline();
  const [, rerender] = useState(0);
  const [details, setDetails] = useState(false);
  const outage = data?.last_seen ?? "never";
  if (!online)
    return (
      <div className="p-banner" role="status">
        <div className="p-banner-title">
          <Icon name="signal_wifi_statusbar_not_connected" />
          You&apos;re offline
        </div>
        <div className="p-banner-body">Showing what we had. Changes will wait.</div>
      </div>
    );
  if (!reachable)
    return (
      <div className="p-banner" role="alert">
        <div className="p-banner-title">
          <Icon name="signal_wifi_statusbar_not_connected" />
          Can&apos;t reach your home box
        </div>
        <div className="p-banner-body">Showing what we had. Changes will wait until it&apos;s back.</div>
      </div>
    );
  if (data?.online !== false || dismissedFor === outage) return null;
  return (
    <div className="p-banner" data-tone="red" role="status">
      <div className="p-banner-title">
        <Icon name="shield" />
        Home box offline
        <span className="p-banner-acts">
          <button type="button" className="p-btn" aria-expanded={details} onClick={() => setDetails((v) => !v)}>
            Details
          </button>
          <button
            type="button"
            className="p-banner-x"
            aria-label="Dismiss"
            onClick={() => {
              dismissedFor = outage;
              rerender((n) => n + 1);
            }}
          >
            <Icon name="close" />
          </button>
        </span>
      </div>
      <div className="p-banner-body">
        Devices aren&apos;t being locked right now.
        {details &&
          ` ${outage === "never" ? "It hasn’t checked in yet." : `It went quiet at ${new Date(outage).toLocaleString()}.`} Paused devices may be back online until it reconnects.`}
      </div>
    </div>
  );
}
