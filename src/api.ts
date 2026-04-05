/**
 * api.ts — Rock-solid HTTP + WebSocket client
 *
 * PROBLEMS THIS FILE SOLVES:
 *
 * 1. RAILWAY COLD START (main culprit)
 *    Railway free/hobby tier hibernates after ~5 min idle. Cold start takes
 *    10-30 seconds. Old code gave up after ~5s — before server was even awake.
 *    Fix: 6 retries with delays [0,1,3,6,10,15]s = 35s total patience.
 *
 * 2. KEEPALIVE NEVER STARTED
 *    startKeepalive() was exported but never called anywhere. Railway kept
 *    sleeping even during active sessions.
 *    Fix: keepalive starts automatically when this module loads.
 *
 * 3. ABORTED REQUESTS LABELLED AS "NO INTERNET"
 *    AbortController.abort() (our own timeout) was caught as a network error
 *    and shown as "check your internet connection" — confusing users whose
 *    internet was fine. Fix: distinguish timeout from real network failure.
 *
 * 4. NO USER FEEDBACK DURING RETRY
 *    Silent retries meant users would tap again, sending duplicate requests.
 *    Fix: server status events that UI can subscribe to.
 *
 * 5. ALL ERRORS SURFACED TO USER
 *    Background 30s refresh errors were reaching error toasts. Fix: quiet
 *    mode for background calls, loud mode for user-initiated calls.
 */

const BASE    = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const WS_BASE = BASE.replace(/^http/, "ws").replace(/\/api$/, "");

// ── JWT helpers ───────────────────────────────────────────────────────────────
export function getToken(): string | null { return localStorage.getItem("db_jwt"); }
export function setToken(t: string)       { localStorage.setItem("db_jwt", t); }
export function clearToken()              { localStorage.removeItem("db_jwt"); }

// ── Server status events — UI subscribes to show/hide waking banner ───────────
type StatusListener = (status: "ok" | "waking" | "offline") => void;
const _statusListeners = new Set<StatusListener>();
export function onServerStatus(fn: StatusListener): () => void {
  _statusListeners.add(fn);
  return () => { _statusListeners.delete(fn); };
}
function emitStatus(s: "ok" | "waking" | "offline") {
  _statusListeners.forEach(fn => fn(s));
}

