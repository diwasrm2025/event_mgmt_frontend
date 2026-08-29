"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Swal } from "@/lib/swal";
import {
  faMagnifyingGlass,
  faTrash,
  faRotateLeft,
  faUserPlus,
  faPen,
  faCheck,
  faXmark,
  faUserCheck,
  faUserPlus as faUserAdd,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import { ApiError } from "@/lib/api";
import {
  EVENT_CAPABILITY_LABELS,
  EVENT_CAPABILITY_DESCRIPTIONS,
  createUserAndShareEvent,
  listSharedMembers,
  removeSharedMember,
  revokeSharedMemberAccess,
  searchPeople,
  shareEvent,
  updateSharedMemberPermissions,
  type EventCapability,
  type PersonSummary,
  type SharedMember,
} from "@/lib/rbac";

const CAPABILITIES: EventCapability[] = ["VIEW", "ATTENDEE", "EDIT"];

function initialsOf(name: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export function SharedMembersPanel({ eventId, onToast }: { eventId: string; onToast: (message: string) => void }) {
  const [members, setMembers] = useState<SharedMember[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "REMOVED">("ACTIVE");
  const [permissionFilter, setPermissionFilter] = useState<EventCapability | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "date">("date");

  // Share mode toggle: "existing" vs "new"
  const [shareMode, setShareMode] = useState<"existing" | "new">("existing");

  // Existing user search
  const [shareQuery, setShareQuery] = useState("");
  const [shareResults, setShareResults] = useState<PersonSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<PersonSummary | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // New user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [sharePermissions, setSharePermissions] = useState<EventCapability[]>(["VIEW"]);
  const [sharing, setSharing] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<EventCapability[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listSharedMembers(eventId);
      setMembers(list);
      setForbidden(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        onToast("Could not load shared members.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Search existing users in DB
  useEffect(() => {
    if (shareMode !== "existing") return;
    const timeout = window.setTimeout(async () => {
      try {
        setShareResults(await searchPeople(shareQuery.trim()));
      } catch {
        setShareResults([]);
      }
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [shareQuery, shareMode]);

  // Automatically fetch initial user list for "existing" user tab
  useEffect(() => {
    if (shareMode === "existing" && !shareQuery) {
      searchPeople("").then(setShareResults).catch(() => setShareResults([]));
    }
  }, [shareMode, shareQuery]);

  const activeCount = useMemo(() => (members ?? []).filter((m) => m.status === "ACTIVE").length, [members]);

  const visibleMembers = useMemo(() => {
    let list = members ?? [];
    if (statusFilter !== "ALL") list = list.filter((m) => m.status === statusFilter);
    if (permissionFilter !== "ALL") list = list.filter((m) => m.permissions.includes(permissionFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) =>
      sortBy === "name" ? a.user.name.localeCompare(b.user.name) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [members, statusFilter, permissionFilter, search, sortBy]);

  const togglePermission = (list: EventCapability[], value: EventCapability): EventCapability[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  // Share with Existing User
  const handleShareExisting = async (target: { userId?: string; email?: string }, label: string) => {
    if (sharePermissions.length === 0) {
      onToast("Choose at least one permission to grant.");
      return;
    }
    setSharing(true);
    try {
      await shareEvent(eventId, target, sharePermissions);
      onToast(`Shared access with ${label}.`);
      setShareQuery("");
      setSelectedUser(null);
      setSharePermissions(["VIEW"]);
      void load();
    } catch (err) {
      if (err instanceof ApiError && target.email && err.status === 404) {
        onToast(`User "${target.email}" is not registered yet. Switch to Create & Share tab.`);
        setShareMode("new");
        setNewEmail(target.email);
        setNewName(target.email.split("@")[0]);
        if (!newPassword) setNewPassword("Password123!");
      } else {
        onToast(err instanceof ApiError ? err.message : "Could not share this event.");
      }
    } finally {
      setSharing(false);
    }
  };

  // Share by creating New User with Password
  const handleCreateNewAndShare = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedName = newName.trim() || trimmedEmail.split("@")[0] || "Organizer User";
    const password = newPassword.trim() || "Password123!";

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      onToast("Enter a valid email address (e.g. user@gmail.com).");
      return;
    }
    if (sharePermissions.length === 0) {
      onToast("Choose at least one permission to grant.");
      return;
    }
    setSharing(true);
    try {
      await createUserAndShareEvent(
        eventId,
        { name: trimmedName, email: trimmedEmail, password },
        sharePermissions,
      );
      onToast(`Created account & shared access with "${trimmedEmail}".`);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setSharePermissions(["VIEW"]);
      void load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not create user and share event.");
    } finally {
      setSharing(false);
    }
  };

  const startEdit = (member: SharedMember) => {
    setEditingId(member.id);
    setEditPermissions(member.permissions);
  };

  const saveEdit = async (member: SharedMember) => {
    if (editPermissions.length === 0) {
      onToast("A member needs at least one permission — use Revoke Access to remove them entirely.");
      return;
    }
    try {
      await updateSharedMemberPermissions(eventId, member.id, editPermissions);
      onToast("Permissions updated.");
      setEditingId(null);
      void load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not update permissions.");
    }
  };

  const handleRevoke = async (member: SharedMember) => {
    const res = await Swal.confirm(`Revoke ${member.user.name}'s access?`, "They will remain in history with Revoked status.");
    if (!res.isConfirmed) return;
    try {
      await revokeSharedMemberAccess(eventId, member.id);
      onToast("Access revoked.");
      void load();
    } catch {
      onToast("Could not revoke access.");
    }
  };

  const handleRemove = async (member: SharedMember) => {
    const res = await Swal.confirm(`Permanently remove ${member.user.name}?`, "They will be removed from shared event members.");
    if (!res.isConfirmed) return;
    try {
      await removeSharedMember(eventId, member.id);
      onToast("Member removed.");
      void load();
    } catch {
      onToast("Could not remove that member.");
    }
  };

  if (forbidden) return null;

  return (
    <div className="shared-members-panel">
      <div className="shared-members-head">
        <h3>
          Shared Members <span className="shared-members-count">({activeCount})</span>
        </h3>
        <p className="hint">
          Grant View, Attendee Management, and/or Edit access to existing registered users or create a new user account with credentials.
        </p>
      </div>

      {/* --- Share access box with 2 tabs ------------------------------------ */}
      <div className="share-access-box">
        <div className="share-mode-toggle" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn btn-sm ${shareMode === "existing" ? "btn-accent" : "btn-ghost"}`}
            onClick={() => setShareMode("existing")}
          >
            <FontAwesomeIcon icon={faUserCheck} /> Share to Existing User
          </button>
          <button
            type="button"
            className={`btn btn-sm ${shareMode === "new" ? "btn-accent" : "btn-ghost"}`}
            onClick={() => setShareMode("new")}
          >
            <FontAwesomeIcon icon={faUserAdd} /> Create & Share to New User
          </button>
        </div>

        {/* Existing User Tab */}
        {shareMode === "existing" ? (
          <div className="share-search-row-flex">
            <div className="field" style={{ flex: 1, position: "relative", marginBottom: 0 }}>
              <label htmlFor="share-query">Select or Search Existing Users</label>
              <input
                id="share-query"
                value={shareQuery}
                onChange={(e) => setShareQuery(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setTimeout(() => setIsInputFocused(false), 250)}
                placeholder="Click to select registered user or enter gmail (user@gmail.com)..."
              />
              {isInputFocused && shareResults.length ? (
                <div className="share-search-results">
                  {shareResults.map((person) => (
                    <button
                      type="button"
                      key={person.id}
                      className="share-search-row"
                      disabled={sharing}
                      onClick={() => handleShareExisting({ userId: person.id }, person.name)}
                    >
                      <span className="member-avatar">
                        {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initialsOf(person.name)}
                      </span>
                      <span>
                        <strong>{person.name}</strong>
                        <span className="hint" style={{ display: "block" }}>
                          {person.email}
                        </span>
                      </span>
                      <span className="badge">
                        <FontAwesomeIcon icon={faUserPlus} /> Share
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {shareQuery.trim() && shareQuery.includes("@") ? (
              <button
                type="button"
                className="btn btn-accent btn-sm"
                style={{ height: 42, whiteSpace: "nowrap" }}
                disabled={sharing}
                onClick={() => handleShareExisting({ email: shareQuery.trim() }, shareQuery.trim())}
              >
                <FontAwesomeIcon icon={faUserPlus} /> Share with Email
              </button>
            ) : null}
          </div>
        ) : (
          /* New User Tab (Name, Email, Password created by owner) */
          <div className="new-user-share-form">
            <div className="field-row">
              <div className="field">
                <label htmlFor="nu-name">Full Name</label>
                <input
                  id="nu-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div className="field">
                <label htmlFor="nu-email">Email Address</label>
                <input
                  id="nu-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="rahul@example.com"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="nu-pass">Password (Set by Event Owner)</label>
              <div className="input-row">
                <input
                  id="nu-pass"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set initial password for this user"
                />
              </div>
              <div className="hint">The user can log in with this email and password to access the shared event.</div>
            </div>
          </div>
        )}

        {/* Permissions checkboxes */}
        <div className="field" style={{ marginTop: 16 }}>
          <label>Permissions to grant</label>
          <div className="capability-picker">
            {CAPABILITIES.map((capability) => (
              <label key={capability} className={`capability-chip ${sharePermissions.includes(capability) ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={sharePermissions.includes(capability)}
                  onChange={() => setSharePermissions((current) => togglePermission(current, capability))}
                />
                <span>
                  <strong style={{marginLeft:'5px'}}>{EVENT_CAPABILITY_LABELS[capability]}</strong>
                  <span className="hint" style={{ display: "block" }}>
                    {EVENT_CAPABILITY_DESCRIPTIONS[capability]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {shareMode === "new" ? (
          <button
            type="button"
            className="btn btn-accent btn-sm"
            style={{ marginTop: 14 }}
            disabled={sharing}
            onClick={handleCreateNewAndShare}
          >
            <FontAwesomeIcon icon={faUserPlus} /> Create Account & Share Event
          </button>
        ) : null}
      </div>

      {/* --- Search / filter / sort ----------------------------------------- */}
      <div className="shared-members-toolbar">
        <div className="input-row" style={{ flex: 1 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…" aria-label="Search shared members" />
        </div>
        <select value={permissionFilter} onChange={(e) => setPermissionFilter(e.target.value as EventCapability | "ALL")} aria-label="Filter by permission">
          <option value="ALL">All permissions</option>
          {CAPABILITIES.map((c) => (
            <option key={c} value={c}>
              {EVENT_CAPABILITY_LABELS[c]}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "REMOVED")} aria-label="Filter by status">
          <option value="ACTIVE">Active</option>
          <option value="REMOVED">Removed</option>
          <option value="ALL">All statuses</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "date")} aria-label="Sort by">
          <option value="date">Sort: date shared</option>
          <option value="name">Sort: name</option>
        </select>
      </div>

      {/* --- List -------------------------------------------------------- */}
      {loading ? (
        <p className="hint">Loading shared members…</p>
      ) : visibleMembers.length === 0 ? (
        <p className="hint">No shared members match these filters yet.</p>
      ) : (
        <div className="shared-members-list">
          {visibleMembers.map((member) => (
            <div className="shared-member-row" key={member.id}>
              <div className="avatar-ring" style={{ width: 44, height: 44, flexShrink: 0 }}>
                <div className="avatar-ring-inner">
                  {member.user.avatarUrl ? <img src={member.user.avatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%" }} /> : initialsOf(member.user.name)}
                </div>
              </div>
              <div className="member-main">
                <div className="member-name-row">
                  <strong>{member.user.name}</strong>
                  <span className={`status-pill ${member.status === "ACTIVE" ? "active" : "removed"}`}>
                    {member.status === "ACTIVE" ? "Active" : "Removed"}
                  </span>
                </div>
                <div className="hint">{member.user.email}</div>
                <div className="member-meta-row">
                  <span>Shared {new Date(member.createdAt).toLocaleDateString()}</span>
                  {member.grantedBy ? <span>by {member.grantedBy.name}</span> : null}
                  <span>· Updated {new Date(member.updatedAt).toLocaleDateString()}</span>
                </div>

                {editingId === member.id ? (
                  <div className="capability-picker" style={{ marginTop: 8 }}>
                    {CAPABILITIES.map((capability) => (
                      <label key={capability} className={`capability-chip sm ${editPermissions.includes(capability) ? "active" : ""}`}>
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(capability)}
                          onChange={() => setEditPermissions((current) => togglePermission(current, capability))}
                        />
                        {EVENT_CAPABILITY_LABELS[capability]}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="permission-badge-row">
                    {member.permissions.length === 0 ? (
                      <span className="hint">No active permissions</span>
                    ) : (
                      member.permissions.map((p) => <span key={p} className="permission-badge">{EVENT_CAPABILITY_LABELS[p]}</span>)
                    )}
                  </div>
                )}
              </div>

              <div className="member-actions">
                {member.status === "ACTIVE" ? (
                  editingId === member.id ? (
                    <>
                      <button type="button" className="icon-btn" aria-label="Save permissions" onClick={() => saveEdit(member)}>
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                      <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => setEditingId(null)}>
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="icon-btn" aria-label="Edit permissions" onClick={() => startEdit(member)}>
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button type="button" className="icon-btn" aria-label="Revoke access" onClick={() => handleRevoke(member)}>
                        <FontAwesomeIcon icon={faRotateLeft} />
                      </button>
                    </>
                  )
                ) : null}
                <button type="button" className="icon-btn danger" aria-label="Remove member" onClick={() => handleRemove(member)}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
