import { Text } from "@mantine/core";
import { useBlocker } from "@/v2/hooks/useDevices";

/** Warns parents when the home box stops checking in: blocks may have lapsed. */
export function BlockerBanner() {
  const { data } = useBlocker();
  if (data?.online !== false) return null;
  return (
    <Text role="alert" data-blocker-offline>
      {data.last_seen
        ? `The home box went quiet at ${new Date(data.last_seen).toLocaleString()}.`
        : "The home box hasn't checked in yet."}{" "}
      Paused devices may be back online until it reconnects. Check that
      it&apos;s plugged in and running.
    </Text>
  );
}
