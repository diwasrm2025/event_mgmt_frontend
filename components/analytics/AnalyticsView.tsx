"use client";

import { formatCurrency, getAnalyticsData, type EventItem } from "@/lib/events";

type AnalyticsViewProps = {
  events: EventItem[];
};

export function AnalyticsView({ events }: AnalyticsViewProps) {
  const stats = getAnalyticsData(events);
  const bookingMax = Math.max(...stats.bookings, 1);
  const revenueMax = Math.max(...stats.revenue, 1);
  const total = events.length || 1;

  return (
    <>
    <div className="analytics-grid">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Demand</p>
            <h3>Bookings by month</h3>
          </div>
        </div>
        <div className="panel-body">
          <div className="bar-chart">
            {stats.months.map((month, index) => (
              <div className="bar" key={month}>
                <div className="fill" style={{ height: `${Math.max(14, (stats.bookings[index] / bookingMax) * 160)}px` }} />
                <span>{month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Cash flow</p>
            <h3>Revenue by month</h3>
          </div>
        </div>
        <div className="panel-body">
          <div className="bar-chart">
            {stats.months.map((month, index) => (
              <div className="bar" key={month}>
                <div className="fill" style={{ height: `${Math.max(14, (stats.revenue[index] / revenueMax) * 160)}px`, background: "linear-gradient(180deg,var(--accent-2), var(--accent))" }} />
                <span>{month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    <div className="analytics-grid2">
       <div className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Mix</p>
            <h3>Category distribution</h3>
          </div>
        </div>
        <div className="panel-body">
          <div className="legend-list">
            {stats.byCategory.map((item) => (
              <div className="legend-row" key={item.label}>
                <span className="swatch" style={{ background: item.color }} />
                <span className="soft">{item.label}</span>
                <span className="amt">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Venue load</p>
            <h3>Top performing spaces</h3>
          </div>
        </div>
        <div className="panel-body">
          <div className="timeline-list">
            {stats.topVenues.length ? (
              stats.topVenues.map((venue) => (
                <div className="timeline-item" key={venue.venue}>
                  <span className="timeline-dot" />
                  <div style={{ minWidth: 0 }}>
                    <div className="event-title">{venue.venue}</div>
                    <div className="calendar-sub">
                      {venue.bookings} bookings . {formatCurrency(venue.revenue)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">Add events to populate venue data.</div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Overview</p>
            <h3>Snapshot and conversion rates</h3>
          </div>
        </div>
        <div className="panel-body">
          <div className="detail-grid">
            <div className="detail-card">
              <div className="label">Live events</div>
              <strong>{events.filter((event) => event.status === "published").length}</strong>
            </div>
            <div className="detail-card">
              <div className="label">Sold out</div>
              <strong>{events.filter((event) => event.status === "sold-out").length}</strong>
            </div>
            <div className="detail-card">
              <div className="label">Average fill</div>
              <strong>{Math.round((events.reduce((sum, event) => sum + event.attendees, 0) / Math.max(events.reduce((sum, event) => sum + event.capacity, 0), 1)) * 100)}%</strong>
            </div>
            <div className="detail-card">
              <div className="label">Total categories</div>
              <strong>{stats.byCategory.length}</strong>
            </div>
          </div>

          <div className="summary-list" style={{ marginTop: "18px" }}>
            {stats.byStatus.map((status) => {
              const pct = total ? status.value / total : 0;
              return (
                <div className="summary-line" key={status.label}>
                  <span className="soft" style={{ width: "88px", fontSize: "12px", textTransform: "capitalize" }}>
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
    </>
  );
}
