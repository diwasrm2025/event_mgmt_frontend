"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EventAttendeesView } from "@/components/bookings/EventAttendeesView";
import { requireAuth } from "@/lib/auth";
import { getEvent, type EventItem } from "@/lib/events";

export default function EventAttendeesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null | undefined>(undefined);

  useEffect(() => {
    const session = requireAuth();
    if (!session) router.replace("/signin");
  }, [router]);

  useEffect(() => {
    (async () => {
      const loaded = await getEvent(params.id);
      setEvent(loaded);
    })();
  }, [params.id]);

  return (
    <AppShell title="Attendees" subtitle="Everyone who has booked this event, with payment and registration details.">
      {event === undefined ? (
        <div className="empty-state">Loading attendees...</div>
      ) : event === null ? (
        <div className="panel">
          <div className="panel-body empty-state">
            <div className="glyph">Tickets</div>
            This event could not be found.
          </div>
        </div>
      ) : (
        <EventAttendeesView event={event} />
      )}
    </AppShell>
  );
}
