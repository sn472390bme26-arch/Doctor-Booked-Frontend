import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Languages,
  Lock,
  Phone,
  Save,
  SkipForward,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import {
  SESSION_TIMES,
  formatTime12h,
  getAvailableDates,
  getSessionLabel,
  isSessionAccessibleForRegulator,
  makeSessionId,
} from "../../data/seed";
import type {
  PrioritySlotState,
  SessionTiming,
  SessionType,
  TokenStatus,
} from "../../types";

const TOKEN_CLASSES: Record<string, string> = {
  white: "token-white cursor-pointer hover:opacity-80",
  red: "token-red cursor-pointer hover:opacity-80",
  orange: "token-orange cursor-pointer hover:opacity-80",
  yellow: "token-yellow cursor-pointer",
  green: "token-green",
  unvisited:
    "bg-purple-100 border-2 border-purple-300 text-purple-700 cursor-pointer hover:opacity-80",
};

const PRIORITY_STATUS_CLASSES: Record<string, string> = {
  waiting:
    "bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100",
  ongoing: "bg-orange-50 text-orange-700 border-orange-200 cursor-pointer",
  completed: "bg-green-50 text-green-700 border-green-200 cursor-pointer",
};

const DEFAULT_TIMINGS: Record<SessionType, SessionTiming> = {
  morning: { start: "09:00", end: "12:00" },
  afternoon: { start: "14:00", end: "17:00" },
  evening: { start: "18:00", end: "21:00" },
};

