import { Button } from "@mantine/core";
import { openChat } from "@/v2/chat/dock";
import { useThread } from "../hooks/useChat";
import { DevicePill, deviceKind } from "../components/DevicePill";
import { BadgeGrid } from "../components/BadgeGrid";
import { LockBadge } from "../components/LockBadge";
import { ProgressHeader } from "../components/ProgressHeader";
import { useProfiles } from "../hooks/useCommunity";
import type { TodayChore, TodayKid } from "../types";
import { DeviceQuickMenu } from "./DeviceQuickMenu";

const MODE_TAG = { race: "Race", team: "Team" } as const;

function ago(iso?: string | null) {
  if (!iso) return "Never seen";
  const m = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  return m < 1
    ? "Just now"
    : m < 60
      ? `${m}m ago`
      : `${Math.round(m / 60)}h ago`;
}

function ChoreRow({ c }: { c: TodayChore }) {
  const tag = c.mode && c.mode !== "each" ? MODE_TAG[c.mode] : null;
  return (
    <div
      className="f-row"
      style={{
        padding: "8px 0",
        borderTop: "1px solid var(--f-line)",
        flexWrap: "nowrap",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        {c.title}
        {c.taken_by && (
          <span className="f-cap">{` Taken by ${c.taken_by}`}</span>
        )}
      </span>
      {c.state === "needs_you" && (
        <span className="f-pill">Waiting for you</span>
      )}
      {c.due_time && <span className="f-pill">{`Due ${c.due_time}`}</span>}
      {tag && <span className="f-cap">{tag}</span>}
      {!!c.subtasks_total && (
        <span className="f-cap">{`${c.subtasks_done ?? 0}/${c.subtasks_total}`}</span>
      )}
      <b>{`+${c.points}`}</b>
    </div>
  );
}

function ChatBox({ kidId, name }: { kidId: number; name: string }) {
  const last = (
    useThread("private", String(kidId), false, 15_000).data?.messages ?? []
  ).slice(-2);
  return (
    <div
      style={{ marginTop: 16 }}
      aria-label={`Chat with ${name}`}
      role="group"
    >
      <div className="f-cap">{`Chat with ${name}`}</div>
      {last.length === 0 && <p className="f-note">No messages yet.</p>}
      {last.map((m) => (
        <p key={m.id} style={{ margin: "4px 0" }}>
          <b>{m.kind === "system" ? "" : `${m.author_name ?? "Someone"}: `}</b>
          {m.body ?? "Photo"}
        </p>
      ))}
      <Button variant="subtle" size="compact-md" onClick={() => openChat("private", String(kidId))}>
        Open
      </Button>
    </div>
  );
}

/** One kid's tab panel: header, still to do, collapsed done, devices. */
export function KidCard({ kid }: { kid: TodayKid }) {
  const name = kid.name ?? "Kid";
  const todo = kid.chores.filter((c) => c.state !== "done");
  const done = kid.chores.filter((c) => c.state === "done");
  const recent = (
    useProfiles().data?.find((p) => p.kid_id === kid.id)?.badges ?? []
  )
    .slice(-3)
    .reverse();
  const online = kid.devices.some((d) => d.online);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="f-card" style={{ padding: 0, overflow: "hidden" }}>
        <ProgressHeader
          name={name}
          avatar={kid.avatar}
          progress={kid.progress}
          size="lg"
        />
        <div className="f-row" style={{ gap: 16, padding: "10px 14px" }}>
          <span className="f-cap">
            <span className="f-num">{`${kid.done ?? done.length}/${kid.total ?? kid.chores.length}`}</span>{" "}
            done today
          </span>
          <span className="f-cap">
            {online ? "Online" : `Last active ${ago(kid.last_active)}`}
          </span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div className="f-card">
          <div
            className="f-cap"
            style={{ margin: "0 0 2px" }}
          >{`Still to do · ${todo.length}`}</div>
          {todo.length === 0 && <p className="f-note">All done for today.</p>}
          {todo.map((c) => (
            <ChoreRow key={c.id} c={c} />
          ))}
          <details style={{ marginTop: 10 }}>
            <summary className="f-cap">{`Done · ${done.length}`}</summary>
            {done.map((c) => (
              <ChoreRow key={c.id} c={c} />
            ))}
          </details>
        </div>
        <div className="f-card">
          <div className="f-cap">Devices</div>
          <div className="f-row" style={{ marginTop: 8 }}>
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
                <LockBadge
                  online={kid.devices.length === 0 ? null : kid.online_all}
                />
              </button>
            </DeviceQuickMenu>
            {kid.devices.map((d) => (
              <DeviceQuickMenu
                key={d.id}
                targets={{ kind: "device", id: d.id }}
                label={`${d.name} lock options`}
              >
                <DevicePill
                  name={d.name}
                  kind={deviceKind(d.name, d.vendor)}
                  online={d.online}
                />
              </DeviceQuickMenu>
            ))}
          </div>
          <ChatBox kidId={kid.id} name={name} />
          {recent.length > 0 && (
            <>
              <div className="f-cap" style={{ marginTop: 16 }}>
                Recent
              </div>
              <BadgeGrid badges={recent} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
