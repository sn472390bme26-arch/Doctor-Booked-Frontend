import type { Doctor, Hospital, SessionTiming, SessionType } from "../types";

// Admin credentials are now managed in backend/.env — not hardcoded here

export const HOSPITALS: Hospital[] = [];

export const DOCTORS: Doctor[] = [];

export const SESSION_TIMES: Record<
  string,
  { start: string; end: string; label: string }
> = {
  morning: { start: "09:00", end: "12:00", label: "Morning (9 AM – 12 PM)" },
  afternoon: { start: "14:00", end: "17:00", label: "Afternoon (2 PM – 5 PM)" },
  evening: { start: "18:00", end: "21:00", label: "Evening (6 PM – 9 PM)" },
};

/** Converts "HH:MM" (24h) to "H:MM AM/PM" */
export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = Number.parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Returns display label for a session, using doctor's custom timings if available */
export function getSessionLabel(
  session: SessionType,
  customTimings?: Partial<Record<SessionType, SessionTiming>>,
): string {
  const base = SESSION_TIMES[session];
  const custom = customTimings?.[session];
  if (custom?.start && custom?.end) {
    const name = session.charAt(0).toUpperCase() + session.slice(1);
    return `${name} (${formatTime12h(custom.start)} – ${formatTime12h(custom.end)})`;
  }
  return base?.label ?? session;
}

export function makeSessionId(
  doctorId: string,
  date: string,
  session: string,
): string {
  return `${doctorId}_${date}_${session}`;
}

export function getAvailableDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export function isSessionAvailable(
  date: string,
  session: string,
  customTimings?: Partial<Record<SessionType, SessionTiming>>,
): boolean {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (date > today) return true;
  if (date < today) return false;
  // Same day - check if session ends in more than 10 min
  const custom = customTimings?.[session as SessionType];
  const times = custom ?? SESSION_TIMES[session];
  if (!times) return false;
  const [endH, endM] = times.end.split(":").map(Number);
  const endTime = new Date(now);
  endTime.setHours(endH, endM - 10, 0, 0);
  return now < endTime;
}

/**
 * Returns true only when the session can be actively regulated:
 * - The selected date must be TODAY
 * - The current time must be >= the session's scheduled start time
 */
export function isSessionAccessibleForRegulator(
  date: string,
  session: string,
  customTimings?: Partial<Record<SessionType, SessionTiming>>,
): boolean {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  // Only today's sessions can be actively regulated
  if (date !== today) return false;
  const custom = customTimings?.[session as SessionType];
  const times = custom ?? SESSION_TIMES[session];
  if (!times) return false;
  const [startH, startM] = times.start.split(":").map(Number);
  const startTime = new Date(now);
  startTime.setHours(startH, startM, 0, 0);
  return now >= startTime;
}
