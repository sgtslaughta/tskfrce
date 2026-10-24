import { useState, type ReactNode } from "react";
import { openChat } from "@/v2/chat/dock";
import { Button } from "@mantine/core";
import {
  IconCamera,
  IconChecklist,
  IconGift,
  IconHourglass,
  IconMessage,
  IconRefresh,
} from "@tabler/icons-react";
import { useThreads } from "../hooks/useChat";
import { useDecideRedemption } from "../hooks/useRewards";
import { useApproveChore, useSendBack } from "../hooks/useToday";
import { toastFail, toastOk } from "../notify";
import type { NeedsItem } from "../types";
import { PhotoViewer, useAuthImage } from "./PhotoViewer";

type Kind = NeedsItem["type"];
const META: Record<Kind, { label: string; icon: ReactNode; edge: string }> = {
  chore: { label: "Chore", icon: <IconChecklist size={13} />, edge: "var(--f-green)" },
  redo: { label: "Redo", icon: <IconRefresh size={13} />, edge: "var(--f-red)" },
  screen_time: { label: "Screen time", icon: <IconHourglass size={13} />, edge: "#5b6fb5" },
  reward: { label: "Rewards", icon: <IconGift size={13} />, edge: "var(--f-sun)" },
};
const FILTERS: { key: Kind | "all"; label: string; match: Kind[] }[] = [
  { key: "all", label: "All", match: ["chore", "redo", "screen_time", "reward"] },
  { key: "chore", label: "Chores", match: ["chore", "redo"] },
  { key: "screen_time", label: "Screen time", match: ["screen_time"] },
  { key: "reward", label: "Rewards", match: ["reward"] },
];
const isChore = (i: NeedsItem) => i.type === "chore" || i.type === "redo";
const timeOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

function Thumb({ item, onOpen }: { item: NeedsItem; onOpen: () => void }) {
  const src = useAuthImage(item.thumb_url);
  return (
    <button
      type="button"
      aria-label={`Open photo for ${item.title}`}
      onClick={onOpen}
      style={{ width: 44, height: 44, padding: 0, border: 0, borderRadius: 4, overflow: "hidden", background: "var(--f-mute)", cursor: "pointer" }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </button>
  );
}

/** Everything waiting on a parent: chores, redos, screen time and reward requests. */
export function NeedsYou({ items }: { items: NeedsItem[] }) {
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [viewing, setViewing] = useState<NeedsItem | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const approve = useApproveChore();
  const sendBack = useSendBack();
  const decide = useDecideRedemption();
  const threads = useThreads().data?.threads ?? [];
  if (!items.length) return null;

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = items.filter((i) => active.match.includes(i.type));

  const approveOne = (i: NeedsItem) =>
    isChore(i) ? approve.mutateAsync(i.id) : decide.mutateAsync({ id: i.id, approve: true });
  const run = (p: Promise<unknown>, ok: string) => p.then(() => toastOk(ok), toastFail);
  const approveAll = async () => {
    let n = 0;
    for (const i of shown) {
      try {
        await approveOne(i);
        n++;
      } catch (e) {
        toastFail(e);
        break;
      }
    }
    if (n) toastOk(n === 1 ? "Approved" : `Approved ${n} items`);
  };
  const submitSendBack = (id: number, n: string) => {
    setSending(null);
    setNote("");
    return run(sendBack.mutateAsync({ id, note: n }), "Sent back");
  };

  return (
    <section className="f-card" data-tone="sun" aria-label="Needs you">
      <div className="f-row" style={{ justifyContent: "space-between" }}>
        <span className="f-cap">{`Needs you · ${items.length}`}</span>
        <span className="f-row">
          {FILTERS.map((f) => {
            const n = items.filter((i) => f.match.includes(i.type)).length;
            if (f.key !== "all" && n === 0) return null;
            return (
              <button
                key={f.key}
                type="button"
                className="f-pill"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                style={filter === f.key ? { background: "var(--f-ink)", color: "var(--f-card)" } : undefined}
              >
                {`${f.label} ${n}`}
              </button>
            );
          })}
          <Button size="xs" onClick={approveAll}>
            Approve all
          </Button>
        </span>
      </div>
      <div className="n-list">
        {shown.map((i) => {
          const m = META[i.type];
          const chore = isChore(i);
          return (
            <div
              key={`${i.type}-${i.id}`}
              className="n-item"
              style={{ borderLeft: `4px solid ${m.edge}` }}
            >
              {i.thumb_url ? (
                <Thumb item={i} onOpen={() => setViewing(i)} />
              ) : (
                <span data-testid={`icon-${i.type}`} style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 6, background: "var(--f-mute)" }}>
                  {m.icon}
                </span>
              )}
              <div className="n-text">
                <span className="f-cap" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <span data-testid={`type-${i.type}`} style={{ display: "inline-flex" }}>{m.icon}</span>
                  {i.type === "redo" ? "Redo" : m.label === "Rewards" ? "Reward" : m.label}
                </span>
                <div>
                  <b>{i.kid_name ?? "A kid"}</b>{` · ${i.title}`}
                </div>
                <div className="f-cap" style={{ color: "var(--f-sub)", textTransform: "none", letterSpacing: 0 }}>
                  {chore ? (
                    <>
                      {i.thumb_url && <IconCamera size={11} />}
                      {i.attempt && i.attempt > 1 ? `${ordinal(i.attempt)} try · ` : ""}
                      {i.subtasks_total ? `${i.subtasks_done}/${i.subtasks_total} · ` : ""}
                      {timeOf(i.submitted_at)}
                    </>
                  ) : (
                    `${i.cost} pts · has ${i.kid_balance}`
                  )}
                </div>
                {sending === i.id && (
                  <div className="f-row" style={{ marginTop: 6 }}>
                    <input aria-label="Note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                  </div>
                )}
              </div>
              {chore && (
                <button type="button" onClick={() => openChat("chore", String(i.id))} aria-label={`Chat about ${i.title}`} className="f-row" style={{ gap: 2, background: "none", border: 0, padding: 0, color: "inherit", cursor: "pointer" }}>
                  <IconMessage size={16} />
                  {(threads.find((t) => t.kind === "chore" && t.task_id === i.id)?.unread ?? 0) > 0 && (
                    <span className="f-pill" data-testid={`chore-unread-${i.id}`}>
                      {threads.find((t) => t.kind === "chore" && t.task_id === i.id)?.unread}
                    </span>
                  )}
                </button>
              )}
              <Button size="xs" onClick={() => run(approveOne(i), "Approved")}>
                Approve
              </Button>
              {chore ? (
                sending === i.id ? (
                  <Button size="xs" variant="default" disabled={!note.trim()} onClick={() => submitSendBack(i.id, note.trim())}>
                    Send back
                  </Button>
                ) : (
                  <Button size="xs" variant="default" onClick={() => { setSending(i.id); setNote(""); }}>
                    Send back
                  </Button>
                )
              ) : (
                <Button size="xs" variant="default" onClick={() => run(decide.mutateAsync({ id: i.id, approve: false }), "Denied")}>
                  Deny
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <PhotoViewer
        item={viewing}
        onClose={() => setViewing(null)}
        onApprove={(id) => run(approve.mutateAsync(id), "Approved")}
        onSendBack={submitSendBack}
      />
    </section>
  );
}

const ordinal = (n: number) => (n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
