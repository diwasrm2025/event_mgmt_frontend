"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { allEvents, getActivityLog, getStats, type ActivityItem, type EventItem } from "@/lib/events";
import { requireAuth } from "@/lib/auth";
import {
  faPhone,
  faVideo,
  faEllipsisVertical,
  faXmark,
  faArrowRight,
  faGlobe,
  faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
const emptyStats = {
  total: 0,
  upcoming: 0,
  attendees: 0,
  capacity: 0,
  fillRate: 0,
  revenue: 0,
  checkIns: 0,
};

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [toast, setToast] = useState("");
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);

  useEffect(() => {
    const session = requireAuth();
    if (!session) {
      router.replace("/signin");
      return;
    }
    setShowCreatePrompt(true);
    (async () => {
      try {
        const [eventList, activityList] = await Promise.all([allEvents(), getActivityLog()]);
        setEvents(eventList);
        setStats(getStats(eventList));
        setActivity(activityList);
      } catch {
        setToast("Could not load your dashboard data.");
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
        <div className="profile-card">
          <div className="cover" />
          <div className="avatar-lg">DO</div>
          <div className="who">
            <div className="name">Demo Organizer</div>
            <div className="handle">demo@stubline.app</div>
          </div>
          <div className="profile-actions">
            <button
              className="icon-btn"
              onClick={() => setToast("Customer support is not wired to a backend yet.")}
              aria-label="Call"
            >
              <FontAwesomeIcon icon={faPhone} />
            </button>

            <button
              className="icon-btn"
              onClick={() => setToast("Live video sync is not connected yet.")}
              aria-label="Video call"
            >
              <FontAwesomeIcon icon={faVideo} />
            </button>

            <button
              className="icon-btn"
              onClick={() => setToast("More organizer tools will sit here later.")}
              aria-label="More"
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </button>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Quick links</p>
              <h3>Booking center</h3>
            </div>
          </div>
          <div className="panel-body">
            <div className="checklist">
              <Link href="/dashboard/events" className="side-link" style={{ paddingLeft: 0, paddingRight: 0 }}>
                Manage events
              </Link>
              <Link href="/bookings" className="side-link" style={{ paddingLeft: 0, paddingRight: 0 }}>
                Inspect bookings
              </Link>
              <Link href="/analytics" className="side-link" style={{ paddingLeft: 0, paddingRight: 0 }}>
                Review analytics
              </Link>
            </div>
          </div>
        </div>
        <div>
          <p className="rail-eyebrow">Activity</p>
          <div className="activity-feed">
            {activity.length ? (
              activity.slice(0, 8).map((item) => (
                <div className="activity-item" key={`${item.title}-${item.at}`}>
                  <div
                    className="aa"
                    style={{
                      background:
                        item.action === "created"
                          ? "linear-gradient(135deg,var(--accent),var(--accent-2))"
                          : item.action === "updated"
                            ? "linear-gradient(135deg,#38bdf8,#22c55e)"
                            : "linear-gradient(135deg,#f43f5e,#fb7185)",
                    }}
                  >
                    {(item.title || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="abody">
                    <div className="aline">
                      <b>You</b> {item.action} <b>{item.title}</b>
                    </div>
                    <div className="atime">{new Date(item.at).toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="faint" style={{ fontSize: "13px" }}>
                No activity yet. Changes will show up here as you edit events.
              </p>
            )}
          </div>
        </div>
      </>
    ),
    [activity],
  );

  return (
    <>
      <AppShell title="Dashboard" subtitle="Track bookings, revenue, and event health in one place." actions={<Link href="/dashboard/events" className="btn btn-accent btn-sm">New event</Link>}>
        <DashboardView events={events} stats={stats} activity={activity} onToast={setToast} />
      </AppShell>
      {toast ? (
        <div className="toast-wrap">
          <div className="toast">
            <span className="tdot" />
            <span>{toast}</span>
          </div>
        </div>
      ) : null}
      {showCreatePrompt ? (
        <div className="dashboard-create-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dashboard-create-title">
          <div className="dashboard-create-modal">
            <button className="dashboard-create-close" type="button" onClick={() => setShowCreatePrompt(false)} aria-label="Close create event prompt">
              <FontAwesomeIcon icon={faXmark} style={{fontSize:'23px',fontWeight:'800'}} />
            </button>
            <div className="dashboard-create-orbit" aria-hidden="true"><span /><span /><span /></div>
            <div className="dashboard-create-kicker">Your next experience starts here</div>
            <h2 id="dashboard-create-title">Ready to Start</h2>
            <button className="dashboard-create-primary" type="button" onClick={() => router.push("/dashboard/events/new")}>
              Create a new event <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <div className="dashboard-create-options" aria-label="Event format examples">
              <span onClick={() => router.push("/dashboard/events/new")}><FontAwesomeIcon icon={faGlobe} /> Online event with a joining link</span>
              <span onClick={() => router.push("/dashboard/events/new")}><FontAwesomeIcon icon={faLocationDot} /> Offline event at a venue</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
