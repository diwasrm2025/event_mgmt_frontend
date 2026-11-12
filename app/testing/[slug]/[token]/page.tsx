"use client";

import { useParams } from "next/navigation";
import { PublicEventBooking } from "@/components/events/PublicEventBooking";

export default function TestingEventPage() {
  const params = useParams<{ slug: string; token: string }>();
  return <PublicEventBooking slug={params.slug} previewToken={params.token} />;
}
