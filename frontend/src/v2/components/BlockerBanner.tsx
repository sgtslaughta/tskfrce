import { useBlocker } from "@/v2/hooks/useDevices";
import { Icon } from "@/v2/parent/Icon";

/** Warns parents when the home box stops checking in: blocks may have lapsed. */
export function BlockerBanner() {
  const { data } = useBlocker();
  if (data?.online !== false) return null;
  return (
    <div className="p-banner" role="alert">
      <div className="p-banner-title">
        <Icon name="warning" />
        Home box offline
      </div>
      <div className="p-banner-body">
        {data.last_seen
          ? `Went quiet at ${new Date(data.last_seen).toLocaleString()}.`
          : "Hasn’t checked in yet."}{" "}
        Paused devices may be back online until it reconnects. Check that it&apos;s plugged in and running.
      </div>
    </div>
  );
}
