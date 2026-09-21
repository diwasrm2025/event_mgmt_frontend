"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { allEvents, getStats, type EventItem } from "@/lib/events";
import { requireAuth } from "@/lib/auth";

const emptyStats = {
  total: 0,
  upcoming: 0,
  attendees: 0,
  capacity: 0,
  fillRate: 0,
  revenue: 0,
  checkIns: 0,
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stats, setStats] = useState(emptyStats);

  useEffect(() => {
    const session = requireAuth();
    if (!session) {
      router.replace("/signin");
      return;
    }
    (async () => {
      try {
        const eventList = await allEvents();
        setEvents(eventList);
        setStats(getStats(eventList));
      } catch {
        setToast("Could not load analytics.");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const rightRail = useMemo(
    () => (
      <>
        <div className="summary-card">
          <p className="panel-kicker">Portfolio</p>
          <strong>{stats.total}</strong>
          <div className="summary-stat">Events tracked in your workspace</div>
        </div>
        <div className="summary-card">
          <p className="panel-kicker">Fill rate</p>
          <strong>{Math.round(stats.fillRate * 100)}%</strong>
          <div className="summary-stat">Overall seat utilization</div>
        </div>
        <div className="summary-card">
          <p className="panel-kicker">Revenue</p>
          <strong>${stats.revenue.toLocaleString()}</strong>
          <div className="summary-stat">Estimated ticket sales</div>
        </div>
      </>
    ),
    [stats.fillRate, stats.revenue, stats.total],
  );

  return (
    <>
      <AppShell title="Analytics" subtitle="See bookings, venue load, and category mix at a glance." actions={null} rightRail={rightRail}>
        <AnalyticsView events={events} />
      </AppShell>
      <FeedbackNotice message={toast} />
    </>
  );
}
