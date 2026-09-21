"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession, requireAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  ALL_PERMISSIONS,
  assignUserRole,
  createRole,
  deleteRole,
  listRoles,
  listUsers,
  listAllSystemEvents,
  updateRole,
  type AdminUser,
  type Role,
  type SystemEvent,
} from "@/lib/rbac";
import { Swal } from "@/lib/swal";
import { DataTablePagination } from "@/components/ui/DataTablePagination";

function formatRoleName(name: string) {
  return name
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"emails" | "events" | "roles">("emails");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Data states
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    const session = requireAuth();
    if (!session) {
      router.replace("/super-admin/signin");
      return;
    }
    const isSuperAdmin =
      session.role === "SUPER_ADMIN" ||
      session.permissions.includes("events:manage_all");
    if (!isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
    void loadAll();
  }, [router]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [evts, usrs, rls] = await Promise.all([
        listAllSystemEvents().catch(() => []),
        listUsers().catch(() => []),
        listRoles().catch(() => []),
      ]);
      setEvents(evts);
      setUsers(usrs);
      setRoles(rls);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load Super Admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const myId = useMemo(() => getSession()?.id, []);

  async function handleAssignRole(userId: string, roleId: string) {
    try {
      await assignUserRole(userId, roleId);
      setToast("User role updated successfully.");
      void loadAll();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Failed to assign role.");
    }
  }

  return (
    <AppShell
      title="Super Admin Dashboard"
      subtitle="Master control panel for platform events, roles, payment settings, and system notifications."
      eyebrow="Master Administration"
    >
      {/* Super Admin Stats Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="card" style={{ padding: "18px" }}>
          <div className="hint" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>System Emails</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--accent)" }}>5</div>
          <div className="hint" style={{ fontSize: "0.8rem" }}>Static templates active</div>
        </div>
        <div className="card" style={{ padding: "18px" }}>
          <div className="hint" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Receiving Currency</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#a78bfa" }}>₹ INR</div>
          <div className="hint" style={{ fontSize: "0.8rem" }}>Super Admin Payout</div>
        </div>
        <div className="card" style={{ padding: "18px" }}>
          <div className="hint" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total System Events</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#34d399" }}>{events.length}</div>
          <div className="hint" style={{ fontSize: "0.8rem" }}>Across system</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="panel" style={{ marginBottom: "20px" }}>
        <div className="panel-head" style={{ gap: "8px", flexWrap: "wrap" }}>
          <button
            className={`btn btn-sm ${tab === "emails" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("emails")}
          >
            📧 System Emails
          </button>
          <button
            style={{ display: "none" }}
            className="btn btn-sm btn-ghost"
            onClick={() => setTab("emails")}
          >
          </button>
          <button
            className={`btn btn-sm ${tab === "events" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("events")}
          >
            All Events ({events.length})
          </button>
          <button
            className={`btn btn-sm ${tab === "roles" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("roles")}
          >
            Users &amp; Roles
          </button>
        </div>
      </div>

      <FeedbackNotice message={error} icon="error" />

      {loading ? (
        <div className="empty-state">Loading Super Admin Data…</div>
      ) : tab === "emails" ? (
        <SystemEmailsTab />
      ) : tab === "events" ? (
        <EventsTab events={events} />
      ) : (
        <UsersAndRolesTab users={users} roles={roles} myId={myId} onAssignRole={handleAssignRole} onChanged={loadAll} onToast={setToast} />
      )}

      <FeedbackNotice message={toast} />
    </AppShell>
  );
}

/* =========================================================================
   1. SYSTEM EMAILS TAB — Static template overview (no DB required)
   ========================================================================= */
const SYSTEM_EMAIL_ENTRIES = [
  {
    icon: "🎟️",
    name: "Event Confirmation Ticket",
    category: "Booking Confirmation",
    desc: "Sent automatically to every attendee after a successful booking. Features a premium ticket design with event details, barcode, and entry instructions.",
    trigger: "On successful booking payment",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.09)",
  },
  {
    icon: "🎉",
    name: "New User Welcome",
    category: "Account Onboarding",
    desc: "Sent when a new user account is created. Includes their login email, role, and a sign-in link to the dashboard.",
    trigger: "On account creation",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.09)",
  },
  {
    icon: "🔑",
    name: "Shared Access Granted",
    category: "Access Management",
    desc: "Sent when a user is granted event access — includes the permissions list, event details, and a dashboard CTA.",
    trigger: "On event access grant",
    color: "#059669",
    bg: "rgba(5,150,105,0.09)",
  },
  {
    icon: "✏️",
    name: "Access Permissions Updated",
    category: "Access Management",
    desc: "Sent when a shared member's event permissions are modified. Shows the updated capabilities.",
    trigger: "On permission update",
    color: "#d97706",
    bg: "rgba(217,119,6,0.09)",
  },
  {
    icon: "📋",
    name: "Role Updated",
    category: "Account Notification",
    desc: "Sent when an admin changes a user's system role. Shows the previous and new role name.",
    trigger: "On role change",
    color: "#db2777",
    bg: "rgba(219,39,119,0.09)",
  },
];

function SystemEmailsTab() {
  return (
    <div>
    

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "14px" }}>
        {SYSTEM_EMAIL_ENTRIES.map((entry) => (
          <div
            key={entry.name}
            className="card"
            style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "10px", borderLeft: `3px solid ${entry.color}` }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: entry.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                  flexShrink: 0,
                }}
              >
                {entry.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.93rem", marginBottom: 2 }}>{entry.name}</div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: entry.bg,
                    color: entry.color,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                  }}
                >
                  {entry.category}
                </span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-soft)", lineHeight: 1.6 }}>{entry.desc}</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.75rem",
                color: "var(--text-faint)",
                borderTop: "1px solid var(--border)",
                paddingTop: 10,
                marginTop: 2,
              }}
            >
              ⚡ {entry.trigger}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}