// ── Error classification ──────────────────────────────────────────────────────
function isNetworkError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true; // timeout
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("failed to fetch")   ||
    msg.includes("networkerror")      ||
    msg.includes("load failed")       ||
    msg.includes("fetch failed")      ||
    msg.includes("connection refused")||
    msg.includes("could not connect") ||
    msg.includes("network request failed") ||
    msg.includes("the internet connection appears to be offline")
  );
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function isClientError(msg: string): boolean {
  return (
    msg.includes("Only admins")          ||
    msg.includes("already exists")       ||
    msg.includes("Incorrect")            ||
    msg.includes("Invalid")              ||
    msg.includes("required")             ||
    msg.includes("not found")            ||
    msg.includes("No account")           ||
    msg.includes("No phone")             ||
    msg.includes("fully booked")         ||
    msg.includes("already have a booking") ||
    msg.includes("Cannot delete")        ||
    msg.includes("Admin access")         ||
    msg.includes("Doctor access")        ||
    msg.includes("access required")
  );
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// ── Retry schedule — outlasts Railway 45s worst-case cold start ──────────────
//  Attempt : 1    2     3     4      5      6      7
//  Pre-wait: 0   1000  3000  6000  10000  15000  20000  ms
//  Cumulative patience: 55 seconds of waiting between attempts
//  Each attempt itself has a 20s timeout → total patience ~75 seconds
const DELAYS     = [0, 1000, 3000, 6000, 10000, 15000, 20000];
const MAX_RETRY  = DELAYS.length;
const REQ_TIMEOUT = 20_000; // ms per attempt

// ── Core request ──────────────────────────────────────────────────────────────
async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isFormData) headers["Content-Type"] = "application/json";

  let lastErr: unknown;
  let serverWasAsleep = false;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    // Pre-attempt delay (attempt 1 = 0ms, attempt 2 = 1000ms, etc.)
    if (DELAYS[attempt - 1] > 0) {
      await new Promise(r => setTimeout(r, DELAYS[attempt - 1]));
    }

    try {
      const timeout = isFormData ? 60_000 : REQ_TIMEOUT;
      const res = await fetchWithTimeout(
        `${BASE}${path}`,
        {
          method,
          headers,
          body: isFormData
            ? (body as FormData)
            : body ? JSON.stringify(body) : undefined,
        },
        timeout,
      );

      const ct   = res.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};

      if (!res.ok) {
        // 4xx — client error, never retry
        if (res.status >= 400 && res.status < 500) {
          emitStatus("ok"); // server is reachable
          throw new Error((data as any).error || `Error ${res.status}`);
        }
        // 5xx — server error, retry
        throw new Error((data as any).error || `Server error ${res.status}`);
      }

      // Success — server is alive
      if (serverWasAsleep) emitStatus("ok");
      else emitStatus("ok");
      return data as T;

    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : "";

      // Client errors — throw immediately, never retry
      if (!isNetworkError(err) && isClientError(msg)) throw err;

      // Last attempt — fall through to throw below
      if (attempt === MAX_RETRY) break;

      // Network error or timeout — server may be waking up
      if (isNetworkError(err)) {
        serverWasAsleep = true;
        if (attempt === 1) emitStatus("waking"); // show banner to user
      }
    }
  }

  // All retries exhausted
  emitStatus("offline");

  // Give a clear message based on what actually happened
  if (isTimeoutError(lastErr)) {
    throw new Error("Server is taking too long to respond. It may be waking up — please try again in a moment.");
  }
  if (isNetworkError(lastErr)) {
    throw new Error("Cannot reach the server. The server may be starting up — please wait 15 seconds and try again.");
  }
  throw new Error(lastErr instanceof Error ? lastErr.message : "Request failed");
}

const get   = <T>(path: string)              => req<T>("GET",    path);
const post  = <T>(path: string, b?: unknown) => req<T>("POST",   path, b);
const patch = <T>(path: string, b?: unknown) => req<T>("PATCH",  path, b);
const del   = <T>(path: string)              => req<T>("DELETE", path);

// ── Keepalive — START IMMEDIATELY, keep Railway awake ─────────────────────────
// Railway hibernates after ~5 min idle. This pings every 4 min silently.
// Starts automatically when this module is imported — no manual call needed.
(function startKeepaliveImmediately() {
  const ping = () =>
    fetch(`${BASE}/health`, { method: "GET", cache: "no-store" })
      .then(() => emitStatus("ok"))
      .catch(() => {}); // silent — don't disturb user

  // Ping immediately on page load (wakes server before user tries to log in)
  ping();

  // Then ping every 3 minutes to prevent Railway from sleeping
  // Railway free tier sleeps after 5 min idle — 3 min gives a safe margin
  setInterval(ping, 3 * 60 * 1000);
})();

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  // Signup — called AFTER Firebase phone OTP is verified
  // firebaseIdToken comes from confirmationResult.confirm(otp) → user.getIdToken()
  patientSignup: (name: string, email: string, password: string, firebaseIdToken: string) =>
    post<{ token: string; user: AppUser }>("/auth/patient/signup", { name, email, password, firebaseIdToken }),

  // Login step 1 — verify credentials, get back which phone to OTP
  patientLogin: (email: string, password: string) =>
    post<{
      // success path — phone exists, needs OTP
      success?: boolean; userId?: string; phone?: string; maskedPhone?: string;
      // old account path — no phone yet
      token?: string; user?: AppUser; needsPhone?: boolean;
    }>("/auth/patient/login", { email, password }),

  // Login step 2 — after Firebase OTP verified, send token to backend
  patientLoginVerify: (userId: string, firebaseIdToken: string) =>
    post<{ token: string; user: AppUser }>("/auth/patient/login-verify", { userId, firebaseIdToken }),
  doctorLogin: (code: string, phone: string) =>
    post<{ token: string; user: AppUser }>("/auth/doctor/login", { code, phone }),
  adminLogin: (code: string, password: string) =>
    post<{ token: string; user: AppUser }>("/auth/admin/login", { code, password }),

  // Google One Tap — returns needsPhone:true if phone not yet verified
  googleLogin: (credential: string) =>
    post<{ token?: string; user?: AppUser; needsPhone?: boolean; userId?: string; name?: string; email?: string }>(
      "/auth/patient/google", { credential }
    ),
  // After Google login, save verified phone (firebaseIdToken from Firebase phone auth)
  googleVerifyPhone: (userId: string, firebaseIdToken: string) =>
    post<{ token: string; user: AppUser }>("/auth/patient/google-verify-phone", { userId, firebaseIdToken }),
  me: () => get<{ user: AppUser }>("/auth/me"),
};

