import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import { ParentShell } from "../parent/ParentShell";
import { LoadError, LoadingCards } from "../components/States";
import { StickerCard } from "../components/StickerCard";
import { useToday } from "../hooks/useToday";
import { KidList } from "./KidList";
import type { TodayKid, TodayChore } from "../types";

const dayName = (iso?: string) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
      })
    : "Today";

export function TodayPage() {
  const { data, isError, error, refetch } = useToday();
  const router = useRouter();
  const [selectedKid, setSelectedKid] = useState<TodayKid | undefined>();
  const [openChoreId, setOpenChoreId] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const selectedKidFromUrl = data?.kids.find(
    (k) => k.id === Number(router.query.item)
  );
  const kid = selectedKidFromUrl || selectedKid || data?.kids[0];

  return (
    <ParentShell
      title={dayName(data?.day)}
      list={
        data ? (
          <KidList onSelectKid={setSelectedKid} selectedKid={kid} />
        ) : null
      }
    >
      {isError && !data && <LoadError error={error} onRetry={() => refetch()} />}
      {!data && !isError && <LoadingCards n={3} h={140} />}
      {data && data.kids.length === 0 && (
        <StickerCard>
          <p>Add your first kid to get started.</p>
          <Link href="/kids">Add a kid</Link>
        </StickerCard>
      )}
      {data && kid && (
        <div className="p-today-detail">
          <h2>{kid.name}&apos;s day</h2>
          <div className="p-chores-list">
            {kid.chores.map((chore) => (
              <div
                key={chore.id}
                data-testid="chore-row"
                data-open={openChoreId === chore.id}
                className="p-chore-row"
              >
                <button
                  className="p-chore-header"
                  onClick={() =>
                    setOpenChoreId(
                      openChoreId === chore.id ? null : chore.id
                    )
                  }
                  style={
                    chore.state === "done"
                      ? { textDecoration: "line-through" }
                      : {}
                  }
                >
                  <span>{chore.title}</span>
                  {chore.state === "done" && (
                    <span style={{ fontSize: "0.9em", color: "#666" }}>
                      Done 4:30 PM
                    </span>
                  )}
                </button>
                {openChoreId === chore.id && (
                  <div className="p-chore-detail">
                    <button onClick={() => setChatOpen(!chatOpen)}>
                      Open chat
                    </button>
                    {chatOpen && (
                      <div
                        data-testid="chat-column"
                        className="p-chat-column"
                      >
                        <button
                          onClick={() => setChatOpen(false)}
                          aria-label="Close chat"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </ParentShell>
  );
}
