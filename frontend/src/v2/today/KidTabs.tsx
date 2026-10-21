import { useState } from "react";
import { Tabs } from "@mantine/core";
import { useThreads } from "../hooks/useChat";
import type { TodayKid } from "../types";
import { KidCard } from "./KidCard";

const KEY = "task4ce-today-tab";
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** One tab per kid; only the open kid's panel is rendered. Remembers the last tab. */
export function KidTabs({ kids }: { kids: TodayKid[] }) {
  const threads = useThreads().data?.threads;
  const unreadFor = (id: number) => threads?.find((t) => t.kind === "private" && t.kid_id === id)?.unread ?? 0;
  const [picked, setPicked] = useState<string | null>(read);
  const value = kids.some((k) => String(k.id) === picked) ? picked : String(kids[0].id);
  const pick = (v: string | null) => {
    setPicked(v);
    try {
      if (v) localStorage.setItem(KEY, v);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <Tabs value={value} onChange={pick} keepMounted={false}>
      <Tabs.List style={{ overflowX: "auto", flexWrap: "nowrap" }}>
        {kids.map((k) => (
          <Tabs.Tab key={k.id} value={String(k.id)} mih={44}>
            {`${k.name ?? "Kid"} ${k.done ?? 0}/${k.total ?? k.chores.length}`}
            {(k.needs_you_count ?? 0) > 0 && (
              <span
                data-testid={`dot-${k.id}`}
                aria-label="needs you"
                style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--f-red)", marginLeft: 8 }}
              />
            )}
            {unreadFor(k.id) > 0 && (
              <span className="f-pill" data-testid={`chat-unread-${k.id}`} aria-label={`${unreadFor(k.id)} unread messages`} style={{ marginLeft: 8 }}>
                {unreadFor(k.id)}
              </span>
            )}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {kids.map((k) => (
        <Tabs.Panel key={k.id} value={String(k.id)} pt="sm">
          <KidCard kid={k} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