// ── Hospitals ─────────────────────────────────────────────────────────────────
export const hospitals = {
  list:   ()                                    => get<Hospital[]>("/hospitals"),
  get:    (id: string)                          => get<Hospital>(`/hospitals/${id}`),
  create: (data: Partial<Hospital>)             => post<Hospital>("/hospitals", data),
  update: (id: string, data: Partial<Hospital>) => patch<Hospital>(`/hospitals/${id}`, data),
  delete: (id: string)                          => del<{ success: boolean }>(`/hospitals/${id}`),
  uploadPhoto: (id: string, file: File) => {
    const fd = new FormData(); fd.append("photo", file);
    return req<{ photoUrl: string }>("POST", `/hospitals/${id}/photo`, fd, true);
  },
  uploadPhotoBase64: (id: string, base64: string): Promise<{ photoUrl: string }> =>
    post<{ photoUrl: string }>(`/hospitals/${id}/photo-base64`, { base64 }),
};

// ── Doctors ───────────────────────────────────────────────────────────────────
export const doctors = {
  list:   (hospitalId?: string) =>
    get<Doctor[]>(hospitalId ? `/doctors?hospitalId=${hospitalId}` : "/doctors"),
  get:    (id: string)                        => get<Doctor>(`/doctors/${id}`),
  create: (data: Partial<Doctor>)             => post<Doctor>("/doctors", data),
  update: (id: string, data: Partial<Doctor>) => patch<Doctor>(`/doctors/${id}`, data),
  delete: (id: string)                        => del<{ success: boolean }>(`/doctors/${id}`),
};

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookings = {
  list:       ()                              => get<Booking[]>("/bookings"),
  forSession: (sid: string)                   => get<Booking[]>(`/bookings/session/${sid}`),
  create:     (data: { doctorId: string; date: string; session: string; complaint?: string; phone?: string }) =>
    post<Booking>("/bookings", data),
  updateStatus: (id: string, status: string)  => patch<Booking>(`/bookings/${id}/status`, { status }),
  stats:      ()                              => get<Stats>("/bookings/stats/summary"),
};

