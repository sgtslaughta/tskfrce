import Link from "next/link";
import { viewAs } from '@/v2/kid/viewAs'
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useMediaQuery } from "@mantine/hooks";
import { ParentShell } from "../parent/ParentShell";
import { EmptyState, ErrorPanel, Skeleton } from "../parent/states";
import { TipsContainer } from "../components/TipsContainer";
import { useToday } from "../hooks/useToday";
import { GetStartingChecklistCard } from "./GetStartingChecklistCard";
import { KidList } from "./KidList";
import { KidStrip } from "./KidStrip";
import { NeedsYouList } from "./NeedsYouList";
import { SegmentedControl } from "../parent/SegmentedControl";
import { KidFacts } from "./KidFacts";
import { ChoreRow } from "./ChoreRow";
import { useClock } from "./useClock";
import { Icon } from "../parent/Icon";
import { getTipsToShow, PARENT_TIPS } from "../tips";
import type { TodayKid, TodayChore } from "../types";

export function TodayPage() {
  const { data, isError, error, refetch } = useToday();
  const router = useRouter();
  const clock = useClock();
  // keep the id, not the object: the kid is looked up in every poll so the page never shows stale numbers
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const setSelectedKid = (k: TodayKid) => {
    setSelectedId(k.id);
    router.push(`/?item=${k.id}`, undefined, { shallow: true }); // deep link + back button follow the choice
  };
  // phone: "Needs you" replaces the day (desktop has the same list as a tab in the kids sidebar)
  const small = useMediaQuery("(max-width: 767px)");
  const [phoneTab, setPhoneTab] = useState<"today" | "needs">("today");
  const wantNeeds = router.query.tab === "needs";
  useEffect(() => {
    if (wantNeeds) setPhoneTab("needs");
  }, [wantNeeds]);
  const needs = data?.needs_you ?? [];
  const showNeeds = !!small && phoneTab === "needs" && !!data;
  const [openChoreId, setOpenChoreId] = useState<number | null>(null);
  // ?chore=<run id> (from a notification) opens that chore on its kid's day
  const runId = Number(router.query.chore) || null;
  useEffect(() => {
    if (runId) setOpenChoreId(runId);
  }, [runId]);

  const kidById = (id?: number) => data?.kids.find((k) => k.id === id);
  const kid = kidById(Number(router.query.item)) || data?.kids.find((k) => k.chores.some((c) => c.id === runId)) || kidById(selectedId) || data?.kids[0];

  return (
    <ParentShell
      title="Today"
      list={
        data ? (
          <KidList onSelectKid={setSelectedKid} selectedKid={kid} />
        ) : null
      }
      phone={
        data?.kids.length ? (
          <>
            <div className="pt-phone-tabs">
              <SegmentedControl
                label="Today view"
                value={phoneTab}
                onChange={setPhoneTab}
                options={[
                  { value: "today", label: "Today" },
                  { value: "needs", label: `Needs you · ${needs.length}` },
                ]}
              />
            </div>
            {!showNeeds && <KidStrip kids={data.kids} selected={kid?.id} onSelect={setSelectedKid} />}
          </>
        ) : data ? (
          <></> // no kids: phone shows the detail's "Add your first kid" state, not an empty list
        ) : undefined
      }
    >
      {isError && !data && <ErrorPanel kind="unreachable" error={error} onRetry={() => refetch()} />}
      {!data && !isError && <Skeleton rows={4} />}
      {showNeeds && (
        <div className="p-today-detail">
          <NeedsYouList items={needs} />
        </div>
      )}
      {data && data.kids.length === 0 && (
        <EmptyState
          icon="person_add"
          title="Add your first kid"
          body="Then give them chores and devices. Takes about a minute."
          actions={[
            { label: 'Add a kid', icon: 'person_add', href: '/kids?section=kids' },
            { label: 'Run setup', icon: 'auto_fix_high', href: '/setup' },
          ]}
        />
      )}
      {data && kid && !showNeeds && (
        <div className="p-today-detail">
          <GetStartingChecklistCard kids={data.kids} />
          <div className="pt-head">
            <h2>{kid.name}&apos;s day</h2>
            <div className="pt-head-acts">
              <Link href={viewAs(kid.id, router.asPath)} className="p-btn">
                <Icon name="visibility" size={17} />
                View as kid
              </Link>
              <Link href={`/kids?section=chores&kid=${kid.id}`} className="p-btn" data-variant="accent">
                <Icon name="add" size={17} />
                Add chore
              </Link>
            </div>
          </div>

          <div className="pt-prog">
            <div className="pt-bar">
              <i style={{ width: `${kid.total ? ((kid.done ?? 0) / kid.total) * 100 : 0}%` }} />
            </div>
            {kid.done ?? 0} of {kid.total ?? 0} done
          </div>
          {/* desktop shows these on the selected kid card */}
          <div className="pt-phone-facts">
            <KidFacts kid={kid} />
          </div>

          <TipsContainer tips={PARENT_TIPS} maxTips={1} />

          {kid.chores.length === 0 && (
            <EmptyState
              icon="event_available"
              title={`Nothing for ${kid.name ?? 'them'} today`}
              body="No chores are due today. Their devices follow the schedule only."
              actions={[{ label: 'Add a chore', icon: 'add', href: `/kids?section=chores&kid=${kid.id}` }]}
            />
          )}
          {kid.chores.length > 0 && (
            <div className="pt-box">
              {kid.chores.map((chore) => (
                <ChoreRow
                  key={chore.id}
                  chore={chore}
                  kid={kid}
                  isOpen={openChoreId === chore.id}
                  onToggle={() => setOpenChoreId(openChoreId === chore.id ? null : chore.id)}
                />
              ))}
            </div>
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
                  <span className="p-summary-value">{clock(kid.last_active)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ParentShell>
  );
}
