"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EventsView } from "@/components/events/EventsView";
import { requireAuth } from "@/lib/auth";

export default function CompletedEventsPage() {
  const router = useRouter();
  const [toast, setToast] = useState("");

  useEffect(() => {
    const session = requireAuth();
    if (!session) {
      router.replace("/signin");
    }
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <>
      <AppShell
        title="Completed Events"
        subtitle="Review completed events and their booking history."
        actions={
          <button className="btn btn-accent btn-sm" onClick={() => window.dispatchEvent(new Event("open-event-modal"))}>
        <FontAwesomeIcon icon={faPlus} />
            New event
          </button>
        }
      >
        <EventsView onToast={setToast} completed />
      </AppShell>
      <FeedbackNotice message={toast} />
    </>
  );
}
