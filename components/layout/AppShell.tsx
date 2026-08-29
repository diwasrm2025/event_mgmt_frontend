"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, initials, logOut, refreshSession, type SessionUser } from "@/lib/auth";
import { Swal } from "@/lib/swal";
import { NotificationBell } from "./NotificationBell";
import { ACCENT_OPTIONS, type ThemeMode } from "@/lib/themePrefs";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  faSun,
  faMoon,
  faCheck,
  faChevronDown,
  faBars,
  faGaugeHigh,
  faTicket,
  faUsers,
  faChartColumn,
  faCalendarDays,
  faGear,
  faRightFromBracket,
  faUserShield,
  faChevronLeft,
  faChevronRight,
  faCalendarCheck,
  faBell,
  faPlus,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { allEvents } from "@/lib/events";

function TopbarClock() {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const datePart = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short",year:"numeric" });
      const timePart = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      setTimeStr(`${datePart} • ${timePart}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) return null;

  return (
    <div
      className="topbar-clock"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text)",
        background: "var(--surface-soft)",
        padding: "6px 12px",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      <FontAwesomeIcon icon={faClock} style={{ opacity: 0.75, color: "var(--accent)" }} />
      <span>{timeStr}</span>
    </div>
  );
}

const ASSET_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

function getAvatarUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${ASSET_ORIGIN}${url}`;
}

declare global {
  interface Window {
    showToast?: (message: string) => void;
  }
}

type AppShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  profileName?: string;
  profileRole?: string;
  actions?: ReactNode;
  children: ReactNode;
  rightRail?: ReactNode;
};

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/events", label: "Events", icon: "ticket" },
  { href: "/bookings", label: "Bookings", icon: "users" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];

function formatRoleName(role?: string) {
  if (!role) return "";
  return role
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "ticket":
      return <FontAwesomeIcon icon={faTicket} />;
    case "users":
      return <FontAwesomeIcon icon={faUsers} />;
    case "chart":
      return <FontAwesomeIcon icon={faChartColumn} />;
    case "calendar":
      return <FontAwesomeIcon icon={faCalendarDays} />;
    default:
      return <FontAwesomeIcon icon={faGaugeHigh} />;
  }
}

