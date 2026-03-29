import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as api from "../api";
import type {
  AppUser, Booking, Doctor, Hospital,
  PatientRecord, PrioritySlotState, SessionTokenState,
} from "../api";

export type { AppUser, Booking, Doctor, Hospital, PatientRecord, SessionTokenState };
export type AppStore = ReturnType<typeof useStore>;

// Full store interface — preserves every method the existing UI already calls
interface Store {
  user: AppUser | null;
  login: (u: AppUser, token: string) => void;
  logout: () => void;
  hospitals: Hospital[];
  addHospital: (data: Partial<Hospital>) => Promise<void>;
  updateHospital: (id: string, data: Partial<Hospital>) => Promise<void>;
  updateHospitalPhoto: (id: string, photoUrlOrBase64: string) => Promise<void>;
  deleteHospital: (id: string, _doctors: Doctor[]) => Promise<boolean>;
  doctors: Doctor[];
  addDoctor: (data: Omit<Doctor, "id" | "code">) => Promise<Doctor>;
  updateDoctor: (id: string, data: Partial<Doctor>) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  bookings: Booking[];
  addBooking: (data: {
    id?: string; patientId?: string; patientName?: string;
    doctorId: string; doctorName?: string; hospitalName?: string;
    date: string; session: string; tokenNumber?: number; sessionId?: string;
    paymentDone?: boolean; status?: string;
    complaint?: string; phone?: string;
  }) => Promise<void>;
  getBookingsForPatient: (patientId: string) => Booking[];
  getBookingsForSession: (sessionId: string) => Booking[];
  patients: PatientRecord[];
  tokenStates: Record<string, SessionTokenState>;
  getOrCreateTokenState: (sid: string, doctorId: string, date: string, session: string) => SessionTokenState;
  bookToken: (sid: string, doctorId: string, date: string, session: string, tokenNumber: number) => void;
  regulateToken: (sid: string, clickedToken: number) => Promise<void>;
  completeCurrentToken: (sid: string) => Promise<void>;
  skipToken: (sid: string) => Promise<void>;
  completeSkippedToken: (sid: string, tokenNum: number) => Promise<void>;
  closeSession: (sid: string) => Promise<void>;
  setPrioritySlot: (sid: string, slotIndex: number, slot: PrioritySlotState) => Promise<void>;
  cancelSession: (doctorId: string, date: string, session: string) => Promise<void>;
  isSessionCancelled: (doctorId: string, date: string, session: string) => boolean;
  getStats: () => { totalHospitals: number; totalDoctors: number; totalPatients: number; totalBookings: number; activeSessions: number };
  notification: string | null;
  setNotification: (n: string | null) => void;
  refreshFromStorage: () => Promise<void>;
  // legacy compat (no-ops / stubs)
  getPatientCredentials: () => Record<string, { name: string; password: string }>;
  getPatientNameIndex: () => Record<string, string>;
  savePatientCredential: (email: string, name: string, password: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be inside StoreProvider");
  return c;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("db_user") || "null"); } catch { return null; }
  });
  const [hospitals, setHospitals]   = useState<Hospital[]>([]);
  const [doctors, setDoctors]       = useState<Doctor[]>([]);
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [patients, setPatients]     = useState<PatientRecord[]>([]);
  const [tokenStates, setTokenStates] = useState<Record<string, SessionTokenState>>({});
  const [cancelled, setCancelled]   = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const wsRefs = useRef<Record<string, () => void>>({});

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (u: AppUser | null) => {
    const [h, d] = await Promise.all([api.hospitals.list(), api.doctors.list()]);
    setHospitals(h); setDoctors(d);
    api.tokens.getCancelledSessions().then(setCancelled).catch(() => {});
    if (!u) return;
    api.bookings.list().then(setBookings).catch(() => {});
    if (u.role === "admin") api.patients.list().then(setPatients).catch(() => {});
  }, []);

  useEffect(() => { loadAll(user); }, [user]); // eslint-disable-line

  // ── WebSocket subscription ────────────────────────────────────────────────
  const subscribe = useCallback((sid: string) => {
    if (wsRefs.current[sid]) return;
    wsRefs.current[sid] = api.connectTokenSocket(sid, (msg) => {
      if (msg.type === "state_update" && msg.state)
        setTokenStates(p => ({ ...p, [sid]: msg.state! }));
      else if (msg.type === "token_booked")
        api.tokens.getState(sid).then(s => { if (s) setTokenStates(p => ({ ...p, [sid]: s })); });
    });
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const login = useCallback((u: AppUser, token: string) => {
    api.setToken(token);
    localStorage.setItem("db_user", JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    localStorage.removeItem("db_user");
    setUser(null); setBookings([]); setTokenStates([]);
    Object.values(wsRefs.current).forEach(fn => fn());
    wsRefs.current = {};
  }, []);

  // ── Hospitals ─────────────────────────────────────────────────────────────
  const addHospital = useCallback(async (data: Partial<Hospital>) => {
    const h = await api.hospitals.create(data);
    setHospitals(p => [...p, h]);
  }, []);

  const updateHospital = useCallback(async (id: string, data: Partial<Hospital>) => {
    const h = await api.hospitals.update(id, data);
    setHospitals(p => p.map(x => x.id === id ? h : x));
  }, []);

  // Accepts either a base64 data URL (from file reader) or a plain URL string
  const updateHospitalPhoto = useCallback(async (id: string, photoUrlOrBase64: string) => {
    let photoUrl: string;
    if (photoUrlOrBase64.startsWith("data:")) {
      const result = await api.hospitals.uploadPhotoBase64(id, photoUrlOrBase64);
      photoUrl = result.photoUrl;
    } else {
      photoUrl = photoUrlOrBase64; // already a URL, just update locally
    }
    setHospitals(p => p.map(x => x.id === id ? { ...x, photoUrl } : x));
  }, []);

  const deleteHospital = useCallback(async (id: string, _docs: Doctor[]) => {
    try {
      await api.hospitals.delete(id);
      setHospitals(p => p.filter(h => h.id !== id));
      return true;
    } catch (e: any) {
      if (e.message?.includes("assigned doctors")) return false;
      throw e;
    }
  }, []);

  // ── Doctors ───────────────────────────────────────────────────────────────
  const addDoctor = useCallback(async (data: Omit<Doctor, "id" | "code">) => {
    const d = await api.doctors.create(data as Partial<Doctor>);
    setDoctors(p => [...p, d]);
    return d;
  }, []);

  const updateDoctor = useCallback(async (id: string, data: Partial<Doctor>) => {
    const d = await api.doctors.update(id, data);
    setDoctors(p => p.map(x => x.id === id ? d : x));
  }, []);

  const deleteDoctor = useCallback(async (id: string) => {
    await api.doctors.delete(id);
    setDoctors(p => p.filter(d => d.id !== id));
    setBookings(p => p.map(b => b.doctorId === id ? { ...b, status: "cancelled" as const } : b));
  }, []);

  // ── Bookings ──────────────────────────────────────────────────────────────
  const addBooking = useCallback(async (data: any) => {
    const b = await api.bookings.create({
      doctorId: data.doctorId,
      date: data.date,
      session: data.session,
      complaint: data.complaint,
      phone: data.phone,
    });
    setBookings(p => [...p, b]);
    subscribe(b.sessionId);
  }, [subscribe]);

  const getBookingsForPatient = useCallback((pid: string) =>
    bookings.filter(b => b.patientId === pid), [bookings]);

  const getBookingsForSession = useCallback((sid: string) =>
    bookings.filter(b => b.sessionId === sid), [bookings]);

  // ── Token states ──────────────────────────────────────────────────────────
  const EMPTY = (sid: string, doctorId: string, date: string, session: string): SessionTokenState => ({
    sessionId: sid, doctorId, date, session,
    tokenStatuses: {}, prioritySlots: {},
    currentToken: null, nextToken: null,
    isClosed: false, cancelledSessions: [],
  });

  const getOrCreateTokenState = useCallback((sid: string, doctorId: string, date: string, session: string) => {
    if (!tokenStates[sid]) {
      api.tokens.getState(sid).then(s => {
        setTokenStates(p => ({ ...p, [sid]: s ?? EMPTY(sid, doctorId, date, session) }));
      });
      subscribe(sid);
      return EMPTY(sid, doctorId, date, session);
    }
    subscribe(sid);
    return tokenStates[sid];
  }, [tokenStates, subscribe]); // eslint-disable-line

  // bookToken is now a no-op — the server handles it inside POST /bookings
  const bookToken = useCallback(() => {}, []);

  const regulateToken = useCallback(async (sid: string, clickedToken: number) => {
    const s = await api.tokens.regulate(sid, clickedToken);
    setTokenStates(p => ({ ...p, [sid]: s }));
  }, []);

  const completeCurrentToken = useCallback(async (sid: string) => {
    const s = await api.tokens.complete(sid);
    setTokenStates(p => ({ ...p, [sid]: s }));
  }, []);

  const skipToken = useCallback(async (sid: string) => {
    const s = await api.tokens.skip(sid);
    setTokenStates(p => ({ ...p, [sid]: s }));
  }, []);

  const completeSkippedToken = useCallback(async (sid: string, tokenNum: number) => {
    const s = await api.tokens.completeSkipped(sid, tokenNum);
    setTokenStates(p => ({ ...p, [sid]: s }));
  }, []);

  const closeSession = useCallback(async (sid: string) => {
    const s = await api.tokens.closeSession(sid);
    setTokenStates(p => ({ ...p, [sid]: s }));
    setBookings(p => p.map(b =>
      b.sessionId === sid && b.status === "confirmed" ? { ...b, status: "unvisited" as const } : b
    ));
  }, []);

  const setPrioritySlot = useCallback(async (sid: string, slotIndex: number, slot: PrioritySlotState) => {
    const s = await api.tokens.setPrioritySlot(sid, slotIndex, slot);
    setTokenStates(p => ({ ...p, [sid]: s }));
  }, []);

  const cancelSession = useCallback(async (doctorId: string, date: string, session: string) => {
    await api.tokens.cancelSession(doctorId, date, session);
    const key = `${doctorId}_${date}_${session}`;
    setCancelled(p => p.includes(key) ? p : [...p, key]);
  }, []);

  const isSessionCancelled = useCallback((doctorId: string, date: string, session: string) =>
    cancelled.includes(`${doctorId}_${date}_${session}`), [cancelled]);

  const getStats = useCallback(() => ({
    totalHospitals: hospitals.length,
    totalDoctors: doctors.length,
    totalPatients: patients.length,
    totalBookings: bookings.length,
    activeSessions: Object.values(tokenStates).filter(s => !s.isClosed && s.currentToken !== null).length,
  }), [hospitals, doctors, patients, bookings, tokenStates]);

  const refreshFromStorage = useCallback(async () => {
    await Promise.all(Object.keys(tokenStates).map(sid =>
      api.tokens.getState(sid).then(s => { if (s) setTokenStates(p => ({ ...p, [sid]: s })); })
    ));
  }, [tokenStates]);

  // Legacy stubs — these were localStorage helpers, now no-ops since auth is server-side
  const getPatientCredentials = useCallback(() => ({} as Record<string, { name: string; password: string }>), []);
  const getPatientNameIndex   = useCallback(() => ({} as Record<string, string>), []);
  const savePatientCredential = useCallback(() => {}, []);

  const value: Store = {
    user, login, logout,
    hospitals, addHospital, updateHospital, updateHospitalPhoto, deleteHospital,
    doctors, addDoctor, updateDoctor, deleteDoctor,
    bookings, addBooking, getBookingsForPatient, getBookingsForSession,
    patients,
    tokenStates, getOrCreateTokenState, bookToken,
    regulateToken, completeCurrentToken, skipToken, completeSkippedToken,
    closeSession, setPrioritySlot, cancelSession, isSessionCancelled,
    getStats, notification, setNotification, refreshFromStorage,
    getPatientCredentials, getPatientNameIndex, savePatientCredential,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
