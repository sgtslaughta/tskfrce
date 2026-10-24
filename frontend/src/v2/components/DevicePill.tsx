import type { ButtonHTMLAttributes, Ref } from "react";
import { Icon } from "../parent/Icon";

export type DeviceKind = "phone" | "console" | "tv" | "laptop" | "other";

export const DEVICE_ICON: Record<DeviceKind, string> = {
  phone: "smartphone",
  console: "controller",
  tv: "tv",
  laptop: "laptop",
  other: "power",
};

const GUESS: [DeviceKind, RegExp][] = [
  ["console", /xbox|playstation|\bps[345]\b|nintendo|switch|steam ?deck/i],
  ["tv", /\btv\b|roku|chromecast|fire ?stick|apple ?tv|shield|bravia/i],
  ["laptop", /laptop|macbook|chromebook|thinkpad|\bpc\b|desktop|imac/i],
  ["phone", /phone|ipad|tablet|pixel|galaxy|kindle|android/i],
];

/** Best guess of a device's kind from its name and vendor (backend has no kind field). */
export function deviceKind(name: string, vendor?: string | null): DeviceKind {
  const text = `${name} ${vendor ?? ""}`;
  return GUESS.find(([, re]) => re.test(text))?.[0] ?? "other";
}

type Props = {
  name: string;
  kind: DeviceKind;
  online: boolean;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "name">;

/** "task4ce-lab-kid1-1.home.lan" -> "Kid1"; "pixel-7.lan" -> "Pixel 7"; max 14 characters. */
export function shortName(name: string): string {
  if (/^[\d.]+$/.test(name)) return name;
  let n = name.split(".")[0].replace(/^(task4ce|tskfrce|t4sk)[-_]/i, "").replace(/^lab[-_]/i, "");
  n = n.replace(/[-_]\d+$/, (m) => (/^[-_]1$/.test(m) ? "" : m)).replace(/[-_]+/g, " ").trim() || name;
  n = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  return n.length > 14 ? `${n.slice(0, 13)}…` : n;
}

/** Device pill: icon + name, green online / red offline. Becomes a button when onClick is set; ref and extra props go to that button (so it can be a Menu target). */
export function DevicePill({
  name,
  kind,
  online,
  onClick,
  ref,
  ...rest
}: Props) {
  const label = `${name}, ${online ? "online" : "offline"}`;
  const body = (
    <>
      <Icon name={DEVICE_ICON[kind]} label="" />
      {/* friendly short name; the full name stays in title and aria-label */}
      {shortName(name)}
    </>
  );
  return onClick ? (
    <button
      type="button"
      aria-label={label}
      title={name}
      {...rest}
      ref={ref}
      className="f-pill"
      data-online={online}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <span className="f-pill" data-online={online} role="img" aria-label={label} title={name}>
      {body}
    </span>
  );
}
