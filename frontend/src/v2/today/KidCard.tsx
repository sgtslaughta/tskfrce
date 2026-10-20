import { Button, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { LockBadge } from "../components/LockBadge";
import { StickerCard } from "../components/StickerCard";
import type { TodayKid } from "../types";
import { ChipRow } from "./ChipRow";
import { DeviceQuickMenu } from "./DeviceQuickMenu";

function ApproveButton({ pending }: { pending: TodayKid["chores"] }) {
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: (id: number) =>
      api(`/chores/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      notifications.show({ message: "Approved", color: "green" });
      qc.invalidateQueries({ queryKey: ["today"] });
    },
    onError: (e: Error) =>
      notifications.show({ message: e.message, color: "red" }),
  });
  const first = (
    <Button
      loading={approve.isPending}
      onClick={() => approve.mutate(pending[0].id)}
    >
      Approve
    </Button>
  );
  if (pending.length < 2) return first;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {first}
      <Menu withinPortal transitionProps={{ duration: 0 }}>
        <Menu.Target>
          <Button mih={44} aria-label="Choose which chore to approve">
            ▾
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {pending.map((c) => (
            <Menu.Item key={c.id} mih={44} onClick={() => approve.mutate(c.id)}>
              Approve {c.title}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

/** One kid: lock badge (tap for lock menu), name, Approve, then the chip row. */
export function KidCard({ kid }: { kid: TodayKid }) {
  const name = kid.name ?? "Kid";
  const pending = kid.chores.filter((c) => c.state === "needs_you");
  return (
    <StickerCard>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <DeviceQuickMenu
          targets={{ kind: "kid", id: kid.id }}
          label={`${name} lock options`}
        >
          <button
            type="button"
            aria-label={`Lock or unlock all of ${name}’s devices`}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
              minWidth: 48,
              minHeight: 48,
            }}
          >
            <LockBadge online={kid.online_all} />
          </button>
        </DeviceQuickMenu>
        <span
          className="f-display"
          style={{ fontSize: 20, fontWeight: 600, flex: 1, minWidth: 0 }}
        >
          {name}
        </span>
        {pending.length > 0 && <ApproveButton pending={pending} />}
      </div>
      <ChipRow chores={kid.chores} devices={kid.devices} />
    </StickerCard>
  );
}
