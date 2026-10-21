import { Button, Menu } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { toastFail, toastOk } from "../notify";
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
      toastOk("Approved");
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["chores-today"] });
    },
    onError: toastFail,
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
      <div className="f-card-head">
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
            <LockBadge online={kid.devices.length === 0 ? null : kid.online_all} />
          </button>
        </DeviceQuickMenu>
        <span
          className="f-display"
          style={{ fontSize: 20, fontWeight: 600, flex: 1, minWidth: 0 }}
        >
          {name}
        </span>
      </div>
      <div className="f-card-body">
        {pending.length > 0 && <ApproveButton pending={pending} />}
        <ChipRow chores={kid.chores} devices={kid.devices} />
      </div>
    </StickerCard>
  );
}
