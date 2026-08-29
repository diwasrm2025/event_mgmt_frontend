"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserTie, faUsers, faClipboardList, faCircleCheck, faHourglassHalf } from "@fortawesome/free-solid-svg-icons";
import { getEventDashboard, type EventDashboardSummary as Summary } from "@/lib/rbac";

function initialsOf(name: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export function EventDashboardSummary({ eventId }: { eventId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let active = true;
    getEventDashboard(eventId)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        /* Non-owners without VIEW would already be blocked from this page entirely. */
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  if (!summary) return null;

  return (
    <div className="event-dashboard-summary">
      <div className="event-dashboard-stat">
        <span className="member-avatar">
          {summary.owner.avatarUrl ? <img src={summary.owner.avatarUrl} alt="" /> : initialsOf(summary.owner.name)}
        </span>
        <div>
          <span className="hint">Owner</span>
          <strong>{summary.owner.name}</strong>
        </div>
      </div>
      <div className="event-dashboard-stat">
        <FontAwesomeIcon icon={faUsers} />
        <div>
          <span className="hint">Shared members</span>
          <strong>{summary.sharedMembersCount}</strong>
        </div>
      </div>
      <div className="event-dashboard-stat">
        <FontAwesomeIcon icon={faClipboardList} />
        <div>
          <span className="hint">Registrations</span>
          <strong>{summary.totalRegistrations}</strong>
        </div>
      </div>
      <div className="event-dashboard-stat">
        <FontAwesomeIcon icon={faCircleCheck} />
        <div>
          <span className="hint">Checked in</span>
          <strong>{summary.checkedInAttendees}</strong>
        </div>
      </div>
      <div className="event-dashboard-stat">
        <FontAwesomeIcon icon={faHourglassHalf} />
        <div>
          <span className="hint">Pending</span>
          <strong>{summary.pendingRegistrations}</strong>
        </div>
      </div>
      <div className="event-dashboard-stat">
        <FontAwesomeIcon icon={faUserTie} />
        <div>
          <span className="hint">Last updated</span>
          <strong>{new Date(summary.updatedAt).toLocaleDateString()}</strong>
        </div>
      </div>
    </div>
  );
}