export function AppShell({
  title,
  subtitle,
  eyebrow = "Workspace",
  profileName = "Demo Organizer",
  profileRole = "Organizer",
  actions,
  children,
  rightRail,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [accentMenuOpen, setAccentMenuOpen] = useState(false);
  const accentPickerRef = useRef<HTMLDivElement>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    setUser(getSession());
    refreshSession().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  // Fetch live event stats for right rail
  useEffect(() => {
    allEvents().then((events) => {
      const now = new Date();
      const upcoming = events.filter((e) => e.status === "published" && new Date(e.date + "T00:00:00") >= now);
      setUpcomingCount(upcoming.length);
      const rev = events.reduce((sum, e) => sum + e.attendees * e.price, 0);
      setTotalRevenue(rev);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setAccentMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accentMenuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (accentPickerRef.current && !accentPickerRef.current.contains(event.target as Node)) {
        setAccentMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccentMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [accentMenuOpen]);

  useEffect(() => {
    const handleToast = (message: string) => {
      let wrap = document.querySelector(".toast-wrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "toast-wrap";
        document.body.appendChild(wrap);
      }

      const toast = document.createElement("div");
      toast.className = "toast";
      toast.innerHTML = '<span class="tdot"></span><span>' + message + "</span>";
      wrap.appendChild(toast);

      window.setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.2s ease";
        window.setTimeout(() => toast.remove(), 220);
      }, 2400);
    };

    window.showToast = handleToast;
    return () => {
      delete window.showToast;
    };
  }, []);

  const currentPath = useMemo(() => pathname || "/", [pathname]);
  const activeNav = navigation.find((item) => item.href === currentPath) || navigation[0];
  const profile = user || { name: profileName, email: "demo@pulseframe.app", avatarUrl: null, role: profileRole, permissions: [] };

  const sidebarWidth = collapsed ? "72px" : "240px";

  return (
    <div className="dash-page page-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="dash-shell" style={{ gridTemplateColumns: `${sidebarWidth} minmax(0, 1fr)` }}>
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className={`sidebar ${mobileOpen ? "open" : ""} ${collapsed ? "collapsed" : "expanded"}`}>

          {/* Brand */}
          <div className="side-brand">
            <span className="dot" />
            {!collapsed && <span className="brand-name">Pulseframe</span>}
          </div>

          {/* Collapse toggle */}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          </button>

          <nav>
            <div className="nav-group">
              {!collapsed && <p className="nav-label">Workspace</p>}
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`side-link ${collapsed ? "icon-only" : ""} ${currentPath === item.href ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <NavIcon name={item.icon} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
              {user?.role === "SUPER_ADMIN" || user?.permissions.includes("events:manage_all") ? (
                <Link
                  href="/super-admin"
                  title="Super Admin Portal"
                  className={`side-link ${collapsed ? "icon-only" : ""} ${currentPath.startsWith("/super-admin") ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <FontAwesomeIcon icon={faUserShield} />
                  {!collapsed && <span>Super Admin</span>}
                </Link>
              ) : user?.permissions.includes("users:manage") || user?.permissions.includes("roles:manage") ? (
                <Link
                  href="/dashboard/admin"
                  title="Admin"
                  className={`side-link ${collapsed ? "icon-only" : ""} ${currentPath.startsWith("/dashboard/admin") ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <FontAwesomeIcon icon={faUserShield} />
                  {!collapsed && <span>Admin</span>}
                </Link>
              ) : null}
            </div>

            <div className="nav-group">
              {!collapsed && <p className="nav-label">Account</p>}
              <Link
                href="/dashboard/settings"
                title="Settings"
                className={`side-link ${collapsed ? "icon-only" : ""} ${currentPath === "/dashboard/settings" ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <FontAwesomeIcon icon={faGear} />
                {!collapsed && <span>Settings</span>}
              </Link>

              <button
                type="button"
                title="Sign out"
                className={`side-link ${collapsed ? "icon-only" : ""}`}
                onClick={async () => {
                  const res = await Swal.logout();
                  if (res.isConfirmed) {
                    logOut();
                  }
                }}
              >
                <FontAwesomeIcon icon={faRightFromBracket} />
                {!collapsed && <span>Sign out</span>}
              </button>
            </div>
          </nav>

          <div className="side-foot">
            <div className={`user-chip ${collapsed ? "mini" : ""}`}>
              <div className="avatar">
                {getAvatarUrl(user?.avatarUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getAvatarUrl(user?.avatarUrl)!} alt="" style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }} />
                ) : (
                  initials(user?.name || "Demo Organizer")
                )}
              </div>
              {!collapsed && (
                <div className="user-info">
                  <div className="name">{user?.name || "Demo Organizer"}</div>
                  <div className="role">{formatRoleName(user?.role) || "Organizer"}</div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────── */}
        <main className="main">
          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-brand">
              <button className="menu-btn" aria-label="Toggle menu" onClick={() => setMobileOpen((open) => !open)}>
                <FontAwesomeIcon icon={faBars} />
              </button>
              <div className="brand-stack">
                <div className="page-heading">
                  <p className="page-kicker">{eyebrow}</p>
                  <h1>{title}</h1>
                </div>
              </div>
            </div>

            <div className="topbar-center">
                <TopbarClock/>
            </div>

            <div className="topbar-actions">
              {actions ? <div className="topbar-action-slot">{actions}</div> : null}
              <NotificationBell />
              <div className="theme-controls">
                {/* Light/Dark toggle */}
                <div className="theme-toggle" aria-label="Theme controls">
                  {(["light", "dark"] as ThemeMode[]).map((value) => (
                    <button
                      key={value}
                      className={theme === value ? "active" : ""}
                      aria-label={value === "light" ? "Light Mode" : "Dark Mode"}
                      title={value === "light" ? "Light Mode" : "Dark Mode"}
                      onClick={() => setTheme(value)}
                    >
                      <FontAwesomeIcon icon={value === "light" ? faSun : faMoon} />
                    </button>
                  ))}
                </div>

                {/* Accent color picker */}
                <div className="accent-picker-wrap" ref={accentPickerRef}>
                  <button
                    type="button"
                    className={`accent-picker ${accentMenuOpen ? "open" : ""}`}
                    aria-label="Color theme"
                    aria-haspopup="true"
                    aria-expanded={accentMenuOpen}
                    onClick={() => setAccentMenuOpen((open) => !open)}
                  >
                    <span className="palette-swatches-strip" style={{ width: 48, height: 16, borderRadius: 6 }}>
                      {(ACCENT_OPTIONS.find((o) => o.value === accent)?.palette ?? []).map((c, i) => (
                        <span key={i} className="palette-swatch-block" style={{ background: c }} />
                      ))}
                    </span>
                    <FontAwesomeIcon icon={faChevronDown} className="accent-picker-caret" />
                  </button>

                  {accentMenuOpen ? (
                    <div className="accent-menu" role="menu">
                      <p className="accent-menu-title">Color Theme</p>
                      <div className="accent-swatch-grid">
                        {ACCENT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={accent === option.value}
                            className={`accent-swatch ${accent === option.value ? "active" : ""}`}
                            style={{ "--swatch-color": option.swatch } as CSSProperties}
                            onClick={() => {
                              setAccent(option.value);
                              setAccentMenuOpen(false);
                            }}
                          >
                            <span className="palette-swatches-strip" style={{ width: 40, height: 14, borderRadius: 5 }}>
                              {option.palette.map((c, i) => (
                                <span key={i} className="palette-swatch-block" style={{ background: c }} />
                              ))}
                            </span>
                            <span>{option.label}</span>
                            {accent === option.value && (
                              <FontAwesomeIcon icon={faCheck} style={{ marginLeft: "auto", color: option.swatch }} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <span className="topbar-divider" aria-hidden="true" />
              <div className="profile-chip" onClick={() => router.push("/dashboard/settings")} style={{ cursor: "pointer" }}>
                <div className="profile-avatar">
                  {getAvatarUrl(profile.avatarUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getAvatarUrl(profile.avatarUrl)!} alt="" style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }} />
                  ) : (
                    initials(profile.name)
                  )}
                </div>
                <div className="profile-copy">
                  <div className="profile-name">{profile.name}</div>
                  <div className="profile-role">{formatRoleName(profile.role) || profileRole}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="content">
            <div className="layout-grid">
              <section className="content-stage">{children}</section>
              <aside className="content-rail">
                {rightRail || (
                  <DynamicRightRail
                    user={profile}
                    upcomingCount={upcomingCount}
                    totalRevenue={totalRevenue}
                    onNewEvent={() => router.push("/dashboard/events/new")}
                    onSettings={() => router.push("/dashboard/settings")}
                  />
                )}
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function DynamicRightRail({
  user,
  upcomingCount,
  totalRevenue,
  onNewEvent,
  onSettings,
}: {
  user: { name: string; email: string; avatarUrl: string | null; role: string };
  upcomingCount: number;
  totalRevenue: number;
  onNewEvent: () => void;
  onSettings: () => void;
}) {
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const avatarSrc = getAvatarUrl(user.avatarUrl);

  return (
    <>
      {/* Profile Card */}
      <div className="profile-card dynamic-profile">
        <div className="profile-card-cover" style={{ background: "var(--theme-c3)" }} />
        <div className="profile-card-body">
          <div className="profile-card-avatar">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt={user.name} style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }} />
            ) : (
              <span className="profile-card-initials">{initials(user.name)}</span>
            )}
          </div>
          <div className="profile-card-info">
            <p className="profile-card-greeting">{greeting},</p>
            <h4 className="profile-card-name">{user.name}</h4>
            <div className="profile-card-email" style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 6 }}>{user.email}</div>
            <span className="badge" style={{ textTransform: "capitalize", fontSize: 11, padding: "3px 10px", background: "var(--accent-tint)", color: "var(--accent-strong)" }}>
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Live stats */}
      <div className="rail-stats-grid">
        <div className="rail-stat-card">
          <div className="rail-stat-icon upcoming">
            <FontAwesomeIcon icon={faCalendarCheck} />
          </div>
          <div>
            <div className="rail-stat-value">{upcomingCount}</div>
            <div className="rail-stat-label">Upcoming Events</div>
          </div>
        </div>
        <div className="rail-stat-card">
          <div className="rail-stat-icon revenue">
            <span style={{ fontWeight: 800, fontSize: 13 }}>₹</span>
          </div>
          <div>
            <div className="rail-stat-value">
              {totalRevenue > 0 ? `₹${totalRevenue.toLocaleString("en-IN")}` : "—"}
            </div>
            <div className="rail-stat-label">Total Revenue</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="summary-card">
        <p className="panel-kicker">Quick Actions</p>
        <div className="rail-quick-actions">
          <button className="rail-action-btn accent" onClick={onNewEvent}>
            <FontAwesomeIcon icon={faPlus} />
            <span>New Event</span>
          </button>
          <button className="rail-action-btn ghost" onClick={onSettings}>
            <FontAwesomeIcon icon={faGear} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Notifications CTA */}
      <div className="summary-card rail-notification-hint">
        <div className="rail-notif-icon">
          <FontAwesomeIcon icon={faBell} />
        </div>
        <div>
          <div className="rail-notif-title">Stay updated</div>
          <div className="hint">Check the bell icon to see your latest notifications in real-time.</div>
        </div>
      </div>
    </>
  );
}
