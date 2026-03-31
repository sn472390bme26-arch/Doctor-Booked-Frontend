/**
 * api.ts — bulletproof HTTP + WebSocket client
 * - Auto-retry with exponential backoff (3 attempts)
 * - 15-second timeout on every request
 * - Detailed error messages (never "failed to fetch")
 * - Resilient WebSocket with auto-reconnect
 */

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";
const WS_BASE = BASE.replace(/^http/, "ws").replace(/\/api$/, "");

// ── JWT helpers ───────────────────────────────────────────────────────────────
export function getToken(): string | null { return localStorage.getItem("db_jwt"); }
export function setToken(t: string)       { localStorage.setItem("db_jwt", t); }
export function clearToken()              { localStorage.removeItem("db_jwt"); }

// ── Friendly error messages ───────────────────────────────────────────────────
function friendlyError(err: unknown, attempt: number): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed"))
    return attempt >= 3
      ? "Cannot reach the server. Please check your internet connection and try again."
      : "Network issue — retrying...";
  if (msg.includes("timeout"))   return "Request timed out. Please try again.";
  if (msg.includes("CORS"))      return "Server configuration error. Please contact support.";
  return msg;
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, options: RequestInit, ms = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

// ── Core request with retry ───────────────────────────────────────────────────
async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
  retries = 3,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isFormData) headers["Content-Type"] = "application/json";

  let lastErr: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${BASE}${path}`,
        {
          method,
          headers,
          body: isFormData
            ? (body as FormData)
            : body ? JSON.stringify(body) : undefined,
        },
        // Give file uploads more time
        isFormData ? 30000 : 15000,
      );

      // Parse response body
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};

      if (!res.ok) {
        // Don't retry client errors (4xx)
        if (res.status >= 400 && res.status < 500) {
          throw new Error((data as any).error || `Error ${res.status}`);
        }
        // Retry server errors (5xx)
        throw new Error((data as any).error || `Server error ${res.status}`);
      }

      return data as T;
    } catch (err) {
      lastErr = err;

      // Don't retry client errors or aborted requests with a message we set
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("Error 4") || msg.includes("Only admins") || msg.includes("already exists") || msg.includes("Incorrect")) {
        throw err;
      }

      // Wait before retrying: 500ms, 1500ms, 3000ms
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * attempt * attempt));
      }
    }
  }

  throw new Error(friendlyError(lastErr, retries));
}

const get   = <T>(path: string)                => req<T>("GET",    path);
const post  = <T>(path: string, b?: unknown)   => req<T>("POST",   path, b);
const patch = <T>(path: string, b?: unknown)   => req<T>("PATCH",  path, b);
const del   = <T>(path: string)                => req<T>("DELETE", path);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  patientSignup: (name: string, email: string, password: string) =>
    post<{ token: string; user: AppUser }>("/auth/patient/signup", { name, email, password }),
  patientLogin: (email: string, password: string) =>
    post<{ token: string; user: AppUser }>("/auth/patient/login", { email, password }),
  doctorLogin: (code: string, phone: string) =>
    post<{ token: string; user: AppUser }>("/auth/doctor/login", { code, phone }),
  adminLogin: (code: string, password: string) =>
    post<{ token: string; user: AppUser }>("/auth/admin/login", { code, password }),
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
  uploadPhotoBase64: async (id: string, base64: string): Promise<{ photoUrl: string }> => {
    const res = await fetch(base64);
    const blob = await res.blob();
    const file = new File([blob], "photo.jpg", { type: blob.type });
    const fd = new FormData(); fd.append("photo", file);
    return req<{ photoUrl: string }>("POST", `/hospitals/${id}/photo`, fd, true);
  },
};

// ── Doctors ───────────────────────────────────────────────────────────────────
export const doctors = {
  list:   (hospitalId?: string) =>
    get<Doctor[]>(hospitalId ? `/doctors?hospitalId=${hospitalId}` : "/doctors"),
  get:    (id: string)                         => get<Doctor>(`/doctors/${id}`),
  create: (data: Partial<Doctor>)              => post<Doctor>("/doctors", data),
  update: (id: string, data: Partial<Doctor>)  => patch<Doctor>(`/doctors/${id}`, data),
  delete: (id: string)                         => del<{ success: boolean }>(`/doctors/${id}`),
};

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookings = {
  list:       ()                               => get<Booking[]>("/bookings"),
  forSession: (sid: string)                    => get<Booking[]>(`/bookings/session/${sid}`),
  create:     (data: { doctorId: string; date: string; session: string; complaint?: string; phone?: string }) =>
    post<Booking>("/bookings", data),
  updateStatus: (id: string, status: string)   => patch<Booking>(`/bookings/${id}/status`, { status }),
  stats:      ()                               => get<Stats>("/bookings/stats/summary"),
};

// ── Tokens ────────────────────────────────────────────────────────────────────
export const tokens = {
  getState:        (sid: string)                                   => get<SessionTokenState | null>(`/tokens/${sid}`),
  regulate:        (sid: string, clickedToken: number)             => post<SessionTokenState>(`/tokens/${sid}/regulate`, { clickedToken }),
  complete:        (sid: string)                                   => post<SessionTokenState>(`/tokens/${sid}/complete`),
  skip:            (sid: string)                                   => post<SessionTokenState>(`/tokens/${sid}/skip`),
  completeSkipped: (sid: string, tokenNum: number)                 => post<SessionTokenState>(`/tokens/${sid}/complete-skipped`, { tokenNum }),
  closeSession:    (sid: string)                                   => post<SessionTokenState>(`/tokens/${sid}/close`),
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

// ── WebSocket with auto-reconnect ─────────────────────────────────────────────
export function connectTokenSocket(
  sessionId: string,
  onMessage: (payload: { type: string; state?: SessionTokenState; tokenNumber?: number }) => void,
): () => void {
  const url = `${WS_BASE}/ws?session=${encodeURIComponent(sessionId)}`;
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dead = false;
  let backoff = 1000;

  function connect() {
    if (dead) return;
    try {
      ws = new WebSocket(url);
      ws.onopen    = () => { backoff = 1000; }; // reset backoff on success
      ws.onmessage = (evt) => { try { onMessage(JSON.parse(evt.data)); } catch {} };
      ws.onclose   = () => {
        if (!dead) {
          timer = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 30000); // cap at 30s
        }
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
