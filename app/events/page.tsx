"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faLocationDot,
  faMagnifyingGlass,
  faTicket,
  faArrowRight,
  faUsers,
  faStar,
  faBolt,
} from "@fortawesome/free-solid-svg-icons";
import { PublicTopBar } from "@/components/layout/PublicTopBar";
import { listPublicEvents, parseEventDate, CATEGORY_COLORS, type EventCategory, type EventItem } from "@/lib/events";

const ASSET_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
const CATEGORIES: EventCategory[] = ["Music", "Conference", "Workshop", "Sports", "Festival", "Community"];

export default function PublicEventsLandingPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listPublicEvents({ search: search || undefined, category: category || undefined });
        if (active) setEvents(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [search, category]);

  const sorted = useMemo(
    () => [...events].sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime()),
    [events],
  );

  const totalEvents = events.length;
  const freeEvents = events.filter((e) => e.price === 0).length;
  const upcomingEvents = events.filter((e) => parseEventDate(e.date).getTime() > Date.now()).length;

  return (
    <div className="public-shell">
      <PublicTopBar />

      {/* ─── Hero Section ─── */}
      <section className="public-hero">
        <span className="kicker">
          <FontAwesomeIcon icon={faBolt} /> Live Events Platform
        </span>
        <h1>Discover experiences that <em>move you</em>.</h1>
        <p>
          Browse curated events near you, reserve your spot instantly, and be part of something extraordinary — no
          account required.
        </p>

        {/* Stats strip */}
        <div className="public-stats-strip">
          <div className="stat-cell">
            <div className="stat-num">{totalEvents}</div>
            <div className="stat-lbl">Events</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">{upcomingEvents}</div>
            <div className="stat-lbl">Upcoming</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">{freeEvents}</div>
            <div className="stat-lbl">Free</div>
          </div>
        </div>
      </section>

      {/* ─── Category Chips ─── */}
      <div className="public-categories">
        <button
          type="button"
          className={`category-chip ${category === "" ? "active" : ""}`}
          onClick={() => setCategory("")}
        >
          <FontAwesomeIcon icon={faStar} /> All Events
        </button>
        {CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat}
            className={`category-chip ${category === cat ? "active" : ""}`}
            onClick={() => setCategory(category === cat ? "" : cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ─── Search & Filters ─── */}
      <div className="public-filters">
        <div className="search-glass">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by event name, venue, or host…"
            aria-label="Search events"
          />
        </div>
      </div>

      {/* Result count */}
      {!loading && (
        <div className="public-result-count">
          Showing <strong>{sorted.length}</strong> event{sorted.length !== 1 ? "s" : ""}
          {category ? ` in ${category}` : ""}
          {search ? ` matching "${search}"` : ""}
        </div>
      )}

      {/* ─── Events Grid ─── */}
      {loading ? (
        <div className="public-loading">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="shimmer-card" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="public-empty">
          <div className="empty-icon">
            <FontAwesomeIcon icon={faTicket} />
          </div>
          <p>No events match your search right now — try a different keyword or category.</p>
        </div>
      ) : (
        <div className="public-events-grid">
          {sorted.map((event) => (
            <Link key={event.id} href={`/events/${event.slug}`} className="public-event-card">
              <div
                className="thumb"
                style={{
                  background: event.banners[0]
                    ? undefined
                    : `linear-gradient(135deg, ${CATEGORY_COLORS[event.category]}44, ${CATEGORY_COLORS[event.category]}11)`,
                }}
              >
                {event.banners[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${ASSET_ORIGIN}${event.banners[0]}`} alt="" />
                ) : null}
                <span className="badge">{event.category}</span>
                {event.status === "completed" ? (
                  <span className="badge completed">Completed</span>
                ) : (
                  <span className="price-badge">
                    {event.price > 0 ? `₹${event.price.toLocaleString()}` : "Free"}
                  </span>
                )}
              </div>
              <div className="body">
                <h3>{event.title}</h3>
                <div className="meta-line">
                  <FontAwesomeIcon icon={faCalendarDays} />
                  {parseEventDate(event.date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {event.time}
                </div>
                <div className="meta-line">
                  <FontAwesomeIcon icon={faLocationDot} />
                  {event.venue || "Venue to be announced"}
                </div>
                <div className="price-row">
                  <span className="price">
                    {event.price > 0 ? `₹${event.price.toLocaleString()}` : "Free Entry"}
                  </span>
                  <span className="register-arrow">
                    {event.status === "completed" ? (
                      "Event Completed"
                    ) : event.status === "sold-out" ? (
                      "Sold Out"
                    ) : (
                      <>
                        Register <FontAwesomeIcon icon={faArrowRight} />
                      </>
                    )}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
