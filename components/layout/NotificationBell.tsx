"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faCheckDouble } from "@fortawesome/free-solid-svg-icons";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type AppNotification,
} from "@/lib/rbac";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const count = await unreadNotificationCount();
        if (active) setUnread(count);
      } catch {
        // Silently ignore — the bell just won't show a count this cycle.
      }
    };
    void poll();
    const interval = window.setInterval(poll, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && !items) {
      try {
        setItems(await listNotifications());
      } catch {
        setItems([]);
      }
    }
  };

  const handleMarkRead = async (notification: AppNotification) => {
    if (notification.read) return;
    setItems((current) => (current ?? []).map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    setUnread((current) => Math.max(0, current - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      // Best-effort — a stale read-state on failure isn't worth surfacing.
    }
  };

  const handleMarkAll = async () => {
    setItems((current) => (current ?? []).map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      // Best-effort.
    }
  };

  return (
    <div className="notification-bell-wrap" ref={ref}>
      <button type="button" className="btn-icon" aria-label="Notifications" aria-haspopup="true" aria-expanded={open} onClick={toggleOpen}>
        <FontAwesomeIcon icon={faBell} />
        {unread > 0 ? <span className="notification-dot">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      {open ? (
        <div className="notification-menu" role="menu">
          <div className="notification-menu-head">
            <p className="accent-menu-title">Notifications</p>
            {items && items.some((n) => !n.read) ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleMarkAll}>
                <FontAwesomeIcon icon={faCheckDouble} /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="notification-list">
            {items === null ? (
              <p className="hint" style={{ padding: "14px" }}>Loading…</p>
            ) : items.length === 0 ? (
              <p className="hint" style={{ padding: "14px" }}>No notifications yet.</p>
            ) : (
              items.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={`notification-row ${notification.read ? "" : "unread"}`}
                  onClick={() => handleMarkRead(notification)}
                >
                  <strong>{notification.title}</strong>
                  <span className="hint">{notification.message}</span>
                  <span className="notification-time">{timeAgo(notification.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
