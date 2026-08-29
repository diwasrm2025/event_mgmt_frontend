"use client";

import { useParams } from "next/navigation";
import { PublicEventBooking } from "@/components/events/PublicEventBooking";

export default function PublicEventPage() {
  const params = useParams<{ slug: string }>();
  return <PublicEventBooking slug={params.slug} />;
}
