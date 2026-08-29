"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EventWizard } from "@/components/events/EventWizard";
import { requireAuth } from "@/lib/auth";

export default function NewEventPage() {
  const router = useRouter();
  const [toast, setToast] = useState("");

  useEffect(() => {
    const session = requireAuth();
    if (!session) router.replace("/signin");
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <>
      <AppShell title="New event" subtitle="Build your event step by step — the booking link is generated at the end.">
        <EventWizard onToast={setToast} />
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
