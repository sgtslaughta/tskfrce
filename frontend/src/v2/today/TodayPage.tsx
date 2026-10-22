import Link from "next/link";
import { FridgeShell } from "../components/FridgeShell";
import { LoadError, LoadingCards } from "../components/States";
import { Leaderboard } from "../components/Leaderboard";
import { Sticker } from "../components/Sticker";
import { StickerCard } from "../components/StickerCard";
import { useLeaderboard } from "../hooks/useCommunity";
import { useToday } from "../hooks/useToday";
import { KidTabs } from "./KidTabs";
import { NewDevicesBanner } from "./NewDevicesBanner";
import { NeedsYou } from "./NeedsYou";

const dayName = (iso?: string) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
      })
    : "Today";

/** Parent home: day, needs-you feed, new devices, one tab per kid. */
export function TodayPage() {
  const { data, isError, error, refetch } = useToday();
  const board = useLeaderboard().data;
  const n = data?.pending_approvals ?? 0;
  const sticker = n > 0 && (
    <Sticker>{`${n} ${n === 1 ? "chore needs" : "chores need"} you`}</Sticker>
  );

  return (
    <FridgeShell title={dayName(data?.day)} actions={sticker || undefined}>
      {isError && !data && <LoadError error={error} onRetry={() => refetch()} />}
      {!data && !isError && <LoadingCards n={3} h={140} />}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <NeedsYou items={data.needs_you ?? []} />
          <NewDevicesBanner devices={data.new_devices} />
          {data.kids.length === 0 ? (
            <StickerCard>
              <p>Add your first kid to get started.</p>
              <Link href="/kids">Add a kid</Link>
            </StickerCard>
          ) : (
            <KidTabs kids={data.kids} />
          )}
          {board && <Leaderboard rows={board.rows} />}
        </div>
      )}
    </FridgeShell>
  );
}
