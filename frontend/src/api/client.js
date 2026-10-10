// All calls to the FastAPI backend go through here.
export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TOKEN_KEY = "peakgrid_token";
const USER_KEY = "peakgrid_user";

// sessionStorage: the login lasts until the browser tab is closed (safer than localStorage)
export const session = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  get user() { try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; } },
  save(token, user) { sessionStorage.setItem(TOKEN_KEY, token); sessionStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); },
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function request(path, { method = "GET", body, params, auth = true, raw, contentType = "application/json" } = {}) {
  const url = new URL(API_URL + path);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const headers = { "Content-Type": contentType };
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError(`Cannot reach the backend at ${API_URL}. Is it running?`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized();
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join("; ") : data.detail;
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  overview: () => request("/", { auth: false }),
  login: (email, password) => request("/login", { method: "POST", body: { email, password }, auth: false }),
  dashboard: (params) => request("/dashboard", { params }),
  optimization: (params) => request("/optimization", { params }),
  dataStatus: () => request("/data/status"),
  refreshData: (params) => request("/data/refresh", { method: "POST", params }),
  uploadData: (csvText) => request("/data/upload", { method: "POST", raw: csvText, contentType: "text/csv" }),
};
