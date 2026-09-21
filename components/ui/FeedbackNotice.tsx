"use client";
import { useEffect, useRef } from "react";
import { notify, type SwalIcon } from "@/lib/swal";

export function FeedbackNotice({ message, icon }: { message: string; icon?: SwalIcon }) {
  const previous = useRef("");
  useEffect(() => {
    if (message && message !== previous.current) void notify(message, icon);
    previous.current = message;
  }, [message, icon]);
  return null;
}
