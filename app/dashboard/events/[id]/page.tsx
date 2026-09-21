"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EventWizard } from "@/components/events/EventWizard";
import { requireAuth } from "@/lib/auth";

export default function ManageEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
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
      <AppShell title="Manage event" subtitle="Edit any step — the booking link stays the same once it's published.">
        <EventWizard eventId={params.id} onToast={setToast} />
      </AppShell>
      <FeedbackNotice message={toast} />
    </>
  );
}
