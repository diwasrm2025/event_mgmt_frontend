"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BookingsView } from "@/components/bookings/BookingsView";
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

export default function BookingsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [toast, setToast] = useState("");
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
        setToast("Could not load bookings.");
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
          <p className="panel-kicker">Booked</p>
          <strong>{stats.attendees}</strong>
          <div className="summary-stat">Seats reserved across events</div>
        </div>
        <div className="summary-card">
          <p className="panel-kicker">Check-ins</p>
          <strong>{stats.checkIns}</strong>
          <div className="summary-stat">Estimated attendees on site</div>
        </div>
        <div className="summary-card">
          <p className="panel-kicker">Utilization</p>
          <strong>{Math.round(stats.fillRate * 100)}%</strong>
          <div className="summary-stat">Inventory health indicator</div>
        </div>
      </>
    ),
    [stats.attendees, stats.checkIns, stats.fillRate],
  );

  return (
    <>
      <AppShell title="Bookings" subtitle="Monitor bookings and capacity across the full event portfolio." rightRail={rightRail}>
        <BookingsView events={events} />
      </AppShell>
      <FeedbackNotice message={toast} />
    </>
  );
}
