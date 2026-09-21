"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession, requireAuth } from "@/lib/auth";
import {
  ALL_PERMISSIONS,
  assignUserRole,
  createRole,
  deleteRole,
  listRoles,
  listUsers,
  updateRole,
  type AdminUser,
  type Role,
} from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { Swal } from "@/lib/swal";

function formatRoleName(name: string) {
  return name
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const session = requireAuth();
    if (!session) {
      router.replace("/signin");
      return;
    }
    const canManage = session.permissions.includes("users:manage") || session.permissions.includes("roles:manage");
    if (!canManage) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [u, r] = await Promise.all([listUsers(), listRoles()]);
      setUsers(u);
      setRoles(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const myId = useMemo(() => getSession()?.id, []);

  async function handleAssignRole(userId: string, roleId: string) {
    try {
      await assignUserRole(userId, roleId);
      setToast("Role updated.");
      void load();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Could not update role.");
    }
  }

  return (
    <AppShell title="Admin" subtitle="Manage users and the roles/permissions that govern access across the app." eyebrow="Administration">
      <div className="panel" style={{ marginBottom: "20px" }}>
        <div className="panel-head" style={{ gap: "8px" }}>
          <button className={`btn btn-sm ${tab === "users" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("users")}>
            Users
          </button>
          <button className={`btn btn-sm ${tab === "roles" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("roles")}>
            Roles &amp; permissions
          </button>
        </div>
      </div>

      <FeedbackNotice message={error} icon="error" />

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : tab === "users" ? (
        <UsersTab users={users} roles={roles} myId={myId} onAssign={handleAssignRole} />
      ) : (
        <RolesTab roles={roles} onChanged={load} onToast={setToast} />
      )}

      <FeedbackNotice message={toast} />
    </AppShell>
  );
}

function UsersTab({
  users,
  roles,
  myId,
  onAssign,
}: {
  users: AdminUser[];
  roles: Role[];
  myId?: string;
  onAssign: (userId: string, roleId: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>All users</h3>
        <span className="spacer" />
        <span className="hint">{users.length} total</span>
      </div>
      <div className="panel-body">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}{user.id === myId ? " (you)" : ""}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role.id}
                      onChange={(event) => onAssign(user.id, event.target.value)}
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
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">No users yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RolesTab({ roles, onChanged, onToast }: { roles: Role[]; onChanged: () => void; onToast: (msg: string) => void }) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Roles</h3>
        <span className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>
          New role
        </button>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: "14px" }}>
        {roles.map((role) => (
          <RoleRow key={role.id} role={role} onChanged={onChanged} onToast={onToast} />
        ))}
      </div>

      {showCreate ? (
        <RoleFormModal
          onClose={() => setShowCreate(false)}
          onSubmit={async (input) => {
            try {
              await createRole(input);
              setShowCreate(false);
              onToast("Role created.");
              onChanged();
            } catch (err) {
              onToast(err instanceof ApiError ? err.message : "Could not create role.");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function RoleRow({ role, onChanged, onToast }: { role: Role; onChanged: () => void; onToast: (msg: string) => void }) {
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
                const res = await Swal.confirm(`Delete the "${formatRoleName(role.name)}" role?`);
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
          role.permissions.map((permission) => (
            <span key={permission} className="table-chip">
              {ALL_PERMISSIONS.find((p) => p.value === permission)?.label || permission}
            </span>
          ))
        )}
      </div>

      {editing ? (
        <RoleFormModal
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

function RoleFormModal({
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
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial ? "Edit role" : "New role"}</h3>
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body" style={{ display: "grid", gap: "14px" }}>
          {!initial ? (
            <div className="field">
              <label htmlFor="role-name">Role name</label>
              <input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                placeholder="EVENT_REVIEWER"
              />
              <p className="hint">UPPER_SNAKE_CASE — this is how the role is stored and referenced.</p>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="role-desc">Description</label>
            <input id="role-desc" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What can this role do?" />
          </div>
          <div className="field">
            <label>Permissions</label>
            <div style={{ display: "grid", gap: "8px" }}>
              {ALL_PERMISSIONS.map((permission) => (
                <label key={permission.value} className="check-row">
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission.value)}
                    onChange={() => togglePermission(permission.value)}
                  />
                  {permission.label}
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
            {initial ? "Save changes" : "Create role"}
          </button>
        </div>
      </div>
    </div>
  );
}
