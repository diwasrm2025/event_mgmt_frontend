"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CATEGORY_COLORS,
  formatCurrency,
  formatDateLabel,
  formatPercent,
  getAdminEventLink,
  getAnalyticsData,
  parseEventDate,
  type ActivityItem,
  type EventItem,
} from "@/lib/events";
import {
  faCalendarDays,
  faUsers,
  faIndianRupeeSign,
  faChair,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

function StatCard({
  label,
  value,
  detail,
  icon,
  trend,
  color,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  trend?: string;
  color: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <div className="metric-icon">{icon}</div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span>{label}</span>
        {trend ? <span className="metric-trend">{trend}</span> : null}
      </div>
      <div className="summary-stat" style={{ marginTop: "8px" }}>
        {detail}
      </div>
    </div>
  );
}

type DashboardViewProps = {
  events: EventItem[];
  stats: {
    total: number;
    upcoming: number;
    attendees: number;
    capacity: number;
    fillRate: number;
    revenue: number;
    checkIns: number;
  };
  activity: ActivityItem[];
  onToast: (message: string) => void;
};

export function DashboardView({ events, stats, activity, onToast }: DashboardViewProps) {
  const analytics = getAnalyticsData(events);
  const months = analytics.months;
  const bookingMax = Math.max(...analytics.bookings, 1);
  const revenueMax = Math.max(...analytics.revenue, 1);
  const upcoming = [...events]
    .filter((event) => parseEventDate(event.date) >= new Date())
    .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime())
    .slice(0, 5);

  return (
    <>
      <div className="stat-grid">
        <StatCard
          label="Total events"
          value={stats.total}
          detail={`${stats.upcoming} upcoming this season`}
          trend="+ 12%"
          color="linear-gradient(135deg, rgba(124,92,255,.18), rgba(255,111,216,.18))"
          icon={<FontAwesomeIcon icon={faCalendarDays} />}
        />

        <StatCard
          label="Booked seats"
          value={stats.attendees}
          detail={`${formatPercent(stats.fillRate)} of total capacity filled`}
          trend="+ 8%"
          color="linear-gradient(135deg, rgba(16,185,129,.18), rgba(34,211,197,.18))"
          icon={<FontAwesomeIcon icon={faUsers} />}
        />

        <StatCard
          label="Ticket revenue"
          value={formatCurrency(stats.revenue)}
          detail={`${stats.checkIns} check-ins recorded`}
          trend="+ 21%"
          color="linear-gradient(135deg, rgba(245,158,11,.18), rgba(249,115,22,.18))"
          icon={<FontAwesomeIcon icon={faIndianRupeeSign} />}
        />

        <StatCard
          label="Capacity locked"
          value={`${formatPercent(stats.capacity ? stats.attendees / stats.capacity : 0)}`}
          detail={`${stats.capacity} total seats across the portfolio`}
          trend="Healthy"
          color="linear-gradient(135deg, rgba(56,189,248,.18), rgba(14,165,233,.18))"
          icon={<FontAwesomeIcon icon={faChair} />}
        />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Booking flow</p>
              <h3>Attendance and revenue by month</h3>
            </div>
            <div className="spacer" />
            <span className="faint mono" style={{ fontSize: "12px" }}>
              live snapshot
            </span>
          </div>
          <div className="panel-body">
            <div className="bar-chart">
              {months.map((month, index) => (
                <div className="bar" key={month}>
                  <div
                    className="fill"
                    style={{
                      height: `${Math.max(14, (analytics.bookings[index] / bookingMax) * 150)}px`,
                    }}
                    title={`${analytics.bookings[index]} booked seats`}
                  />
                  <div className="faint" style={{ fontSize: "11px" }}>
                    {month}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Portfolio mix</p>
              <h3>Events by category</h3>
            </div>
          </div>
          <div className="panel-body">
            <div className="legend-list">
              {analytics.byCategory.map((item) => (
                <div className="legend-row" key={item.label}>
                  <span className="swatch" style={{ background: item.color }} />
                  <span className="soft">{item.label}</span>
                  <span className="amt">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="summary-list" style={{ marginTop: "18px" }}>
              {analytics.byStatus.map((status) => {
                const pct = events.length ? status.value / events.length : 0;
                return (
                  <div className="summary-line" key={status.label}>
                    <span className="soft" style={{ width: "84px", fontSize: "12px", textTransform: "capitalize" }}>
                      {status.label}
                    </span>
                    <div className="summary-bar">
                      <span style={{ width: `${Math.max(8, pct * 100)}%` }} />
                    </div>
                    <span className="summary-stat">{status.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Upcoming</p>
              <h3>Next events to fill</h3>
            </div>
            <div className="spacer" />
            <Link href="/dashboard/events" className="btn btn-ghost btn-sm">
              Manage events
            </Link>
          </div>
          <div className="panel-body">
            <div className="mini-list">
              {upcoming.length ? (
                upcoming.map((event) => {
                  const date = formatDateLabel(event.date);
                  const color = CATEGORY_COLORS[event.category] || "#999";
                  return (
                    <div className="mini-row" key={event.id}>
                      <div className="mini-icon" style={{ background: `${color}1f`, color }}>
                        {event.title.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="mini-title">
                          <Link href={getAdminEventLink(event)} className="event-link">
                            {event.title}
                          </Link>
                        </div>
                        <div className="mini-sub">
                          {event.venue} . {date.full}
                        </div>
                      </div>
                      <div className={`mini-status ${event.status}`}>{event.status.replace("-", " ")}</div>
                      <div className="mini-time">{event.time}</div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">
                  <div className="glyph">Tickets</div>
                  No upcoming events yet. Create one to populate the schedule.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Revenue</p>
              <h3>Monthly sales snapshot</h3>
            </div>
          </div>
          <div className="panel-body">
            <div className="bar-chart">
              {months.map((month, index) => (
                <div className="bar" key={month}>
                  <div
                    className="fill"
                    style={{
                      height: `${Math.max(14, (analytics.revenue[index] / revenueMax) * 150)}px`,
                      background: "linear-gradient(180deg, var(--accent), rgba(255,255,255,.16))",
                    }}
                    title={formatCurrency(analytics.revenue[index])}
                  />
                  <div className="faint" style={{ fontSize: "11px" }}>
                    {month}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "16px" }}>
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Activity</p>
            <h3>Recent event changes</h3>
          </div>
          <div className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => onToast("Activity is synced from local storage.")}>
            Refresh
          </button>
        </div>
        <div className="panel-body">
          <div className="activity-feed">
            {activity.length ? (
              activity.slice(0, 8).map((item) => (
                <div className="activity-item" key={`${item.title}-${item.at}`}>
                  <div
                    className="aa"
                  >
                    {item.title.slice(0, 1).toUpperCase()}
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
                No activity yet. Create or edit an event and it will appear here.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