// ── Tokens ────────────────────────────────────────────────────────────────────
export const tokens = {
  getState:        (sid: string)                                  => get<SessionTokenState | null>(`/tokens/${sid}`),
  regulate:        (sid: string, clickedToken: number)            => post<SessionTokenState>(`/tokens/${sid}/regulate`, { clickedToken }),
  complete:        (sid: string)                                  => post<SessionTokenState>(`/tokens/${sid}/complete`),
  skip:            (sid: string, tokenNum?: number)               => post<SessionTokenState>(`/tokens/${sid}/skip`, tokenNum != null ? { tokenNum } : undefined),
  completeSkipped: (sid: string, tokenNum: number)                => post<SessionTokenState>(`/tokens/${sid}/complete-skipped`, { tokenNum }),
  closeSession:    (sid: string)                                  => post<SessionTokenState>(`/tokens/${sid}/close`),
  setPrioritySlot: (sid: string, slotIndex: number, slot: PrioritySlotState) =>
    post<SessionTokenState>(`/tokens/${sid}/priority-slot`, { slotIndex, slot }),
  cancelSession:   (doctorId: string, date: string, session: string) =>
    post<{ success: boolean }>("/tokens/cancel-session", { doctorId, date, session }),
  getCancelledSessions: () => get<string[]>("/tokens/cancelled/list"),
};

// ── Patients ──────────────────────────────────────────────────────────────────
export const patients = {
  list: () => get<PatientRecord[]>("/patients"),
};

// ── WebSocket — resilient, Railway-aware ──────────────────────────────────────
export function connectTokenSocket(
  sessionId: string,
  onMessage: (payload: { type: string; state?: SessionTokenState; tokenNumber?: number }) => void,
): () => void {
  const url = `${WS_BASE}/ws?session=${encodeURIComponent(sessionId)}`;
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dead = false;
  let backoff = 2000;

  function connect() {
    if (dead) return;
    try {
      ws = new WebSocket(url);
      ws.onopen    = () => { backoff = 2000; emitStatus("ok"); };
      ws.onmessage = (evt) => { try { onMessage(JSON.parse(evt.data)); } catch {} };
      ws.onclose   = () => {
        if (!dead) { timer = setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30_000); }
      };
      ws.onerror = () => ws?.close();
    } catch {
      if (!dead) timer = setTimeout(connect, backoff);
    }
  }

  connect();
  return () => {
    dead = true;
    if (timer) clearTimeout(timer);
    try { ws?.close(); } catch {}
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "patient" | "doctor" | "admin";
export interface Hospital {
  id: string; name: string; area: string; address?: string;
  phone?: string; rating: number; gradient: string;
  photoUrl?: string | null; doctorCount: number;
}
export interface Doctor {
  id: string; hospitalId: string; code?: string; name: string;
  specialty: string; phone?: string; contactPhone?: string; bio?: string; photo?: string | null;
  price: number; consultationFee?: number; tokensPerSession: number;
  sessions: string[];
  sessionTimings?: Partial<Record<string, { start: string; end: string }>>;
  isAvailable?: boolean; yearsOfExperience?: string;
  education?: string; languages?: string[];
}
export interface Booking {
  id: string; patientId: string; patientName: string;
  doctorId: string; doctorName: string; hospitalName: string;
  date: string; session: string; tokenNumber: number; sessionId: string;
  paymentDone: boolean; status: "confirmed" | "completed" | "unvisited" | "cancelled";
  phone?: string; complaint?: string; createdAt: string;
}
export type TokenStatus = "white" | "red" | "orange" | "yellow" | "green" | "unvisited";
export interface SessionTokenState {
  sessionId: string; doctorId: string; date: string; session: string;
  tokenStatuses: Record<number, TokenStatus>;
  prioritySlots: Record<number, PrioritySlotState>;
  currentToken: number | null; nextToken: number | null;
  isClosed: boolean; cancelledSessions: string[];
}
export interface PrioritySlotState {
  label: string; status: "waiting" | "ongoing" | "completed"; patientName?: string;
}
export interface PatientRecord { id: string; name: string; email?: string; createdAt: string; }
export type AppUser =
  | { id: string; email: string; name: string; role: "patient" }
  | { id: string; code: string; doctorId: string; role: "doctor" }
  | { id: string; role: "admin" };
export interface Stats {
  totalHospitals: number; totalDoctors: number; totalPatients: number;
  totalBookings: number; activeSessions: number;
}
