import { Fragment, type ReactNode } from "react";
import { Menu } from "@mantine/core";
import { useOverride, type OverrideTarget } from "../hooks/useOverride";

export type QuickMenuTarget = OverrideTarget;

const TIMES: { label: string; minutes: number | null }[] = [
  { label: "for 30 min", minutes: 30 },
  { label: "for 1 hour", minutes: 60 },
  { label: "until I change it", minutes: null },
];

/** Lock / unlock menu with timers, plus "Back to schedule". `children` is the clickable trigger. */
export function DeviceQuickMenu({
  targets,
  label,
  children,
}: {
  targets: QuickMenuTarget;
  label: string;
  children: ReactNode;
}) {
  const override = useOverride();

  return (
    <Menu withinPortal transitionProps={{ duration: 0 }}>
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown aria-label={label}>
        {(["lock", "unlock"] as const).map((action) => (
          <Fragment key={action}>
            {TIMES.map((t) => {
              const text = `${action === "lock" ? "Lock" : "Unlock"} ${t.label}`;
              return (
                <Menu.Item
                  key={text}
                  mih={44}
                  onClick={() => override.mutate({ target: targets, choice: { action, minutes: t.minutes } })}
                >
                  {text}
                </Menu.Item>
              );
            })}
            <Menu.Divider />
          </Fragment>
        ))}
        <Menu.Item mih={44} onClick={() => override.mutate({ target: targets, choice: { action: "clear" } })}>
          Back to schedule
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
