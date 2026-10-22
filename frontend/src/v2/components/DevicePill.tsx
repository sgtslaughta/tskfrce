import type { ButtonHTMLAttributes, Ref } from "react";

export type DeviceKind = "phone" | "console" | "tv" | "laptop" | "other";

export const DEVICE_ICON: Record<DeviceKind, string> = {
  phone: "📱",
  console: "🎮",
  tv: "📺",
  laptop: "💻",
  other: "🔌",
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
      <span aria-hidden="true">{DEVICE_ICON[kind]}</span>
      {/* "pixel-7.lan" reads better as "pixel-7"; the full name stays in the aria label */}
      {/^[\d.]+$/.test(name) ? name : name.split(".")[0]}
    </>
  );
  return onClick ? (
    <button
      type="button"
      aria-label={label}
      {...rest}
      ref={ref}
      className="f-pill"
      data-online={online}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <span className="f-pill" data-online={online} role="img" aria-label={label}>
      {body}
    </span>
  );
}
