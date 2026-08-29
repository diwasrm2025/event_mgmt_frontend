"use client";

import { apiRequest, ApiError, clearToken, setToken, getToken } from "./api";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  permissions: string[];
};

const SESSION_KEY = "pulseframe:session";

function setSession(user: SessionUser) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // no-op
  }
}

function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
}

export function initials(name: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function hasPermission(permission: string): boolean {
  return getSession()?.permissions.includes(permission) ?? false;
}

type AuthResponse = { token: string; user: SessionUser };

function applyAuthResponse(result: AuthResponse) {
  setToken(result.token);
  setSession(result.user);
}

export async function signUp(name: string, email: string, password: string) {
  try {
    const result = await apiRequest<AuthResponse>("/auth/signup", {
      method: "POST",
      body: { name, email, password },
      auth: false,
    });
    applyAuthResponse(result);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Unable to create your account.",
    };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const result = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    applyAuthResponse(result);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Unable to sign in.",
    };
  }
}

/** Re-fetches the current user from the backend (fresh role/permissions)
 * and refreshes the cached session — call after anything that might have
 * changed the signed-in user's role or permissions. */
export async function refreshSession() {
  try {
    const user = await apiRequest<SessionUser>("/auth/me");
    setSession(user);
    return user;
  } catch {
    return null;
  }
}

export function logOut() {
  clearToken();
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = "/signin";
  }
}

/** Fast, local-only guard: is there a token+session on this device? */
export function requireAuth() {
  const session = getSession();
  const token = getToken();
  if ((!session || !token) && typeof window !== "undefined") {
    window.location.href = "/signin";
    return null;
  }
  return session;
}

export function redirectIfAuthed() {
  if (typeof window !== "undefined" && getSession() && getToken()) {
    window.location.href = "/dashboard";
  }
}
