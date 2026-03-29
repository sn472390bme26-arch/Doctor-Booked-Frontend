export type UserRole = "patient" | "doctor" | "admin";

export interface Hospital {
  id: string;
  name: string;
  area: string;
  doctorCount: number;
  rating: number;
  gradient: string;
  address?: string;
  phone?: string;
  photoUrl?: string;
}

export type SessionType = "morning" | "afternoon" | "evening";

export interface SessionTiming {
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
}

export interface Doctor {
  id: string;
  hospitalId: string;
  code?: string;
  name: string;
  specialty: string;
  price: number;
  sessions: SessionType[];
  tokensPerSession: number;
  bio?: string;
  photo?: string;
  phone?: string;
  consultationFee?: number;
  isAvailable?: boolean;
  contactPhone?: string;
  yearsOfExperience?: string;
  education?: string;
  languages?: string[];
  sessionTimings?: Partial<Record<SessionType, SessionTiming>>;
}

export type TokenStatus =
  | "white"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "unvisited";

export interface Booking {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  hospitalName: string;
  date: string; // YYYY-MM-DD
  session: SessionType;
  tokenNumber: number;
  sessionId: string;
  paymentDone: boolean;
  status: "confirmed" | "completed" | "unvisited" | "cancelled";
  phone?: string;
  complaint?: string;
}

export interface SessionTokenState {
  sessionId: string;
  doctorId: string;
  date: string;
  session: SessionType;
  tokenStatuses: Record<number, TokenStatus>;
  prioritySlots: Record<number, PrioritySlotState>; // key = slot index (1, 2, 3...)
  currentToken: number | null;
  nextToken: number | null;
  isClosed: boolean;
  cancelledSessions: string[]; // cancelled future session keys
}

export interface PrioritySlotState {
  label: string;
  status: "waiting" | "ongoing" | "completed";
  patientName?: string;
}

export interface PatientUser {
  id: string;
  email: string;
  name: string;
  role: "patient";
}

export interface DoctorUser {
  id: string;
  code: string;
  role: "doctor";
  doctorId: string;
}

export interface AdminUser {
  id: string;
  role: "admin";
}

export type AppUser = PatientUser | DoctorUser | AdminUser;

export interface PatientRecord {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
}
