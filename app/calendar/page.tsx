"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CalendarView } from "@/components/calendar/CalendarView";
import { allEvents, parseEventDate, type EventItem } from "@/lib/events";
import { requireAuth } from "@/lib/auth";

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const session = requireAuth();
    if (!session) {
      router.replace("/signin");
      return;
    }
    (async () => {
      try {
        setEvents(await allEvents());
      } catch {
        setToast("Could not load the calendar.");
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
          <p className="panel-kicker">This month</p>
          <strong>{events.filter((event) => parseEventDate(event.date).getMonth() === new Date().getMonth()).length}</strong>
          <div className="summary-stat">Scheduled events in view</div>
        </div>
        <div className="summary-card">
          <p className="panel-kicker">Next month</p>
          <strong>{events.filter((event) => parseEventDate(event.date).getMonth() === new Date().getMonth() + 1).length}</strong>
          <div className="summary-stat">Future events already planned</div>
        </div>
      </>
    ),
    [events],
  );

  return (
    <>
      <AppShell title="Calendar" subtitle="Map every event into a clean monthly schedule." rightRail={rightRail}>
        <CalendarView events={events} />
      </AppShell>
      {toast ? (
        <div className="toast-wrap">
          <div className="toast">
            <span className="tdot" />
            <span>{toast}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