/* =========================================================================
   4. ALL EVENTS TABLE TAB (With Pagination)
   ========================================================================= */
function EventsTab({ events }: { events: SystemEvent[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>Entire Events List</h3>
          <p className="hint" style={{ margin: 0 }}>
            Master Admin table of all events created across companies and hosts.
          </p>
        </div>
        <span className="spacer" />
        <span className="hint">{events.length} total events</span>
      </div>

      <div className="panel-body">
        <DataTablePagination
          data={events}
          searchFields={["title", "host", "category", "venue", "status"]}
          searchPlaceholder="Search events..."
          defaultPageSize={10}
        >
          {(paginatedEvents) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Host / Company</th>
                    <th>Category</th>
                    <th>Date &amp; Time</th>
                    <th>Venue</th>
                    <th>Price</th>
                    <th>Attendance</th>
                    <th>Status</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map((e) => {
                    const percent = e.capacity > 0 ? Math.min(100, Math.round((e.attendees / e.capacity) * 100)) : 0;
                    return (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.title}</strong>
                        </td>
                        <td>{e.company ? e.company.name : e.host || "Independent"}</td>
                        <td>
                          <span className="table-chip">{e.category}</span>
                        </td>
                        <td>
                          <div>{e.date || "TBD"}</div>
                          <div className="hint" style={{ fontSize: "0.75rem" }}>{e.time}</div>
                        </td>
                        <td>{e.venue || "Online"}</td>
                        <td><strong>{e.price > 0 ? `$${e.price}` : "Free"}</strong></td>
                        <td style={{ minWidth: "120px" }}>
                          <div style={{ fontSize: "0.85rem" }}>
                            {e.attendees} / {e.capacity > 0 ? e.capacity : "∞"}
                          </div>
                          {e.capacity > 0 ? (
                            <div style={{ background: "rgba(255, 255, 255, 0.1)", borderRadius: 4, height: 5, width: "100%", marginTop: 4, overflow: "hidden" }}>
                              <div style={{ background: percent >= 100 ? "#f87171" : "#34d399", height: "100%", width: `${percent}%` }} />
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background:
                                e.status === "published"
                                  ? "rgba(52, 211, 153, 0.15)"
                                  : e.status === "sold-out"
                                  ? "rgba(248, 113, 113, 0.15)"
                                  : "rgba(251, 191, 36, 0.15)",
                              color:
                                e.status === "published"
                                  ? "#34d399"
                                  : e.status === "sold-out"
                                  ? "#f87171"
                                  : "#fbbf24",
                            }}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem" }}>{e.owner.name}</div>
                          <div className="hint" style={{ fontSize: "0.75rem" }}>{e.owner.email}</div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-state">No events found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </DataTablePagination>
      </div>
    </div>
  );
}

/* =========================================================================
   5. USERS & ROLES TAB (With Pagination)
   ========================================================================= */
function UsersAndRolesTab({
  users,
  roles,
  myId,
  onAssignRole,
  onChanged,
  onToast,
}: {
  users: AdminUser[];
  roles: Role[];
  myId?: string;
  onAssignRole: (userId: string, roleId: string) => void;
  onChanged: () => void;
  onToast: (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState<"users" | "roles">("users");
  const [showCreateRole, setShowCreateRole] = useState(false);

  return (
    <div>
      <div className="panel" style={{ marginBottom: "16px" }}>
        <div className="panel-head" style={{ gap: "8px" }}>
          <button className={`btn btn-sm ${subTab === "users" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSubTab("users")}>
            System Users ({users.length})
          </button>
          <button className={`btn btn-sm ${subTab === "roles" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSubTab("roles")}>
            Roles &amp; Permissions ({roles.length})
          </button>
        </div>
      </div>

      {subTab === "users" ? (
        <div className="panel">
          <div className="panel-head">
            <h3>All Registered Users</h3>
            <span className="spacer" />
            <span className="hint">{users.length} users</span>
          </div>
          <div className="panel-body">
            <DataTablePagination
              data={users}
              searchFields={["name", "email"]}
              searchPlaceholder="Search system users..."
              defaultPageSize={10}
            >
              {(paginatedUsers) => (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <strong>{user.name}</strong>
                            {user.id === myId ? " (you)" : ""}
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <select
                              value={user.role.id}
                              onChange={(e) => onAssignRole(user.id, e.target.value)}
                              className="input-select"
                              style={{ minWidth: "170px" }}
                            >
                              {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {formatRoleName(role.name)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="mono">{new Date(user.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataTablePagination>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-head">
            <h3>System Roles &amp; Capabilities</h3>
            <span className="spacer" />
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreateRole(true)}>
              + New Role
            </button>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: "14px" }}>
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} onChanged={onChanged} onToast={onToast} />
            ))}
          </div>

          {showCreateRole ? (
            <RoleModal
              onClose={() => setShowCreateRole(false)}
              onSubmit={async (input) => {
                try {
                  await createRole(input);
                  setShowCreateRole(false);
                  onToast("Role created.");
                  onChanged();
                } catch (err) {
                  onToast(err instanceof ApiError ? err.message : "Failed to create role.");
                }
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function RoleCard({ role, onChanged, onToast }: { role: Role; onChanged: () => void; onToast: (msg: string) => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <strong>{formatRoleName(role.name)}</strong>
          {role.isSystem ? <span className="badge" style={{ marginLeft: "8px" }}>System</span> : null}
          <p className="hint" style={{ margin: "4px 0 0" }}>{role.description || "No description."}</p>
        </div>
        {!role.isSystem ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                const res = await Swal.confirm(`Delete role "${formatRoleName(role.name)}"?`);
                if (!res.isConfirmed) return;
                try {
                  await deleteRole(role.id);
                  onToast("Role deleted.");
                  onChanged();
                } catch (err) {
                  onToast(err instanceof ApiError ? err.message : "Could not delete role.");
                }
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
        {role.permissions.length === 0 ? (
          <span className="hint">No permissions granted.</span>
        ) : (
          role.permissions.map((p) => (
            <span key={p} className="table-chip">
              {ALL_PERMISSIONS.find((item) => item.value === p)?.label || p}
            </span>
          ))
        )}
      </div>

      {editing ? (
        <RoleModal
          initial={role}
          onClose={() => setEditing(false)}
          onSubmit={async (input) => {
            try {
              await updateRole(role.id, input);
              setEditing(false);
              onToast("Role updated.");
              onChanged();
            } catch (err) {
              onToast(err instanceof ApiError ? err.message : "Could not update role.");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function RoleModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Role;
  onClose: () => void;
  onSubmit: (input: { name: string; description?: string; permissions: string[] }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions ?? []);

  const togglePermission = (value: string) => {
    setPermissions((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial ? "Edit Role" : "New Role"}</h3>
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body" style={{ display: "grid", gap: "14px" }}>
          {!initial ? (
            <div className="field">
              <label htmlFor="r-name">Role Name</label>
              <input
                id="r-name"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                placeholder="REGIONAL_ADMIN"
              />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="r-desc">Description</label>
            <input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Role capabilities" />
          </div>
          <div className="field">
            <label>Permissions</label>
            <div style={{ display: "grid", gap: "8px" }}>
              {ALL_PERMISSIONS.map((p) => (
                <label key={p.value} className="check-row">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p.value)}
                    onChange={() => togglePermission(p.value)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!initial && name.trim().length < 2}
            onClick={() => onSubmit({ name: name.trim(), description: description.trim(), permissions })}
          >
            {initial ? "Save Changes" : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PAYMENT RECEIVING ACCOUNT TAB (SUPER ADMIN EXCLUSIVE)
   ========================================================================= */
function PaymentAccountTab({ onToast }: { onToast: (msg: string) => void }) {
  const [accountName, setAccountName] = useState("Pulseframe Events Private Limited");
  const [bankName, setBankName] = useState("HDFC Bank");
  const [accountNumber, setAccountNumber] = useState("50100293848192");
  const [ifscCode, setIfscCode] = useState("HDFC0000128");
  const [upiId, setUpiId] = useState("pulseframe@hdfcbank");
  const [currency, setCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onToast("Super Admin payment receiving account details saved.");
    }, 600);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>💳 Payment Receiving Account (Super Admin)</h3>
          <p className="hint" style={{ margin: 0 }}>
            Configure the bank account and UPI ID for receiving platform revenues and event ticket sales.
          </p>
        </div>
      </div>
      <div className="panel-body">
        <form onSubmit={handleSave} style={{ display: "grid", gap: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            <div className="field">
              <label htmlFor="acc-name">Account Holder Name</label>
              <input placeholder="Enter the account holder name" id="acc-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="bank-name">Bank Name</label>
              <input placeholder="Enter the receiving bank name" id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="acc-num">Bank Account Number</label>
              <input placeholder="Enter the bank account number" inputMode="numeric" id="acc-num" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="ifsc">IFSC Code / Branch</label>
              <input placeholder="For example: ABCD0123456" id="ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} required />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            <div className="field">
              <label htmlFor="upi-id">Receiving UPI ID</label>
              <input placeholder="For example: events@bank" id="upi-id" value={upiId} onChange={(e) => setUpiId(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="payout-curr">Default Payout Currency</label>
              <select id="payout-curr" className="input-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="INR">₹ INR (Indian Rupee)</option>
              </select>
            </div>
          </div>



          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving Details..." : "Save Payment Account Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
