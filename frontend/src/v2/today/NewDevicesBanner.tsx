import Link from "next/link";
import { StickerCard } from "../components/StickerCard";
import type { Device } from "../types";

/** Shown when unassigned devices have joined the network. */
export function NewDevicesBanner({ devices }: { devices: Device[] }) {
  if (devices.length === 0) return null;
  if (devices.length > 1)
    return (
      <StickerCard tone="sun">
        <span>
          {devices.length} new devices joined:{" "}
          {devices
            .slice(0, 2)
            .map((d) => d.name.split(".")[0])
            .join(", ")}
          {devices.length > 2 ? ` and ${devices.length - 2} more` : ""}.{" "}
          <Link href="/devices" style={{ fontWeight: 700, color: "inherit" }}>
            Assign them
          </Link>
        </span>
      </StickerCard>
    );
  return (
    <>
      {devices.map((d) => (
        <StickerCard key={d.id} tone="sun">
          <span>
            New device joined: {d.name}.{" "}
            <Link
              href={`/devices?focus=${d.id}`}
              style={{ fontWeight: 700, color: "inherit" }}
            >
              Assign it?
            </Link>
          </span>
        </StickerCard>
      ))}
    </>
  );
}