export default function DoctorDashboard() {
  const {
    user,
    doctors,
    updateDoctor,
    getOrCreateTokenState,
    regulateToken,
    completeCurrentToken,
    skipToken,
    completeSkippedToken,
    closeSession,
    setPrioritySlot,
    cancelSession,
    isSessionCancelled,
    tokenStates,
    getBookingsForSession,
  } = useStore();

  const doctorUser = user as { doctorId: string; code: string };
  const doctor = doctors.find((d) => d.id === doctorUser.doctorId)!;

  const [profileForm, setProfileForm] = useState({
    name: doctor?.name ?? "",
    specialty: doctor?.specialty ?? "",
    bio: doctor?.bio ?? "",
    price: String(doctor?.price ?? 0),
    tokensPerSession: String(doctor?.tokensPerSession ?? 20),
    sessions: doctor?.sessions ?? ([] as SessionType[]),
    contactPhone: doctor?.contactPhone ?? "",
    yearsOfExperience: doctor?.yearsOfExperience ?? "",
    education: doctor?.education ?? "",
    languages: doctor?.languages ?? ([] as string[]),
    sessionTimings: (doctor?.sessionTimings ?? {}) as Partial<
      Record<SessionType, SessionTiming>
    >,
  });

  const [langInput, setLangInput] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];
  const [regDate, setRegDate] = useState(today);
  const [regSession, setRegSession] = useState<SessionType>(
    doctor?.sessions[0] ?? "morning",
  );
  const [priorityDialog, setPriorityDialog] = useState<{
    open: boolean;
    index: number;
    slot: PrioritySlotState | null;
  }>({ open: false, index: 0, slot: null });
  const [sessionActionResult, setSessionActionResult] = useState<{
    type: "ended" | "cancelled";
    session: string;
  } | null>(null);
  const [tokenDialog, setTokenDialog] = useState<{
    open: boolean;
    tokenNum: number | null;
  }>({ open: false, tokenNum: null });

  const visibleSessions = useMemo(() => {
    if (!doctor) return [];
    return doctor.sessions.filter((s) => {
      if (isSessionCancelled(doctor.id, regDate, s)) return false;
      const sid = makeSessionId(doctor.id, regDate, s);
      if (tokenStates[sid]?.isClosed === true) return false;
      return true;
    });
  }, [doctor, regDate, tokenStates, isSessionCancelled]);

  const availableDates = useMemo(() => getAvailableDates(), []);

  const sessionId = doctor ? makeSessionId(doctor.id, regDate, regSession) : "";
  const tokenState = doctor
    ? getOrCreateTokenState(sessionId, doctor.id, regDate, regSession)
    : null;
  const statuses = tokenState?.tokenStatuses ?? {};
  const isClosed = tokenState?.isClosed ?? false;
  const cancelled = doctor
    ? isSessionCancelled(doctor.id, regDate, regSession)
    : false;

  // Session is only accessible for token regulation when date=today AND time >= session start
  const isSessionAccessibleNow = isSessionAccessibleForRegulator(
    regDate,
    regSession,
    doctor?.sessionTimings,
  );

  // Show cancel button for future sessions OR today's sessions that haven't started yet
  const canCancelSession =
    !cancelled &&
    !isClosed &&
    (regDate > today || (regDate === today && !isSessionAccessibleNow));

  // Get the session start time for display
  function getSessionStartTime(session: SessionType): string {
    const custom = doctor?.sessionTimings?.[session];
    const times = custom ?? SESSION_TIMES[session];
    return times ? formatTime12h(times.start) : "";
  }

  // Derive info for the token dialog
  const dialogTokenBooking = useMemo(() => {
    if (tokenDialog.tokenNum === null) return null;
    const sessionBookings = getBookingsForSession(sessionId);
    return (
      sessionBookings.find((b) => b.tokenNumber === tokenDialog.tokenNum) ??
      null
    );
  }, [tokenDialog.tokenNum, sessionId, getBookingsForSession]);

  const dialogTokenStatus: TokenStatus | null = useMemo(() => {
    if (tokenDialog.tokenNum === null) return null;
    return (statuses[tokenDialog.tokenNum] as TokenStatus) ?? "white";
  }, [tokenDialog.tokenNum, statuses]);

  function handleSaveProfile() {
    updateDoctor(doctor.id, {
      name: profileForm.name,
      specialty: profileForm.specialty,
      bio: profileForm.bio,
      price: Number(profileForm.price),
      tokensPerSession: Number(profileForm.tokensPerSession),
      sessions: profileForm.sessions,
      contactPhone: profileForm.contactPhone,
      yearsOfExperience: profileForm.yearsOfExperience,
      education: profileForm.education,
      languages: profileForm.languages,
      consultationFee: Number(profileForm.price),
      sessionTimings: profileForm.sessionTimings,
    });
    toast.success("Profile updated successfully");
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      updateDoctor(doctor.id, { photo: base64 });
      toast.success("Photo updated successfully");
    };
    reader.readAsDataURL(file);
  }

  function toggleSession(s: SessionType) {
    setProfileForm((prev) => ({
      ...prev,
      sessions: prev.sessions.includes(s)
        ? prev.sessions.filter((x) => x !== s)
        : [...prev.sessions, s],
    }));
  }

  function updateSessionTiming(
    session: SessionType,
    field: "start" | "end",
    value: string,
  ) {
    setProfileForm((prev) => {
      const existing = prev.sessionTimings[session] ?? DEFAULT_TIMINGS[session];
      return {
        ...prev,
        sessionTimings: {
          ...prev.sessionTimings,
          [session]: { ...existing, [field]: value },
        },
      };
    });
  }

  function addLanguage() {
    const lang = langInput.trim();
    if (!lang) return;
    if (profileForm.languages.includes(lang)) {
      setLangInput("");
      return;
    }
    setProfileForm((prev) => ({
      ...prev,
      languages: [...prev.languages, lang],
    }));
    setLangInput("");
  }

  function removeLanguage(lang: string) {
    setProfileForm((prev) => ({
      ...prev,
      languages: prev.languages.filter((l) => l !== lang),
    }));
  }

  function handleTokenClick(tokenNum: number) {
    if (isClosed || !isSessionAccessibleNow) return;
    const st = statuses[tokenNum] as TokenStatus;
    if (
      st !== "red" &&
      st !== "yellow" &&
      st !== "orange" &&
      st !== "unvisited"
    )
      return;
    setTokenDialog({ open: true, tokenNum });
  }

  function handleMarkAsOngoing() {
    if (tokenDialog.tokenNum === null) return;
    regulateToken(sessionId, tokenDialog.tokenNum);
    toast.success(`Token #${tokenDialog.tokenNum} is now being seen`);
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleMarkCompleted() {
    completeCurrentToken(sessionId);
    toast.success("Token completed, moving to next");
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleSkipToken() {
    skipToken(sessionId);
    toast.success("Patient skipped, moving to next token");
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleCompleteSkipped() {
    if (tokenDialog.tokenNum === null) return;
    completeSkippedToken(sessionId, tokenDialog.tokenNum);
    toast.success(`Token #${tokenDialog.tokenNum} marked as completed`);
    setTokenDialog({ open: false, tokenNum: null });
  }

  function handleCloseSession() {
    const sessionLabel = getSessionLabel(regSession, doctor?.sessionTimings);
    closeSession(sessionId);
    toast.success(
      "Session closed. Refunds will be processed for unvisited tokens.",
    );
    const next = visibleSessions.find((s) => s !== regSession);
    if (next) setRegSession(next);
    setSessionActionResult({ type: "ended", session: sessionLabel });
  }

  function handleCancelSession() {
    const sessionLabel = getSessionLabel(regSession, doctor?.sessionTimings);
    cancelSession(doctor.id, regDate, regSession);
    toast.success("Session cancelled. Patients will be notified.");
    const next = visibleSessions.find((s) => s !== regSession);
    if (next) setRegSession(next);
    setSessionActionResult({ type: "cancelled", session: sessionLabel });
  }

  function openPriorityDialog(slotIndex: number) {
    const existing = tokenState?.prioritySlots?.[slotIndex] ?? {
      label: `Priority Slot P${slotIndex}`,
      status: "waiting" as const,
    };
    setPriorityDialog({ open: true, index: slotIndex, slot: existing });
  }

  function handlePriorityUpdate(status: PrioritySlotState["status"]) {
    if (!priorityDialog.slot) return;
    setPrioritySlot(sessionId, priorityDialog.index, {
      ...priorityDialog.slot,
      status,
    });
    setPriorityDialog({ open: false, index: 0, slot: null });
  }

  const maxTokens = doctor?.tokensPerSession ?? 20;

  function renderTokenGrid() {
    const elements: React.ReactNode[] = [];
    for (let n = 1; n <= maxTokens; n++) {
      const st: TokenStatus = (statuses[n] as TokenStatus) ?? "white";
      const isClickable =
        (st === "red" ||
          st === "yellow" ||
          st === "orange" ||
          st === "unvisited") &&
        !isClosed &&
        isSessionAccessibleNow;
      elements.push(
        <button
          key={n}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-sm font-semibold border-2 transition-all select-none ${
            TOKEN_CLASSES[st] ?? "token-white"
          } ${isClickable ? "cursor-pointer hover:scale-110" : ""} ${
            st === "orange" ? "scale-110 shadow-lg" : ""
          }`}
          type="button"
          disabled={!isClickable}
          onClick={() => handleTokenClick(n)}
          title={
            st === "orange"
              ? "Currently seeing — click to act"
              : st === "yellow"
                ? "Next up — click to call"
                : st === "green"
                  ? "Done"
                  : st === "red"
                    ? "Click to call"
                    : "Available"
          }
          data-ocid={`tokens.item.${n}`}
        >
          {n}
        </button>,
      );
      if (n % 10 === 0 && n < maxTokens) {
        const slotIndex = n / 10;
        const ps = tokenState?.prioritySlots?.[slotIndex] ?? {
          label: `Priority Slot P${slotIndex}`,
          status: "waiting" as const,
        };
        elements.push(
          <div key={`ps_${slotIndex}`} className="col-span-5 sm:col-span-10">
            <button
              type="button"
              className={`w-full py-2.5 px-4 rounded-xl border-2 border-dashed text-xs font-semibold text-left flex items-center justify-between transition-all ${
                PRIORITY_STATUS_CLASSES[ps.status]
              }`}
              onClick={() => openPriorityDialog(slotIndex)}
              data-ocid="tokens.toggle"
            >
              <span className="truncate mr-2">
                ⚡ Priority Slot P{slotIndex} — Emergency / Urgent Visit
              </span>
              <Badge
                className={`text-[10px] border-0 shrink-0 ${
                  ps.status === "completed"
                    ? "bg-green-200 text-green-800"
                    : ps.status === "ongoing"
                      ? "bg-orange-200 text-orange-800"
                      : "bg-blue-200 text-blue-800"
                }`}
              >
                {ps.status === "completed"
                  ? "Completed"
                  : ps.status === "ongoing"
                    ? "Ongoing"
                    : "Waiting"}
              </Badge>
            </button>
          </div>,
        );
      }
    }
    return elements;
  }

  const currentDoctor = doctors.find((d) => d.id === doctorUser.doctorId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* Title card */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          Token Control Panel
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Manage live patient queue — {doctor?.name} ·{" "}
          {currentDoctor?.specialty}
        </p>
      </div>

      <Tabs defaultValue="regulator" className="w-full">
        <TabsList className="mb-6" data-ocid="doctor.tab">
          <TabsTrigger value="regulator" data-ocid="doctor.tab">
            <Activity className="w-4 h-4 mr-1.5 sm:mr-2" />
            <span className="hidden xs:inline">Token </span>Regulator
          </TabsTrigger>
          <TabsTrigger value="profile" data-ocid="doctor.tab">
            <User className="w-4 h-4 mr-1.5 sm:mr-2" />
            <span className="hidden xs:inline">My </span>Profile
          </TabsTrigger>
        </TabsList>

        {/* Token Regulator Tab */}
        <TabsContent value="regulator">
          <div className="space-y-6">
            {/* Session selectors */}
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Date</Label>
                    <Select value={regDate} onValueChange={setRegDate}>
                      <SelectTrigger
                        className="w-full sm:w-44"
                        data-ocid="doctor.select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDates.map((d) => (
                          <SelectItem key={d} value={d}>
                            {new Date(`${d}T00:00:00`).toLocaleDateString(
                              "en-IN",
                              {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              },
                            )}
                            {d === today ? " (Today)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Session</Label>
                    <Select
                      value={regSession}
                      onValueChange={(v) => setRegSession(v as SessionType)}
                    >
                      <SelectTrigger
                        className="w-full sm:w-52"
                        data-ocid="doctor.select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleSessions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {getSessionLabel(s, doctor?.sessionTimings)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:ml-auto">
                    {cancelled ? (
                      <span className="bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Session Cancelled
                      </span>
                    ) : isClosed ? (
                      <span className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full">
                        Session Closed
                      </span>
                    ) : regDate > today ? (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Upcoming
                      </span>
                    ) : !isSessionAccessibleNow ? (
                      <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Not Started Yet
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        Session Active
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Grid Card */}
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3">
                  <CardTitle className="text-base">
                    <Clock className="w-4 h-4 inline mr-2 text-teal-500" />
                    {getSessionLabel(regSession, doctor?.sessionTimings)} —{" "}
                    {new Date(`${regDate}T00:00:00`).toLocaleDateString(
                      "en-IN",
                      {
                        day: "numeric",
                        month: "long",
                      },
                    )}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* End Session: only when session is accessible now */}
                    {!isClosed && !cancelled && isSessionAccessibleNow && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                            data-ocid="tokens.close_button"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />
                            End Session
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-ocid="tokens.dialog">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Close This Session?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              All remaining booked tokens will be marked as
                              unvisited and eligible for refund. This cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-ocid="tokens.cancel_button">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleCloseSession}
                              data-ocid="tokens.confirm_button"
                            >
                              Close Session & Process Refunds
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {/* Cancel Session: for future dates or today's sessions before start time */}
                    {canCancelSession && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                            data-ocid="tokens.delete_button"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                            Cancel Session
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-ocid="tokens.dialog">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Cancel This Session?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel the{" "}
                              {getSessionLabel(
                                regSession,
                                doctor?.sessionTimings,
                              )}{" "}
                              session on {regDate}. All booked patients will be
                              refunded.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-ocid="tokens.cancel_button">
                              Keep Session
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleCancelSession}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-ocid="tokens.confirm_button"
                            >
                              Cancel Session
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {cancelled ? (
                  <div className="py-10 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      This session has been cancelled.
                    </p>
                  </div>
                ) : regDate > today ? (
                  /* Future date — show locked state, only cancel available above */
                  <div className="py-12 text-center">
                    <Lock className="w-10 h-10 text-blue-300 mx-auto mb-3" />
                    <p className="text-gray-700 font-semibold text-base">
                      Session Not Yet Started
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      This session is scheduled for{" "}
                      {new Date(`${regDate}T00:00:00`).toLocaleDateString(
                        "en-IN",
                        { weekday: "long", day: "numeric", month: "long" },
                      )}
                      .
                    </p>
                    <p className="text-gray-400 text-sm mt-0.5">
                      Token regulation will be available on that date at{" "}
                      {getSessionStartTime(regSession)}.
                    </p>
                  </div>
                ) : !isSessionAccessibleNow && !isClosed ? (
                  /* Today but session hasn't started yet */
                  <div className="py-12 text-center">
                    <Lock className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                    <p className="text-gray-700 font-semibold text-base">
                      Session Starts at {getSessionStartTime(regSession)}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      The token regulator will unlock automatically when the
                      session start time is reached.
                    </p>
                    <p className="text-gray-400 text-sm mt-0.5">
                      You can cancel this session using the button above if
                      needed.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-3 mb-4">
                      {(
                        [
                          ["#fff", "Available"],
                          ["#ef4444", "Booked"],
                          ["#f97316", "Ongoing"],
                          ["#22c55e", "Done"],
                          ["#7c3aed", "Skipped"],
                        ] as [string, string][]
                      ).map(([color, label]) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-gray-500">{label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {renderTokenGrid()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="space-y-4">
            {/* PHOTO IDENTITY */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Photo Identity
              </p>
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {currentDoctor?.photo ? (
                    <img
                      src={currentDoctor.photo}
                      alt={currentDoctor.name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-teal-100 flex items-center justify-center border-2 border-teal-200">
                      <User className="w-9 h-9 text-teal-600" />
                    </div>
                  )}
                </div>
                {/* Identity info */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-gray-900 truncate">
                    {currentDoctor?.name || profileForm.name || "Doctor Name"}
                  </p>
                  <p className="text-sm text-teal-600 font-medium mt-0.5">
                    {currentDoctor?.specialty ||
                      profileForm.specialty ||
                      "Specialty"}
                  </p>
                  <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-mono">
                    Code: {doctorUser.code}
                  </span>
                  <div className="mt-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
                      onClick={() => photoInputRef.current?.click()}
                      data-ocid="profile.upload_button"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload new photo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PERSONAL DETAILS */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Personal Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-name"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <User className="w-3.5 h-3.5 text-gray-400" /> Full Name
                  </Label>
                  <Input
                    id="doc-name"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, name: e.target.value }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-specialty"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Activity className="w-3.5 h-3.5 text-gray-400" /> Specialty
                  </Label>
                  <Input
                    id="doc-specialty"
                    value={profileForm.specialty}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        specialty: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-phone"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Phone className="w-3.5 h-3.5 text-gray-400" /> Contact
                    Phone
                  </Label>
                  <Input
                    id="doc-phone"
                    value={profileForm.contactPhone}
                    placeholder="e.g. +91 98765 43210"
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        contactPhone: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="doc-exp"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> Years of
                    Experience
                  </Label>
                  <Input
                    id="doc-exp"
                    value={profileForm.yearsOfExperience}
                    placeholder="e.g. 12"
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        yearsOfExperience: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label
                    htmlFor="doc-edu"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-gray-400" /> Education
                    & Qualifications
                  </Label>
                  <Input
                    id="doc-edu"
                    value={profileForm.education}
                    placeholder="e.g. MBBS, MD (Cardiology) — AIIMS Delhi"
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        education: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
              </div>
            </div>

            {/* ABOUT */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                About
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="doc-bio" className="text-sm font-medium">
                  Bio / About the Doctor
                </Label>
                <Textarea
                  id="doc-bio"
                  rows={4}
                  value={profileForm.bio}
                  placeholder="Brief description visible to patients — areas of expertise, approach to care, etc."
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, bio: e.target.value }))
                  }
                  data-ocid="profile.textarea"
                />
              </div>
            </div>

            {/* LANGUAGES SPOKEN */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Languages Spoken
              </p>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Languages className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={langInput}
                    placeholder="e.g. English, Hindi, Tamil..."
                    className="pl-9"
                    onChange={(e) => setLangInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLanguage()}
                    data-ocid="profile.input"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4"
                  onClick={addLanguage}
                  data-ocid="profile.secondary_button"
                >
                  Add
                </Button>
              </div>
              {profileForm.languages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profileForm.languages.map((lang) => (
                    <span
                      key={lang}
                      className="flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200 text-sm px-3 py-1 rounded-full"
                    >
                      <Globe className="w-3 h-3" />
                      {lang}
                      <button
                        type="button"
                        className="ml-0.5 text-teal-400 hover:text-teal-700 transition-colors"
                        onClick={() => removeLanguage(lang)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* SESSION SETTINGS */}
            <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Session Settings
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-price" className="text-sm font-medium">
                    Consultation Fee (₹)
                  </Label>
                  <Input
                    id="doc-price"
                    type="number"
                    value={profileForm.price}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, price: e.target.value }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-tokens" className="text-sm font-medium">
                    Tokens Per Session
                  </Label>
                  <Input
                    id="doc-tokens"
                    type="number"
                    value={profileForm.tokensPerSession}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        tokensPerSession: e.target.value,
                      }))
                    }
                    data-ocid="profile.input"
                  />
                </div>
              </div>

              {/* Session toggles + custom timings */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Available Sessions & Timings
                </Label>
                <p className="text-xs text-gray-400">
                  Enable a session and set your own start/end time. Patients
                  will see your custom timings when booking.
                </p>
                {(["morning", "afternoon", "evening"] as SessionType[]).map(
                  (s) => {
                    const isEnabled = profileForm.sessions.includes(s);
                    const timing =
                      profileForm.sessionTimings[s] ?? DEFAULT_TIMINGS[s];
                    const sessionName = s.charAt(0).toUpperCase() + s.slice(1);
                    return (
                      <div
                        key={s}
                        className={`rounded-xl border-2 p-4 transition-colors ${
                          isEnabled
                            ? "border-teal-200 bg-teal-50/50"
                            : "border-gray-100 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Checkbox
                            id={`sess_${s}`}
                            checked={isEnabled}
                            onCheckedChange={() => toggleSession(s)}
                            data-ocid="profile.checkbox"
                          />
                          <Label
                            htmlFor={`sess_${s}`}
                            className="font-semibold cursor-pointer text-sm"
                          >
                            {sessionName} Session
                          </Label>
                          {isEnabled && (
                            <span className="ml-auto text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                              Active
                            </span>
                          )}
                        </div>
                        {isEnabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500 font-medium">
                                Start Time
                              </Label>
                              <Input
                                type="time"
                                value={timing.start}
                                onChange={(e) =>
                                  updateSessionTiming(
                                    s,
                                    "start",
                                    e.target.value,
                                  )
                                }
                                className="text-sm"
                                data-ocid="profile.input"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500 font-medium">
                                End Time
                              </Label>
                              <Input
                                type="time"
                                value={timing.end}
                                onChange={(e) =>
                                  updateSessionTiming(s, "end", e.target.value)
                                }
                                className="text-sm"
                                data-ocid="profile.input"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pb-2">
              <Button
                className="bg-teal-500 hover:bg-teal-600 text-white px-8"
                onClick={handleSaveProfile}
                data-ocid="profile.save_button"
              >
                <Save className="w-4 h-4 mr-2" /> Save Profile
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Token Action Dialog */}
      <Dialog
        open={tokenDialog.open}
        onOpenChange={(v) => {
          if (!v) setTokenDialog({ open: false, tokenNum: null });
        }}
      >
        <DialogContent className="max-w-sm" data-ocid="tokens.dialog">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Token #{tokenDialog.tokenNum}
            </DialogTitle>
          </DialogHeader>

          {/* Patient info */}
          <div className="space-y-4 py-1">
            <p className="text-sm text-gray-700">
              Patient:{" "}
              <span className="font-semibold">
                {dialogTokenBooking?.patientName ?? "Walk-in / Unknown"}
              </span>
            </p>

            {/* Complaint box */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Patient Complaint
                </span>
              </div>
              {dialogTokenBooking?.complaint ? (
                <p className="text-sm text-gray-700">
                  {dialogTokenBooking.complaint}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No complaint submitted
                </p>
              )}
            </div>

            {/* Action buttons based on token status */}
            {dialogTokenStatus === "orange" ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Status: <span className="font-semibold">Ongoing</span>. Choose
                  an action:
                </p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11"
                  onClick={handleMarkCompleted}
                  data-ocid="tokens.confirm_button"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Completed
                </Button>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11"
                  onClick={handleSkipToken}
                  data-ocid="tokens.secondary_button"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Patient Not Available (Skip)
                </Button>
              </div>
            ) : dialogTokenStatus === "unvisited" ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Status:{" "}
                  <span className="font-semibold text-purple-700">Skipped</span>
                  . Patient was previously unavailable.
                </p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11"
                  onClick={handleCompleteSkipped}
                  data-ocid="tokens.confirm_button"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Completed (Patient Arrived)
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold h-11"
                onClick={handleMarkAsOngoing}
                data-ocid="tokens.primary_button"
              >
                <Activity className="w-4 h-4 mr-2" />
                Mark as Ongoing
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTokenDialog({ open: false, tokenNum: null })}
              data-ocid="tokens.close_button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Priority Slot Dialog */}
      <Dialog
        open={priorityDialog.open}
        onOpenChange={(v) =>
          !v && setPriorityDialog((p) => ({ ...p, open: false }))
        }
      >
        <DialogContent data-ocid="tokens.dialog">
          <DialogHeader>
            <DialogTitle>
              Priority Slot P{priorityDialog.index} — Urgent Visit
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Update the status for this priority slot.
          </p>
          <div className="grid grid-cols-3 gap-3 py-2">
            <Button
              variant="outline"
              className="flex-col h-16 gap-1"
              onClick={() => handlePriorityUpdate("waiting")}
              data-ocid="tokens.secondary_button"
            >
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-xs">Waiting</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-16 gap-1"
              onClick={() => handlePriorityUpdate("ongoing")}
              data-ocid="tokens.secondary_button"
            >
              <Activity className="w-5 h-5 text-orange-500" />
              <span className="text-xs">Ongoing</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-16 gap-1"
              onClick={() => handlePriorityUpdate("completed")}
              data-ocid="tokens.secondary_button"
            >
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-xs">Completed</span>
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPriorityDialog((p) => ({ ...p, open: false }))}
              data-ocid="tokens.close_button"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Action Confirmation Dialog */}
      <Dialog
        open={sessionActionResult !== null}
        onOpenChange={(v) => {
          if (!v) setSessionActionResult(null);
        }}
      >
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          data-ocid="session.dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sessionActionResult?.type === "cancelled" ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {sessionActionResult?.type === "ended"
                ? "Session Ended"
                : "Session Cancelled"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            {sessionActionResult?.type === "ended"
              ? `The ${sessionActionResult.session} session has been successfully ended. All remaining unvisited tokens are marked for refund processing.`
              : `The ${sessionActionResult?.session} session has been successfully cancelled. All booked patients will be notified and refunded.`}
          </p>
          <DialogFooter>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setSessionActionResult(null)}
              data-ocid="session.confirm_button"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="mt-12 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()}. Built with ❤️ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          className="underline hover:text-gray-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
