"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_COLORS, formatCurrency, formatDateLabel, getAdminEventLink, parseEventDate, type EventItem } from "@/lib/events";
import { faXmark, faMagnifyingGlass, faUsers } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
type BookingsViewProps = {
  events: EventItem[];
};

export function BookingsView({ events }: BookingsViewProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  const rows = useMemo(() => {
    return [...events]
      .filter((event) => {
        const haystack = `${event.title} ${event.venue} ${event.host}`.toLowerCase();
        return !query || haystack.includes(query.toLowerCase());
      })
      .filter((event) => !status || event.status === status)
      .filter((event) => !category || event.category === category)
      .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
  }, [events, query, status, category]);

  const totalBooked = rows.reduce((sum, event) => sum + event.attendees, 0);
  const totalCapacity = rows.reduce((sum, event) => sum + event.capacity, 0);
  const totalRevenue = rows.reduce((sum, event) => sum + event.attendees * event.price, 0);
  const checkIns = rows.reduce((sum, event) => sum + Math.min(event.attendees, Math.round(event.attendees * 0.82)), 0);
  const filtersActive = Boolean(query || status || category);

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setCategory("");
  };

  return (
    <div className="booking-grid">
      <div className="summary-card">
        <p className="panel-kicker">Booked seats</p>
        <strong>{totalBooked}</strong>
        <div className="summary-stat">{totalCapacity ? Math.round((totalBooked / totalCapacity) * 100) : 0}% of total inventory</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Revenue</p>
        <strong>{formatCurrency(totalRevenue)}</strong>
        <div className="summary-stat">Across all event listings</div>
      </div>
      <div className="summary-card">
        <p className="panel-kicker">Check-ins</p>
        <strong>{checkIns}</strong>
        <div className="summary-stat">Estimated completed arrivals</div>
      </div>

      <div className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="toolbar">
          <div className="toolbar-search">
            <div className="search-box">
              <FontAwesomeIcon icon={faMagnifyingGlass} />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bookings, venues, hosts"
              />
            </div>
          </div>
          <div className="toolbar-filters">
            <select className="select-filter" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {Object.keys(CATEGORY_COLORS).map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
            <select className="select-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="sold-out">Sold out</option>
            </select>
            {filtersActive ? (
              <button
                type="button"
                className="filter-reset"
                onClick={clearFilters}
              >
                <FontAwesomeIcon icon={faXmark} />
                Clear
              </button>
            ) : null}
          </div>
          <div className="toolbar-meta">
            <span className="table-chip">
              Showing <strong>{rows.length}</strong>
            </span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Ownership / Access</th>
                <th>Booked</th>
                <th>Fill rate</th>
                <th>Revenue</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Members</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((event) => {
                  const date = formatDateLabel(event.date);
                  const fillRate = event.capacity ? Math.round((event.attendees / event.capacity) * 100) : 0;
                  const color = CATEGORY_COLORS[event.category] || "#999";
                  return (
                    <tr key={event.id}>
                      <td>
                        <div className="event-name-cell">
                          <div className="avatar-ring" style={{ width: 42, height: 42, flexShrink: 0 }}>
                            <div className="avatar-ring-inner">
                              {event.title.slice(0, 1).toUpperCase()}
                            </div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="event-title">
                              <Link href={getAdminEventLink(event)}>{event.title}</Link>
                            </div>
                            <div className="event-sub">{event.venue}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="date-block">
                          <span className="day">{date.day}</span>
                          <span className="event-sub">
                            {date.mon} {event.time}
                          </span>
                        </div>
                      </td>
                      <td>
                        {event.isOwner !== false ? (
                          <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                            Own
                          </span>
                        ) : (
                          <div>
                            <span className="badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                              Shared by {event.ownerName || event.host || "Organizer"}
                            </span>
                            {event.sharedPermissions?.length ? (
                              <div className="event-sub" style={{ fontSize: 11, marginTop: 4 }}>
                                Access: {event.sharedPermissions.join(", ")}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="mono">
                        {event.attendees}/{event.capacity}
                      </td>
                      <td className="mono">{fillRate}%</td>
                      <td className="mono">{formatCurrency(event.attendees * event.price)}</td>
                      <td>
                        <span className={`badge ${event.status}`}>{event.status}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`${getAdminEventLink(event)}/attendees`} className="btn btn-ghost btn-sm">
                          <FontAwesomeIcon icon={faUsers} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="glyph">Tickets</div>
                      No bookings match your filters. Try clearing them.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
