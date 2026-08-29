/**
 * Every request to the backend flows through here. The backend base URL is
 * read ONLY from the environment (NEXT_PUBLIC_API_URL) — never hardcoded —
 * so the same build can point at local, staging, or production APIs just by
 * changing .env.
 */

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export function getApiBaseUrl() {
  if (!RAW_BASE_URL) {
    // Fail loudly in dev so a missing .env is obvious instead of silently
    // hitting the wrong host.
    // eslint-disable-next-line no-console
    console.error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local, e.g. NEXT_PUBLIC_API_URL=http://localhost:4000/api",
    );
  }
  return (RAW_BASE_URL || "").replace(/\/+$/, "");
}

const TOKEN_KEY = "pulseframe:token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // no-op
  }
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // no-op
  }
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | undefined | null>;
  auth?: boolean;
};

function buildQuery(query?: RequestOptions["query"]) {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const str = params.toString();
  return str ? `?${str}` : "";
}

/**
 * Like apiRequest, but sends a FormData body (multipart) instead of JSON —
 * used for banner image uploads. The browser sets the multipart boundary
 * itself, so we must NOT set a Content-Type header here.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (payload && (payload.message || (Array.isArray(payload.message) && payload.message[0]))) ||
      response.statusText ||
      "Upload failed.";
    throw new ApiError(Array.isArray(message) ? message[0] : message, response.status, payload);
  }

  return payload as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, query, auth = true } = options;
  const baseUrl = getApiBaseUrl();

  const headers: Record<string, string> = {};

  if (!formData) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearToken();
      try {
        window.localStorage.removeItem("pulseframe:session");
      } catch {
        // no-op
      }
      if (window.location.pathname !== "/signin" && window.location.pathname !== "/signup") {
        window.location.href = "/signin";
      }
    }

    const message =
      (payload && (payload.message || (Array.isArray(payload.message) && payload.message[0]))) ||
      response.statusText ||
      "Something went wrong.";
    throw new ApiError(Array.isArray(message) ? message[0] : message, response.status, payload);
  }

  return payload as T;
}
