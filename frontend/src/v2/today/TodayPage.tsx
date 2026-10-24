import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import { ParentShell } from "../parent/ParentShell";
import { LoadError, LoadingCards } from "../components/States";
import { StickerCard } from "../components/StickerCard";
import { useToday } from "../hooks/useToday";
import { GetStartingChecklistCard } from "./GetStartingChecklistCard";
import { KidList } from "./KidList";
import { ChoreRow } from "./ChoreRow";
import { ChoreOpen } from "./ChoreOpen";
import { ChatColumn } from "./ChatColumn";
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
          <GetStartingChecklistCard kids={data.kids} />
          <div className="p-open-header">
            <h2>{kid.name}&apos;s day</h2>
            <div className="p-open-actions">
              <Link href={`/kid?as=${kid.id}`} className="p-btn">
                View as kid
              </Link>
              <Link href={`/kids?section=chores&kid=${kid.id}`} className="p-btn">
                Add chore
              </Link>
            </div>
          </div>

          {kid.total !== undefined && kid.total > 0 && (
            <div className="p-open-progress">
              <div className="p-meter-bar" style={{ width: `${(kid.done ?? 0) / kid.total * 100}%` }} />
              <span>{kid.done ?? 0} of {kid.total} done</span>
            </div>
          )}

          <div className="p-chores-list">
            {kid.chores.map((chore) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                isOpen={openChoreId === chore.id}
                onToggle={() =>
                  setOpenChoreId(
                    openChoreId === chore.id ? null : chore.id
                  )
                }
              />
            ))}
          </div>

          {openChoreId && kid && (
            <ChoreOpen
              chore={kid.chores.find((c) => c.id === openChoreId)!}
              kid={kid}
              onOpenChat={() => setChatOpen(!chatOpen)}
              chatOpen={chatOpen}
            />
          )}

          {kid.progress && (
            <div className="p-summary-strip" data-testid="summary-strip">
              <div className="p-summary-item">
                <span className="p-summary-label">Status</span>
                <span className="p-summary-value">{kid.online_all ? "Online" : "Offline"}</span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Today</span>
                <span className="p-summary-value">{kid.done ?? 0}/{kid.total ?? 0}</span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Earned</span>
                <span className="p-summary-value">{kid.progress.xp}</span>
              </div>
              {kid.last_active && (
                <div className="p-summary-item">
                  <span className="p-summary-label">Last active</span>
                  <span className="p-summary-value">{new Date(kid.last_active).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ParentShell>
  );
}
