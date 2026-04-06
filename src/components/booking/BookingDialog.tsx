import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Activity, AlertCircle, Calendar, CheckCircle2, Clock,
         CreditCard, FileText, Hash, IndianRupee, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { payments } from "../../api";
import { useStore } from "../../context/StoreContext";
import {
  getAvailableDates, getSessionLabel, isSessionAvailable, makeSessionId,
} from "../../data/seed";
import type { Doctor, Hospital, SessionType } from "../../types";

// Razorpay script loader — loads once
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface Props {
  doctor: Doctor;
  hospital: Hospital;
  open: boolean;
  onClose: () => void;
}

type Step = "date" | "session" | "token" | "complaint" | "payment" | "success";

export default function BookingDialog({ doctor, hospital, open, onClose }: Props) {
  const { user, bookings, tokenStates, isSessionCancelled, getOrCreateTokenState, addBookingToStore } = useStore();
  const [step, setStep]                 = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionType | "">("");
  const [tokenNumber, setTokenNumber]   = useState(0);
  const [complaint, setComplaint]       = useState("");
  const [paying, setPaying]             = useState(false);
  const [payError, setPayError]         = useState("");

  const availableDates = useMemo(() => getAvailableDates(), []);
  const patientUser = user as { id: string; email: string; name: string; role: "patient" };

  // Pre-load token states when dialog opens
  useMemo(() => {
    if (!open) return;
    const today = new Date().toISOString().split("T")[0];
    for (const s of doctor.sessions as SessionType[]) {
      const sid = makeSessionId(doctor.id, today, s);
      getOrCreateTokenState(sid, doctor.id, today, s);
    }
  }, [open, doctor.id]); // eslint-disable-line

  function getBookedCount(date: string, session: string): number {
    const sid = makeSessionId(doctor.id, date, session);
    const state = tokenStates[sid];
    if (state) return Object.keys(state.tokenStatuses).length;
    return bookings.filter(b => b.sessionId === sid && b.paymentDone && b.status !== "cancelled").length;
  }

  function handleClose() {
    setStep("date"); setSelectedDate(""); setSelectedSession("");
    setTokenNumber(0); setComplaint(""); setPayError("");
    onClose();
  }

  function formatDate(d: string) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN",
      { weekday: "short", day: "numeric", month: "short" });
  }
  function getDayName(d: string) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
  }
  function getDayNum(d: string) { return new Date(`${d}T00:00:00`).getDate(); }
  function getMonth(d: string) {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { month: "short" });
  }

  // ── Payment via Razorpay ────────────────────────────────────────────────────
  async function handlePay() {
    setPaying(true);
    setPayError("");
    try {
      // Load Razorpay script
      const loaded = await loadRazorpay();
      if (!loaded) {
        setPayError("Could not load payment gateway. Check your internet connection.");
        setPaying(false);
        return;
      }

      // Step 1: Create order on backend
      const order = await payments.createOrder({
        doctorId: doctor.id,
        date:     selectedDate,
        session:  selectedSession as SessionType,
        complaint: complaint.trim() || undefined,
        phone:    (patientUser as any).phone || undefined,
      });

      // Step 2: Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const options = {
          key:         order.keyId,
          amount:      order.amount,
          currency:    order.currency,
          name:        "Doctor Booked",
          description: `Consultation — ${order.doctorName}`,
          image:       "/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg",
          order_id:    order.orderId,
          prefill: {
            name:    patientUser.name  || "",
            email:   patientUser.email || "",
            contact: (patientUser as any).phone ? `+${(patientUser as any).phone}` : "",
          },
          notes: {
            doctorName:   order.doctorName,
            hospitalName: order.hospitalName,
            date:         selectedDate,
            session:      selectedSession,
          },
          theme: { color: "#14b8a6" },   // teal — matches app colour
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // Step 3: Verify on backend and create booking
              const result = await payments.verifyPayment({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
              });

              if (result.success) {
                // Add booking to local store without a second API call
                if (addBookingToStore) addBookingToStore(result.booking);
                setTokenNumber(result.booking.tokenNumber);
                setStep("success");
                resolve();
              } else {
                reject(new Error("Payment verification failed."));
              }
            } catch (err: any) {
              reject(err);
            }
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (response: any) => {
          reject(new Error(response.error?.description || "Payment failed"));
        });
        rzp.open();
      });

    } catch (err: any) {
      if (err.message !== "Payment cancelled") {
        setPayError(err.message || "Payment failed. Please try again.");
        toast.error(err.message || "Payment failed");
      }
    } finally {
      setPaying(false);
    }
  }

  const consultationFee = doctor.consultationFee || doctor.price || 10;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-ocid="booking.dialog">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === "success" ? "Booking Confirmed!" : "Book Appointment"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Date ── */}
        {step === "date" && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                1. Select Date
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {availableDates.map((date, i) => (
                  <button key={date} type="button"
                    onClick={() => { setSelectedDate(date); setStep("session"); }}
                    className="flex flex-col items-center px-4 py-3 rounded-xl border-2 shrink-0 border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all"
                    data-ocid="booking.button">
                    <span className="text-xs text-gray-500">{getDayName(date)}</span>
                    <span className="text-xl font-bold text-gray-900">{getDayNum(date)}</span>
                    <span className="text-xs text-gray-500">{getMonth(date)}</span>
                    {i === 0 && (
                      <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full mt-1">Today</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Session ── */}
        {step === "session" && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">2. Select Session</p>
              <p className="text-xs text-gray-400 mb-3">{formatDate(selectedDate)}</p>
              <div className="space-y-2">
                {(doctor.sessions as SessionType[]).map((session) => {
                  const available    = isSessionAvailable(selectedDate, session, doctor.sessionTimings);
                  const booked       = getBookedCount(selectedDate, session);
                  const full         = booked >= doctor.tokensPerSession;
                  const cancelled    = isSessionCancelled(doctor.id, selectedDate, session);
                  const closed       = tokenStates[makeSessionId(doctor.id, selectedDate, session)]?.isClosed === true;
                  const unavailable  = !available || full || cancelled || closed;
                  return (
                    <button key={session} type="button"
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        unavailable ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                    : "border-gray-200 hover:border-teal-500 hover:bg-teal-50"
                      }`}
                      disabled={unavailable}
                      onClick={() => {
                        setSelectedSession(session);
                        setTokenNumber(getBookedCount(selectedDate, session) + 1);
                        setStep("token");
                      }}
                      data-ocid="booking.button">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm">{getSessionLabel(session, doctor.sessionTimings)}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          cancelled || closed || full ? "bg-red-100 text-red-600"
                          : !available ? "bg-gray-100 text-gray-500"
                          : "bg-teal-100 text-teal-700"
                        }`}>
                          {cancelled ? "Cancelled" : closed ? "Ended" : full ? "Full"
                           : !available ? "Unavailable"
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

        {/* ── Token preview ── */}
        {step === "token" && (
          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Your Token</p>
                  <p className="text-sm text-gray-600 mt-1">{doctor.name}</p>
                  <p className="text-xs text-gray-400">{formatDate(selectedDate)} · {getSessionLabel(selectedSession as SessionType, doctor.sessionTimings)}</p>
                </div>
                <button type="button" onClick={() => setStep("complaint")}
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                  data-ocid="booking.confirm_button">
                  Generate Token →
                </button>
              </div>
            </div>
            <div className="border-2 border-teal-300 rounded-xl p-6 text-center">
              <Hash className="w-6 h-6 text-teal-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Your Token Number</p>
              <p className="text-6xl font-bold text-teal-600 mt-1">{tokenNumber}</p>
            </div>
          </div>
        )}

        {/* ── Complaint ── */}
        {step === "complaint" && (
          <div className="space-y-4">
            <div className="text-center pb-1">
              <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-teal-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">What brings you in today?</h3>
              <p className="text-sm text-gray-400 mt-1">Your doctor will see this. Optional.</p>
            </div>
            <Textarea rows={4} placeholder="Describe your symptoms or reason for visit... (optional)"
              value={complaint} onChange={e => setComplaint(e.target.value)}
              className="resize-none text-sm" data-ocid="booking.textarea" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-full"
                onClick={() => setStep("payment")} data-ocid="booking.secondary_button">Skip</Button>
              <Button className="flex-1 bg-teal-500 hover:bg-teal-600 rounded-full"
                onClick={() => setStep("payment")} data-ocid="booking.primary_button">Continue to Payment</Button>
            </div>
          </div>
        )}

        {/* ── Payment ── */}
        {step === "payment" && (
          <div className="space-y-4">
            {/* Booking summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Booking Summary</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Doctor</span>
                <span className="font-medium text-gray-900">{doctor.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Hospital</span>
                <span className="font-medium text-gray-900">{hospital.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-medium text-gray-900">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Session</span>
                <span className="font-medium text-gray-900">{getSessionLabel(selectedSession as SessionType, doctor.sessionTimings)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Token</span>
                <span className="font-bold text-teal-600">#{tokenNumber}</span>
              </div>
              <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                <span className="font-semibold text-gray-900">Consultation Fee</span>
                <div className="flex items-center gap-0.5 font-bold text-gray-900 text-lg">
                  <IndianRupee className="w-4 h-4" />
                  {consultationFee}
                </div>
              </div>
            </div>

            {/* Error */}
            {payError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{payError}</p>
              </div>
            )}

            {/* Security note */}
            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              Secured by Razorpay — 100% safe payment
            </div>

            {paying ? (
              <div className="py-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Opening payment gateway…</p>
                <p className="text-xs text-gray-400 mt-1">Please wait</p>
              </div>
            ) : (
              <Button className="w-full h-12 text-base bg-teal-500 hover:bg-teal-600 rounded-full gap-2"
                onClick={handlePay} data-ocid="booking.primary_button">
                <CreditCard className="w-5 h-5" />
                Pay ₹{consultationFee} with Razorpay
              </Button>
            )}
          </div>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <div className="text-center" data-ocid="booking.success_state">
            <div className="h-16 bg-green-500 rounded-t-2xl -mx-6 -mt-2 mb-0 relative flex items-end justify-center pb-0">
              <div className="w-16 h-16 bg-white border-4 border-green-500 rounded-full flex items-center justify-center translate-y-8 shadow-md">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="mt-12 space-y-3">
              <h2 className="text-xl font-bold text-gray-900">Booking Confirmed!</h2>
              <p className="text-xs font-semibold text-teal-600 tracking-widest uppercase">Your Token Number</p>
              <p className="text-6xl font-bold text-gray-900">{tokenNumber}</p>
              <div className="grid grid-cols-2 gap-3 text-sm text-left mt-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <Activity className="w-4 h-4 text-teal-500 shrink-0" /><span>{doctor.name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin className="w-4 h-4 text-teal-500 shrink-0" /><span>{hospital.name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4 text-teal-500 shrink-0" /><span>{formatDate(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{getSessionLabel(selectedSession as SessionType, doctor.sessionTimings)}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-full"
                  onClick={handleClose} data-ocid="booking.close_button">Back to Home</Button>
                <Button className="flex-1 bg-teal-500 hover:bg-teal-600 rounded-full"
                  onClick={() => { handleClose(); toast.success("Track your token from My Bookings!"); }}
                  data-ocid="booking.secondary_button">Track Queue Live</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
