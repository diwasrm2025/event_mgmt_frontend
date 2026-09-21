"use client";
import { FeedbackNotice } from "@/components/ui/FeedbackNotice";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faLock,
  faPalette,
  faCamera,
  faCheck,
  faSpinner,
  faEye,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import { AppShell } from "@/components/layout/AppShell";
import { getSession, refreshSession, initials, type SessionUser } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ACCENT_OPTIONS, THEME_OPTIONS, type AccentName, type ThemeMode } from "@/lib/themePrefs";
import { useTheme } from "@/components/providers/ThemeProvider";

const AVATAR_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

type Tab = "profile" | "security" | "appearance";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, accent, customHex, setTheme, setAccent, setCustomHex } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    const s = getSession();
    setUser(s);
    refreshSession().then((fresh) => { if (fresh) setUser(fresh); });
  }, []);

  if (!user) return null;

  return (
    <AppShell
      title="Settings"
      subtitle="Manage your profile, security, and preferences."
      eyebrow="Account"
    >
      <div className="settings-page">
        {/* Tab nav */}
        <div className="settings-tabs">
          {[
            { id: "profile" as Tab, icon: faUser, label: "Profile" },
            { id: "security" as Tab, icon: faLock, label: "Security" },
            { id: "appearance" as Tab, icon: faPalette, label: "Appearance" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              id={`settings-tab-${t.id}`}
              className={`settings-tab-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <FontAwesomeIcon icon={t.icon} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="settings-content">
          {tab === "profile" && (
            <ProfileTab user={user} onSave={(updated) => { setUser(updated); showToast("Profile updated successfully."); }} />
          )}
          {tab === "security" && (
            <SecurityTab onSave={() => showToast("Password changed successfully.")} />
          )}
          {tab === "appearance" && (
            <AppearanceTab theme={theme} accent={accent} customHex={customHex} setTheme={setTheme} setAccent={setAccent} setCustomHex={setCustomHex} />
          )}
        </div>
      </div>

      <FeedbackNotice message={toast} />
    </AppShell>
  );
}

// ── Profile Tab ──────────────────────────────────────────────────────────
function ProfileTab({ user, onSave }: { user: SessionUser; onSave: (u: SessionUser) => void }) {
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const updated = await apiRequest<SessionUser>("/auth/avatar", { method: "POST", formData });
      setAvatarUrl(updated.avatarUrl || "");
      onSave(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setError("");
    setSaving(true);
    try {
      const updated = await apiRequest<SessionUser>("/auth/profile", {
        method: "PATCH",
        body: { name: name.trim() },
      });
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = avatarUrl ? `${AVATAR_BASE}${avatarUrl}` : null;

  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <h3>Profile Information</h3>
        <p className="hint">Update your name and profile photo.</p>
      </div>

      {/* Avatar */}
      <div className="avatar-upload-zone">
        <div className="avatar-preview-lg">
          {displayAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayAvatar} alt="Profile" />
          ) : (
            <span className="avatar-initials-lg">{initials(user.name)}</span>
          )}
          <button
            type="button"
            className="avatar-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Upload profile photo"
          >
            {uploadingAvatar
              ? <FontAwesomeIcon icon={faSpinner} spin />
              : <FontAwesomeIcon icon={faCamera} />
            }
          </button>
        </div>
        <div className="avatar-upload-info">
          <div className="avatar-upload-title">{user.name}</div>
          <div className="hint">{user.email}</div>
          <div className="hint" style={{ marginTop: 6 }}>Click the camera icon to upload a new photo. JPG, PNG or WebP under 5 MB.</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { void handleAvatarUpload(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>

      {/* Name form */}
      <form onSubmit={handleSubmit} noValidate className="settings-form">
        <div className="field">
          <label htmlFor="s-name">Full name</label>
          <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="field">
          <label htmlFor="s-email">Email address</label>
          <input id="s-email" type="email" value={user.email} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
          <div className="hint">Contact support to change your email address.</div>
        </div>
        <div className="field">
          <label htmlFor="s-role">Role</label>
          <input id="s-role" value={user.role} disabled style={{ opacity: 0.6, cursor: "not-allowed", textTransform: "capitalize" }} />
        </div>
        <FeedbackNotice message={error} icon="error" />
        <div className="settings-form-foot">
          <button type="submit" className="btn btn-accent" disabled={saving} id="save-profile-btn">
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheck} />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Security Tab ─────────────────────────────────────────────────────────
function SecurityTab({ onSave }: { onSave: () => void }) {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const strength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strengthLabel = ["Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["var(--danger)", "var(--warning)", "var(--info)", "var(--success)"];
  const s = strength(newPwd);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current) { setError("Enter your current password."); return; }
    if (newPwd.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (newPwd !== confirm) { setError("Passwords do not match."); return; }
    setError("");
    setSaving(true);
    try {
      await apiRequest("/auth/password", { method: "PATCH", body: { currentPassword: current, newPassword: newPwd } });
      setCurrent(""); setNewPwd(""); setConfirm("");
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <h3>Change Password</h3>
        <p className="hint">Use a strong password with at least 8 characters, including uppercase, numbers, and symbols.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="settings-form">
        <div className="field">
          <label htmlFor="s-cur-pwd">Current password</label>
          <div className="input-row">
            <input
              id="s-cur-pwd"
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button type="button" className="toggle-pass" onClick={() => setShowCurrent((v) => !v)}>
              <FontAwesomeIcon icon={showCurrent ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-new-pwd">New password</label>
          <div className="input-row">
            <input
              id="s-new-pwd"
              type={showNew ? "text" : "password"}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button type="button" className="toggle-pass" onClick={() => setShowNew((v) => !v)}>
              <FontAwesomeIcon icon={showNew ? faEyeSlash : faEye} />
            </button>
          </div>
          {newPwd.length > 0 && (
            <div className="password-strength">
              <div className="strength-bars">
                {[0,1,2,3].map((i) => (
                  <div key={i} className="strength-bar" style={{ background: i < s ? strengthColor[s-1] : "var(--border-strong)" }} />
                ))}
              </div>
              <span className="strength-label" style={{ color: strengthColor[s-1] }}>{strengthLabel[s-1]}</span>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="s-confirm-pwd">Confirm new password</label>
          <input
            id="s-confirm-pwd"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {confirm && newPwd !== confirm && <div className="hint" style={{ color: "var(--danger)" }}>Passwords do not match.</div>}
        </div>
        <FeedbackNotice message={error} icon="error" />
        <div className="settings-form-foot">
          <button type="submit" className="btn btn-accent" disabled={saving} id="change-password-btn">
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLock} />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Appearance Tab ────────────────────────────────────────────────────────
function AppearanceTab({
  theme, accent, customHex, setTheme, setAccent, setCustomHex
}: {
  theme: ThemeMode; accent: AccentName; customHex: string;
  setTheme: (t: ThemeMode) => void; setAccent: (a: AccentName) => void; setCustomHex: (hex: string) => void;
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <h3>Theme & Appearance</h3>
        <p className="hint">Choose your preferred color theme and display mode. Changes apply instantly across all pages.</p>
      </div>

      {/* Light / Dark mode */}
      <div className="settings-appearance-group">
        <label className="settings-group-label">Display Mode</label>
        <div className="theme-mode-cards">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              id={`theme-mode-${option.value}`}
              className={`theme-mode-card ${theme === option.value ? "active" : ""}`}
              onClick={() => setTheme(option.value)}
            >
              <div className={`mode-preview ${option.value}`}>
                <div className="mode-preview-sidebar" />
                <div className="mode-preview-content">
                  <div className="mode-preview-bar" />
                  <div className="mode-preview-row" />
                  <div className="mode-preview-row short" />
                </div>
              </div>
              <div className="mode-card-label">
                {option.value === theme && <FontAwesomeIcon icon={faCheck} className="mode-check" />}
                {option.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color accent — 4-color palette per theme */}
      <div className="settings-appearance-group" style={{ marginTop: 28 }}>
        <label className="settings-group-label">Color Theme</label>
        <div className="accent-palette-grid">
          {ACCENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              id={`accent-${option.value}`}
              className={`accent-palette-btn ${accent === option.value ? "active" : ""}`}
              onClick={() => setAccent(option.value)}
            >
              <div className="palette-swatches-strip">
                {option.palette.map((color, i) => (
                  <div key={i} className="palette-swatch-block" style={{ background: color }} />
                ))}
              </div>
              <span className="accent-palette-label">
                {accent === option.value && <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5, color: option.swatch }} />}
                {option.label}
              </span>
            </button>
          ))}

          <div className={`accent-palette-btn accent-custom-btn ${accent === "custom" ? "active" : ""}`}>
            <div className="palette-swatches-strip">
              <div className="palette-swatch-block" style={{ background: customHex }} />
            </div>
            <label className="accent-palette-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              {accent === "custom" && <FontAwesomeIcon icon={faCheck} style={{ marginRight: 2, color: customHex }} />}
              Custom
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                aria-label="Pick a custom accent color"
                style={{ width: 22, height: 22, padding: 0, border: "none", background: "none", cursor: "pointer" }}
              />
            </label>
          </div>
        </div>
      </div>

     
    </div>
  );
}
