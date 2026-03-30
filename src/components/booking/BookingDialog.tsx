import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Activity } from "lucide-react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Hash,
  IndianRupee,
  Loader2,
  MapPin,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import {
  getAvailableDates,
  getSessionLabel,
  isSessionAvailable,
  makeSessionId,
} from "../../data/seed";
import type { Doctor, Hospital, SessionType } from "../../types";

const STANDARD_FEE = 10;

interface Props {
  doctor: Doctor;
  hospital: Hospital;
  open: boolean;
  onClose: () => void;
}

type Step = "date" | "session" | "token" | "complaint" | "payment" | "success";

export default function BookingDialog({
  doctor,
  hospital,
  open,
  onClose,
}: Props) {
  const {
    user,
    bookings,
    addBooking,
    bookToken,
    tokenStates,
    isSessionCancelled,
    getOrCreateTokenState,
  } = useStore();
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionType | "">("");
  const [paying, setPaying] = useState(false);
  const [tokenNumber, setTokenNumber] = useState(0);
  const [complaint, setComplaint] = useState("");

  const availableDates = useMemo(() => getAvailableDates(), []);

  // Pre-load token states for today so booked counts are accurate
  useMemo(() => {
    if (!open) return;
    const today = new Date().toISOString().split("T")[0];
    for (const session of doctor.sessions as SessionType[]) {
      const sid = makeSessionId(doctor.id, today, session);
      getOrCreateTokenState(sid, doctor.id, today, session);
    }
  }, [open, doctor.id]); // eslint-disable-line

  const availableDates = useMemo(() => getAvailableDates(), []);

  function getBookedCount(date: string, session: string): number {
    const sid = makeSessionId(doctor.id, date, session);
    // Use token state from backend (real count across ALL patients)
    // tokenStatuses keys are token numbers 1..N where each is "red","orange","yellow","green","unvisited"
    const state = tokenStates[sid];
    if (state) {
      return Object.keys(state.tokenStatuses).length;
    }
    // Fallback: count from local bookings if token state not loaded yet
    return bookings.filter((b) => b.sessionId === sid && b.paymentDone && b.status !== "cancelled").length;
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setStep("session");
  }

  function handleSessionSelect(session: SessionType) {
    setSelectedSession(session);
    const count = getBookedCount(selectedDate, session);
    setTokenNumber(count + 1);
    setStep("token");
  }

  function handleConfirm() {
    setStep("complaint");
  }

  async function handlePay() {
    setPaying(true);
    try {
      await addBooking({
        doctorId: doctor.id,
        date: selectedDate,
        session: selectedSession as SessionType,
        complaint: complaint.trim() || undefined,
      });
      setStep("success");
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error(err.message || "Booking failed. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  function handleClose() {
    setStep("date");
    setSelectedDate("");
    setSelectedSession("");
    setTokenNumber(0);
    setComplaint("");
    onClose();
  }

  function formatDate(d: string) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function getDayName(d: string) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
    });
  }
  function getDayNum(d: string) {
    return new Date(`${d}T00:00:00`).getDate();
  }
  function getMonth(d: string) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      month: "short",
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-ocid="booking.dialog">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === "success" ? "Booking Confirmed!" : "Book Appointment"}
          </DialogTitle>
        </DialogHeader>

        {/* Step: Date */}
        {step === "date" && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                1. Select Date
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {availableDates.map((date, i) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => handleDateSelect(date)}
                    className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 shrink-0 transition-all ${"border-gray-200 hover:border-teal-300 hover:bg-teal-50"}`}
                    data-ocid="booking.button"
                  >
                    <span className="text-xs text-gray-500">
                      {getDayName(date)}
                    </span>
                    <span className="text-xl font-bold text-gray-900">
                      {getDayNum(date)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getMonth(date)}
                    </span>
                    {i === 0 && (
                      <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full mt-1">
                        Today
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: Session */}
        {step === "session" && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                2. Select Session
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {formatDate(selectedDate)}
              </p>
              <div className="space-y-2">
                {(doctor.sessions as SessionType[]).map((session) => {
                  const available = isSessionAvailable(
                    selectedDate,
                    session,
                    doctor.sessionTimings,
                  );
                  const booked = getBookedCount(selectedDate, session);
                  const full = booked >= doctor.tokensPerSession;
                  const isCancelledSession = isSessionCancelled(
                    doctor.id,
                    selectedDate,
                    session,
                  );
                  const isClosedSession =
                    tokenStates[makeSessionId(doctor.id, selectedDate, session)]
                      ?.isClosed === true;
                  const isUnavailable =
                    !available || full || isCancelledSession || isClosedSession;
                  const sessionLabel = getSessionLabel(
                    session,
                    doctor.sessionTimings,
                  );
                  return (
                    <button
                      key={session}
                      type="button"
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isUnavailable
                          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                          : "border-gray-200 hover:border-teal-500 hover:bg-teal-50"
                      }`}
                      disabled={isUnavailable}
                      onClick={() => handleSessionSelect(session)}
                      data-ocid="booking.button"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm">
                            {sessionLabel}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            isCancelledSession
                              ? "bg-red-100 text-red-600"
                              : isClosedSession
                                ? "bg-red-100 text-red-600"
                                : full
                                  ? "bg-red-100 text-red-600"
                                  : !available
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-teal-100 text-teal-700"
                          }`}
                        >
                          {isCancelledSession
                            ? "Cancelled"
                            : isClosedSession
                              ? "Ended"
                              : full
                                ? "Full"
                                : !available
                                  ? "Unavailable"
                                  : `${booked} / ${doctor.tokensPerSession} Booked`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step: Token preview */}
        {step === "token" && (
          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">
                    Your Token
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{doctor.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(selectedDate)} ·{" "}
                    {getSessionLabel(
                      selectedSession as SessionType,
                      doctor.sessionTimings,
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                  data-ocid="booking.confirm_button"
                >
                  Generate Token →
                </button>
              </div>
            </div>
            <div className="border-2 border-teal-300 rounded-xl p-6 text-center">
              <Hash className="w-6 h-6 text-teal-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Your Token Number</p>
              <p className="text-6xl font-bold text-teal-600 mt-1">
                {tokenNumber}
              </p>
            </div>
          </div>
        )}

        {/* Step: Complaint */}
        {step === "complaint" && (
          <div className="space-y-4">
            <div className="text-center pb-1">
              <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-teal-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">
                What brings you in today?
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Your doctor will see this before the appointment. This is
                optional.
              </p>
            </div>
            <div className="space-y-2">
              <Textarea
                rows={4}
                placeholder="Describe your symptoms, difficulty, or reason for visit... (optional)"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                className="resize-none text-sm"
                data-ocid="booking.textarea"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setStep("payment")}
                data-ocid="booking.secondary_button"
              >
                Skip
              </Button>
              <Button
                className="flex-1 bg-teal-500 hover:bg-teal-600 rounded-full"
                onClick={() => setStep("payment")}
                data-ocid="booking.primary_button"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <div className="space-y-4 text-center">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500 mb-1">Consultation Fee</p>
              <div className="flex items-center justify-center gap-1 text-3xl font-bold text-gray-900">
                <IndianRupee className="w-6 h-6" />
                {STANDARD_FEE}
              </div>
            </div>
            {paying ? (
              <div className="py-4">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto mb-3" />
                <p className="text-sm font-medium">Processing Payment...</p>
                <p className="text-xs text-gray-400 mt-1">Please wait</p>
              </div>
            ) : (
              <Button
                className="w-full text-base h-12 bg-teal-500 hover:bg-teal-600 rounded-full"
                onClick={handlePay}
                data-ocid="booking.primary_button"
              >
                Pay
              </Button>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="text-center" data-ocid="booking.success_state">
            {/* Green top band */}
            <div className="h-16 bg-green-500 rounded-t-2xl -mx-6 -mt-2 mb-0 relative flex items-end justify-center pb-0">
              <div className="w-16 h-16 bg-white border-4 border-green-500 rounded-full flex items-center justify-center translate-y-8 shadow-md">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="mt-12 space-y-3">
              <h2 className="text-xl font-bold text-gray-900">
                Booking Confirmed!
              </h2>
              <p className="text-xs font-semibold text-teal-600 tracking-widest uppercase">
                Your Token Number
              </p>
              <p className="text-6xl font-bold text-gray-900">{tokenNumber}</p>
              <div className="grid grid-cols-2 gap-3 text-sm text-left mt-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <Activity className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{doctor.name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{hospital.name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{formatDate(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>
                    {getSessionLabel(
                      selectedSession as SessionType,
                      doctor.sessionTimings,
                    )}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={handleClose}
                  data-ocid="booking.close_button"
                >
                  Back to Home
                </Button>
                <Button
                  className="flex-1 bg-teal-500 hover:bg-teal-600 rounded-full"
                  onClick={() => {
                    handleClose();
                    toast.success("Navigate to My Bookings to track!");
                  }}
                  data-ocid="booking.secondary_button"
                >
                  Track Queue Live
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
