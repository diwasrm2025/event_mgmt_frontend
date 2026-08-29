"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Swal } from "@/lib/swal";
import {
  faMagnifyingGlass,
  faXmark,
  faPenToSquare,
  faTrash,
  faLink,
  faUsers,
  faShareNodes,
  faBullhorn,
  faCalendarDays,
  faMapPin,
  faCircleCheck,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  allEvents,
  CATEGORY_COLORS,
  finalizeEvent,
  formatCurrency,
  formatDateLabel,
  getAdminEventLink,
  getEventLinkAbsolute,
  removeEvent,
  parseEventDate,
  type EventItem,
} from "@/lib/events";
import { SharedMembersPanel } from "./SharedMembersPanel";
import { getSession } from "@/lib/auth";

type EventsViewProps = {
  onToast: (message: string) => void;
};

function formatTime12hr(time: string): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function EventsView({ onToast }: EventsViewProps) {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [shareEventTarget, setShareEventTarget] = useState<EventItem | null>(null);

  const session = useMemo(() => getSession(), []);
  const isSuperAdmin = session?.permissions?.includes("events:manage_all") ?? false;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const list = await allEvents();
      setEvents(list);
    } catch {
      setLoadError("Could not load events. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const openHandler = () => router.push("/dashboard/events/new");
    window.addEventListener("open-event-modal", openHandler);
    return () => window.removeEventListener("open-event-modal", openHandler);
  }, [router]);

  const filteredEvents = useMemo(() => {
    return [...events]
      .filter((event) => {
        const haystack = `${event.title} ${event.venue} ${event.host}`.toLowerCase();
        return !query || haystack.includes(query.toLowerCase());
      })
      .filter((event) => !category || event.category === category)
      .filter((event) => !status || event.status === status)
      .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
  }, [events, query, category, status]);

  const filtersActive = Boolean(query || category || status);
  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setStatus("");
  };

  const handleDelete = async (event: EventItem) => {
    const res = await Swal.confirm(`Delete "${event.title}"?`, "This event will be permanently deleted.");
    if (!res.isConfirmed) return;
    try {
      await removeEvent(event.id);
      await loadEvents();
      onToast("Event deleted.");
    } catch {
      onToast("Could not delete this event.");
    }
  };

  const handlePublish = async (event: EventItem) => {
    try {
      await finalizeEvent(event.id, "published");
      await loadEvents();
      onToast(`"${event.title}" is now published.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not publish this event — check the wizard for missing fields.");
    }
  };

  const copyLink = async (event: EventItem) => {
    const url = getEventLinkAbsolute(event);
    if (!url) {
      onToast("Finish the wizard to generate this event's booking link.");
      return;
    }
    await navigator.clipboard.writeText(url);
    onToast("Booking link copied.");
  };

  // Determine permissions for each event
  function canEdit(event: EventItem) {
    if (isSuperAdmin) return true;
    if (event.isOwner !== false) return true;
    return event.sharedPermissions?.includes("EDIT") ?? false;
  }

  function canShare(event: EventItem) {
    if (isSuperAdmin) return true;
    return event.isOwner !== false;
  }

  function canDelete(event: EventItem) {
    if (isSuperAdmin) return true;
    return event.isOwner !== false;
  }

  function canViewAttendees(event: EventItem) {
    if (isSuperAdmin) return true;
    if (event.isOwner !== false) return true;
    return (event.sharedPermissions?.includes("ATTENDEE") || event.sharedPermissions?.includes("EDIT")) ?? false;
  }

  const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
    published: { bg: "rgba(16,185,129,0.12)", color: "#10b981", border: "rgba(16,185,129,0.3)", label: "Published" },
    draft: { bg: "rgba(148,163,184,0.15)", color: "#64748b", border: "rgba(148,163,184,0.3)", label: "Draft" },
    "sold-out": { bg: "rgba(239,68,68,0.12)", color: "#ef4444", border: "rgba(239,68,68,0.3)", label: "Sold Out" },
    completed: { bg: "rgba(99,102,241,0.12)", color: "#6366f1", border: "rgba(99,102,241,0.3)", label: "Completed" },
  };

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {/* Toolbar */}
      <div className="toolbar" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
        <div className="toolbar-search" style={{ flex: "1 1 220px", minWidth: 180 }}>
          <div className="search-box">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, venues, hosts…" />
          </div>
        </div>
        <div className="toolbar-filters" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="select-filter" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {Object.keys(CATEGORY_COLORS).map((name) => (
              <option value={name} key={name}>{name}</option>
            ))}
          </select>
          <select className="select-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="sold-out">Sold Out</option>
            <option value="completed">Completed</option>
          </select>
          {filtersActive ? (
            <button type="button" className="filter-reset" onClick={clearFilters}>
              <FontAwesomeIcon icon={faXmark} /> Clear
            </button>
          ) : null}
        </div>
        <div className="toolbar-meta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="table-chip">
            <strong>{filteredEvents.length}</strong> events
          </span>
          <Link href="/dashboard/events/new" className="btn btn-accent btn-sm">+ New event</Link>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", minWidth: 0 }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "var(--surface-soft)" }}>
              {["Event", "Date & Time", "Venue", "Access", "Fill Rate", "Price", "Status", "Actions"].map((h) => (
                <th key={h} style={{
                  padding: "10px 14px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-faint)",
                  borderBottom: "1px solid var(--border)",
                  textAlign: h === "Actions" ? "right" : "left",
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><div className="empty-state" style={{ padding: "48px 0" }}>Loading events…</div></td></tr>
            ) : loadError ? (
              <tr><td colSpan={8}><div className="empty-state" style={{ padding: "48px 0" }}>
                {loadError}{" "}
                <button type="button" className="btn btn-ghost btn-sm" onClick={loadEvents}>Retry</button>
              </div></td></tr>
            ) : !filteredEvents.length ? (
              <tr><td colSpan={8}><div className="empty-state" style={{ padding: "60px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
                <div style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 6 }}>No events found</div>
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Try clearing filters or create a new event.</div>
              </div></td></tr>
            ) : (
              filteredEvents.map((event, idx) => {
                const date = formatDateLabel(event.date);
                const color = CATEGORY_COLORS[event.category] || "#999";
                const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE["draft"];
                const fillRate = event.capacity > 0 ? Math.round((event.attendees / event.capacity) * 100) : 0;
                const isOwner = event.isOwner !== false;

                return (
                  <tr key={event.id} style={{
                    background: idx % 2 === 0 ? "var(--surface)" : "var(--surface-soft)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-tint)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "var(--surface)" : "var(--surface-soft)")}
                  >
                    {/* Event name */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 200 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          background: `linear-gradient(135deg, ${color}22, ${color}44)`,
                          border: `1.5px solid ${color}44`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, fontWeight: 800, color,
                        }}>
                          {event.title.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", lineHeight: 1.2 }}>
                            <Link href={getAdminEventLink(event)} style={{ color: "inherit", textDecoration: "none" }}>
                              {event.title || "Untitled draft"}
                            </Link>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                            <span style={{
                              display: "inline-block", background: `${color}22`, color,
                              padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                            }}>{event.category}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <FontAwesomeIcon icon={faCalendarDays} style={{ color: "var(--accent)", fontSize: 12 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{date.day} {date.mon}</div>
                          {event.time && (
                            <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
                              <FontAwesomeIcon icon={faClock} style={{ fontSize: 9 }} />
                              {formatTime12hr(event.time)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Venue */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                      {event.venue ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-soft)" }}>
                          <FontAwesomeIcon icon={faMapPin} style={{ color: "var(--accent)", fontSize: 11, flexShrink: 0 }} />
                          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.venue}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>
                      )}
                    </td>

                    {/* Access */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                      {isOwner ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "rgba(16,185,129,0.12)", color: "#10b981",
                          border: "1px solid rgba(16,185,129,0.25)", borderRadius: 999,
                          padding: "3px 9px", fontSize: 11, fontWeight: 700,
                        }}>
                          <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 9 }} /> Owner
                        </span>
                      ) : (
                        <div>
                          <span style={{
                            display: "inline-block", background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                            border: "1px solid rgba(245,158,11,0.25)", borderRadius: 999,
                            padding: "3px 9px", fontSize: 11, fontWeight: 700,
                          }}>Shared</span>
                          {event.sharedPermissions?.length ? (
                            <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>
                              {event.sharedPermissions.join(", ")}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* Fill Rate */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", minWidth: 100 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                        {event.attendees}/{event.capacity || "∞"}
                        {event.capacity > 0 && <span style={{ color: "var(--text-faint)", fontWeight: 400 }}> ({fillRate}%)</span>}
                      </div>
                      {event.capacity > 0 && (
                        <div style={{ height: 4, background: "var(--border-strong)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 999,
                            background: fillRate >= 90 ? "#ef4444" : fillRate >= 60 ? "#f59e0b" : "#10b981",
                            width: `${fillRate}%`,
                          }} />
                        </div>
                      )}
                    </td>

                    {/* Price */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap" }}>
                      {event.price > 0 ? formatCurrency(event.price) : <span style={{ color: "var(--success)", fontWeight: 600, fontSize: 12 }}>Free</span>}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                      <span style={{
                        display: "inline-block",
                        background: statusStyle.bg, color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}`,
                        borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                      }}>{statusStyle.label}</span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        {event.status === "draft" && canEdit(event) ? (
                          <button className="icon-btn has-tooltip" data-tooltip="Publish event"
                            onClick={() => handlePublish(event)} aria-label="Publish event"
                            style={{ color: "var(--success)" }}>
                            <FontAwesomeIcon icon={faBullhorn} />
                          </button>
                        ) : null}
                        {canShare(event) && (
                          <button className="icon-btn has-tooltip" data-tooltip="Manage shared access"
                            onClick={() => setShareEventTarget(event)} aria-label="Share event">
                            <FontAwesomeIcon icon={faShareNodes} />
                          </button>
                        )}
                        {event.slug && (
                          <button className="icon-btn has-tooltip" data-tooltip="Copy booking link"
                            onClick={() => copyLink(event)} aria-label="Copy booking link">
                            <FontAwesomeIcon icon={faLink} />
                          </button>
                        )}
                        {canViewAttendees(event) && (
                          <button className="icon-btn has-tooltip" data-tooltip="View attendees"
                            onClick={() => router.push(`${getAdminEventLink(event)}/attendees`)} aria-label="View attendees">
                            <FontAwesomeIcon icon={faUsers} />
                          </button>
                        )}
                        {canEdit(event) && (
                          <button className="icon-btn has-tooltip" data-tooltip="Edit event"
                            onClick={() => router.push(getAdminEventLink(event))} aria-label="Edit">
                            <FontAwesomeIcon icon={faPenToSquare} />
                          </button>
                        )}
                        {canDelete(event) && (
                          <button className="icon-btn danger has-tooltip" data-tooltip="Delete event"
                            onClick={() => handleDelete(event)} aria-label="Delete">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Share Modal — popup */}
      {shareEventTarget ? (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={() => setShareEventTarget(null)}
        >
          <div
            style={{
              background: "var(--surface)", borderRadius: 20, boxShadow: "0 32px 64px -20px rgba(0,0,0,0.35)",
              width: "100%", maxWidth: 700, maxHeight: "85vh", display: "flex", flexDirection: "column",
              overflow: "hidden", border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              background: "var(--surface-soft)", flexShrink: 0,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text)" }}>
                  <FontAwesomeIcon icon={faShareNodes} style={{ color: "var(--accent)", marginRight: 8 }} />
                  Shared Access
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-faint)" }}>
                  Manage who can access &ldquo;{shareEventTarget.title}&rdquo;
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShareEventTarget(null)} aria-label="Close"
                style={{ marginLeft: 12, flexShrink: 0 }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            {/* Modal body — scrollable */}
            <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
              <SharedMembersPanel eventId={shareEventTarget.id} onToast={onToast} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
