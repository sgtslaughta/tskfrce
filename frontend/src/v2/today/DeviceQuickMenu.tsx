import { Fragment, type ReactNode } from "react";
import { Menu } from "@mantine/core";
import { toastFail, toastOk } from "../notify";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { OverrideAction } from "../types";

export interface QuickMenuTarget {
  kind: "device" | "kid" | "group";
  id: number;
}

const BASE = { device: "devices", kid: "kids", group: "groups" } as const;
const TIMES: { label: string; minutes: number | null }[] = [
  { label: "for 30 min", minutes: 30 },
  { label: "for 1 hour", minutes: 60 },
  { label: "until I change it", minutes: null },
];
const TOAST = { lock: "Locked", unlock: "Unlocked", clear: "Back on schedule" };

type Choice =
  | { action: OverrideAction; minutes: number | null }
  | { action: "clear" };

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
  const qc = useQueryClient();
  const url = `/${BASE[targets.kind]}/${targets.id}/override`;
  const run = useMutation({
    mutationFn: (c: Choice) =>
      c.action === "clear"
        ? api(url, { method: "DELETE" })
        : api(url, {
            method: "POST",
            body: { action: c.action, minutes: c.minutes },
          }),
    onSuccess: (_d, c) => {
      toastOk(TOAST[c.action]);
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: toastFail,
  });

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
                  onClick={() => run.mutate({ action, minutes: t.minutes })}
                >
                  {text}
                </Menu.Item>
              );
            })}
            <Menu.Divider />
          </Fragment>
        ))}
        <Menu.Item mih={44} onClick={() => run.mutate({ action: "clear" })}>
          Back to schedule
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
