"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatDateLabel, getAdminEventLink, parseEventDate, type EventItem } from "@/lib/events";

type CalendarViewProps = {
  events: EventItem[];
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function CalendarView({ events }: CalendarViewProps) {
  const now = useMemo(() => new Date(), []);
  const firstDay = startOfMonth(now);
  const lastDay = endOfMonth(now);
  const daysInGrid = useMemo(() => {
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(now.getFullYear(), now.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDay, lastDay, now]);

  const monthEvents = events.filter((event) => parseEventDate(event.date).getMonth() === now.getMonth() && parseEventDate(event.date).getFullYear() === now.getFullYear());
  const upcoming = [...events].sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime()).slice(0, 5);

  return (
    <div className="booking-grid">
      <div className="summary-card">
        <p className="panel-kicker">Month</p>
        <strong>{now.toLocaleDateString(undefined, { month: "long" })}</strong>
        <div className="summary-stat">{monthEvents.length} events scheduled this month</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Next date</p>
        <strong>{upcoming[0] ? formatDateLabel(upcoming[0].date).day : "--"}</strong>
        <div className="summary-stat">{upcoming[0] ? upcoming[0].title : "No scheduled events"}</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Visible events</p>
        <strong>{events.length}</strong>
        <div className="summary-stat">Across the booking board</div>
      </div>

      <div className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="calendar-head" style={{ padding: "18px 20px 0" }}>
          <div>
            <p className="panel-kicker">Calendar</p>
            <h3>Monthly schedule</h3>
          </div>
          <div className="faint mono">{now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        </div>
        <div className="panel-body">
          <div className="calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="calendar-day" style={{ minHeight: "auto", background: "transparent", border: "none", padding: "0 14px 6px" }}>
                <div className="day-no" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  {day}
                </div>
              </div>
            ))}
            {daysInGrid.map((day, index) => {
              if (!day) {
                return <div key={`blank-${index}`} className="calendar-day" style={{ opacity: 0.45 }} />;
              }

              const label = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const matches = events.filter((event) => event.date === label);
              return (
                <div className="calendar-day" key={label}>
                  <div className="day-no">{day.getDate()}</div>
                  <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                    {matches.slice(0, 2).map((event) => (
                      <div className="event-dot" key={event.id}>
                        <Link href={getAdminEventLink(event)}>{event.title}</Link>
                      </div>
                    ))}
                    {matches.length > 2 ? <div className="calendar-sub">+{matches.length - 2} more</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
