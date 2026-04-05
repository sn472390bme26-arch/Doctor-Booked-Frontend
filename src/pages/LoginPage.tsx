import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, KeyRound, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { auth } from "../api";
import { sendFirebaseOTP, toE164 } from "../firebase";
import type { ConfirmationResult } from "firebase/auth";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

const HIDDEN_ADMIN_CODE     = "ADMIN-001";
const HIDDEN_ADMIN_PASSWORD = "1234";
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "";

declare global {
  interface Window {
    google?: {
      accounts: { id: {
        initialize: (c: object) => void;
        renderButton: (el: HTMLElement, c: object) => void;
      }};
    };
  }
}

type Screen =
  | "patient-form"   // signup / login form
  | "phone-input"    // collect phone (signup or google)
  | "otp"            // enter OTP after Firebase sends it
  | "google-phone";  // Google login: collect phone for first-time users

// ── Load Google GSI script once ───────────────────────────────────────────────
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google) { resolve(); return; }
    const existing = document.getElementById("google-gsi-script");
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); return; }
    const s = document.createElement("script");
    s.id = "google-gsi-script"; s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export default function LoginPage() {
  const { login } = useStore();
  const { navigate } = useRouter();

  const [patientMode, setPatientMode] = useState<"login" | "signup">("signup");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  // Phone & OTP screens
  const [screen, setScreen]               = useState<Screen>("patient-form");
  const [phone, setPhone]                 = useState("");
  const [otp, setOtp]                     = useState("");
  const [maskedPhone, setMaskedPhone]     = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const [resendTimer, setResendTimer]     = useState(0);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pending data held between screens
  const pendingSignup = useRef<{ name: string; email: string; password: string } | null>(null);
  const pendingLogin  = useRef<{ userId: string } | null>(null);
  const pendingGoogle = useRef<{ userId: string } | null>(null);

  // Doctor
  const [doctorCode, setDoctorCode] = useState("");
  const [doctorPass, setDoctorPass] = useState("");

  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleReady  = useRef(false);

  // ── Resend countdown ────────────────────────────────────────────────────────
  function startResendTimer() {
    setResendTimer(60);
    if (resendRef.current) clearInterval(resendRef.current);
    resendRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(resendRef.current!); return 0; } return t - 1; });
    }, 1000);
  }

  function maskPhone(e164: string) {
    const d = e164.replace("+", "");
    return `+${d.slice(0, 2)}XXXXX${d.slice(-4)}`;
  }

  // ── Google button ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || screen !== "patient-form") return;
    async function setup() {
      await loadGoogleScript();
      if (!googleReady.current) {
        window.google!.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false, cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        });
        googleReady.current = true;
      }
      requestAnimationFrame(() => {
        if (googleBtnRef.current && window.google) {
          googleBtnRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard", theme: "outline", size: "large",
            text: "continue_with", shape: "pill", logo_alignment: "left",
            width: Math.min(googleBtnRef.current.offsetWidth || 320, 400),
          });
        }
      });
    }
    setup().catch(console.error);
  }, [patientMode, screen]);

  // ── Google credential callback ──────────────────────────────────────────────
  async function handleGoogleCredential(response: { credential: string }) {
    setGoogleLoading(true);
    try {
      const result = await auth.googleLogin(response.credential);
      if (result.token && result.user) {
        login(result.user, result.token);
        toast.success(`Welcome, ${(result.user as any).name || ""}!`);
        navigate({ path: "/patient/hospitals" });
      } else if (result.needsPhone) {
        pendingGoogle.current = { userId: result.userId! };
        setScreen("google-phone");
      }
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
    } finally { setGoogleLoading(false); }
  }

  // ── STEP 1 — Signup: collect form data → move to phone input screen ─────────
  function handleSignupNext(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Please fill Name, Email and Password first"); return;
    }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    pendingSignup.current = { name: name.trim(), email: email.trim().toLowerCase(), password };
    setScreen("phone-input");
  }

  // ── STEP 1 — Login: verify credentials → get phone from backend ──────────────
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    const pw = password;
    if (!em || !pw) { toast.error("Please fill all fields"); return; }

    // Hidden admin
    if (em.toUpperCase() === HIDDEN_ADMIN_CODE.toUpperCase() && pw === HIDDEN_ADMIN_PASSWORD) {
      setLoading(true);
      try {
        const { token, user } = await auth.adminLogin(HIDDEN_ADMIN_CODE, HIDDEN_ADMIN_PASSWORD);
        login(user, token); navigate({ path: "/admin" });
      } catch (err: any) { toast.error(err.message || "Admin login failed"); }
      finally { setLoading(false); }
      return;
    }

    setLoading(true);
    try {
      const res = await auth.patientLogin(em.toLowerCase(), pw);

      // Old account with no phone — log straight in
      if (res.token && res.user) {
        login(res.user, res.token);
        navigate({ path: "/patient/hospitals" });
        if (res.needsPhone) toast.info("Add your phone number for appointment reminders.");
        return;
      }

      // Has phone — move to OTP screen
      if (res.userId && res.phone) {
        pendingLogin.current = { userId: res.userId };
        const e164 = `+${res.phone}`;
        setMaskedPhone(res.maskedPhone || maskPhone(e164));
        // Send Firebase OTP to the phone number on record
        const confirmation = await sendFirebaseOTP(e164, "firebase-recaptcha-login");
        setConfirmResult(confirmation);
        setScreen("otp");
        startResendTimer();
        toast.success(`OTP sent to ${res.maskedPhone}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally { setLoading(false); }
  }

  // ── STEP 2 — Phone input: send Firebase OTP ─────────────────────────────────
  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { toast.error("Enter your phone number"); return; }
    const e164 = toE164(phone.trim());
    setLoading(true);
    try {
      const confirmation = await sendFirebaseOTP(e164, "firebase-recaptcha-signup");
      setConfirmResult(confirmation);
      setMaskedPhone(maskPhone(e164));
      setScreen("otp");
      startResendTimer();
      toast.success(`OTP sent to ${maskPhone(e164)}`);
    } catch (err: any) {
      toast.error(err.message?.includes("too-many-requests")
        ? "Too many attempts. Please wait a few minutes."
        : err.message || "Failed to send OTP");
    } finally { setLoading(false); }
  }

  // ── Google phone: send OTP ───────────────────────────────────────────────────
  async function handleGooglePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { toast.error("Enter your phone number"); return; }
    const e164 = toE164(phone.trim());
    setLoading(true);
    try {
      const confirmation = await sendFirebaseOTP(e164, "firebase-recaptcha-google");
      setConfirmResult(confirmation);
      setMaskedPhone(maskPhone(e164));
      setScreen("otp");
      startResendTimer();
      toast.success(`OTP sent to ${maskPhone(e164)}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally { setLoading(false); }
  }

  // ── STEP 3 — Verify OTP (works for all flows) ────────────────────────────────
  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (otp.trim().length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    if (!confirmResult) { toast.error("OTP session expired. Please go back and try again."); return; }
    setLoading(true);
    try {
      // Confirm OTP with Firebase — this gives us a Firebase user
      const firebaseUser = await confirmResult.confirm(otp.trim());
      // Get the Firebase ID token to send to our backend for verification
      const firebaseIdToken = await firebaseUser.user.getIdToken();

      if (pendingSignup.current) {
        // Signup flow: create account in our DB
        const { name: n, email: em, password: pw } = pendingSignup.current;
        const { token, user } = await auth.patientSignup(n, em, pw, firebaseIdToken);
        login(user, token);
        toast.success("Account created! Welcome to Doctor Booked.");
        navigate({ path: "/patient/hospitals" });

      } else if (pendingLogin.current) {
        // Login flow: verify and log in
        const { token, user } = await auth.patientLoginVerify(pendingLogin.current.userId, firebaseIdToken);
        login(user, token);
        toast.success("Welcome back!");
        navigate({ path: "/patient/hospitals" });

      } else if (pendingGoogle.current) {
        // Google flow: save phone to account
        const { token, user } = await auth.googleVerifyPhone(pendingGoogle.current.userId, firebaseIdToken);
        login(user, token);
        toast.success("Phone verified! Welcome.");
        navigate({ path: "/patient/hospitals" });
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("invalid-verification-code") || msg.includes("code-expired"))
        toast.error("Incorrect or expired OTP. Please try again.");
      else
        toast.error(msg || "Verification failed");
    } finally { setLoading(false); }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendTimer > 0 || !phone.trim()) return;
    const e164 = toE164(phone.trim());
    const btnId = pendingSignup.current ? "firebase-recaptcha-signup"
                : pendingLogin.current  ? "firebase-recaptcha-login"
                : "firebase-recaptcha-google";
    try {
      const confirmation = await sendFirebaseOTP(e164, btnId);
      setConfirmResult(confirmation);
      setOtp("");
      startResendTimer();
      toast.success("New OTP sent.");
    } catch (err: any) { toast.error(err.message || "Failed to resend"); }
  }

  // ── Doctor login ────────────────────────────────────────────────────────────
  async function handleDoctorLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorCode || !doctorPass) { toast.error("Please fill all fields"); return; }
    setLoading(true);
    try {
      const { token, user } = await auth.doctorLogin(doctorCode.trim(), doctorPass.trim());
      login(user, token); navigate({ path: "/doctor" });
    } catch (err: any) { toast.error(err.message || "Login failed"); }
    finally { setLoading(false); }
  }

  function switchMode(mode: "login" | "signup") {
    setPatientMode(mode); setScreen("patient-form");
    setName(""); setEmail(""); setPassword(""); setPhone(""); setOtp("");
    pendingSignup.current = null; pendingLogin.current = null; pendingGoogle.current = null;
  }

  // ── Google section (only on patient-form screen) ──────────────────────────────
  const googleSection = GOOGLE_CLIENT_ID && screen === "patient-form" ? (
    <div className="space-y-3 mb-4">
      {googleLoading
        ? <div className="flex justify-center items-center gap-2 text-sm text-gray-500 py-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-teal-500" /> Signing in with Google…
          </div>
        : <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
      }
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────────
  // OTP Screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === "otp") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        {/* Hidden reCAPTCHA containers for resend */}
        <div id="firebase-recaptcha-signup" />
        <div id="firebase-recaptcha-login" />
        <div id="firebase-recaptcha-google" />

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verify your phone</h2>
            <p className="text-sm text-gray-500 mt-2">
              OTP sent to <span className="font-semibold text-gray-700">{maskedPhone}</span>
            </p>
          </div>
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Enter 6-digit OTP</Label>
              <Input
                className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                placeholder="· · · · · ·"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Verify OTP"}
            </Button>
            <p className="text-center text-sm text-gray-500">
              Didn't receive it?{" "}
              <button type="button"
                className={`font-medium ${resendTimer > 0 ? "text-gray-300 cursor-not-allowed" : "text-teal-600 hover:underline"}`}
                onClick={handleResend} disabled={resendTimer > 0}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </button>
            </p>
            <button type="button" className="w-full text-xs text-gray-400 hover:text-gray-600 text-center mt-1"
              onClick={() => { setScreen(pendingGoogle.current ? "google-phone" : "patient-form"); setOtp(""); }}>
              ← Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phone Input Screen (signup)
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === "phone-input") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        {/* Hidden reCAPTCHA container — invisible, required by Firebase */}
        <div id="firebase-recaptcha-signup" />

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verify your phone</h2>
            <p className="text-sm text-gray-500 mt-2">
              We'll send a one-time code to verify your number.
            </p>
          </div>
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input type="tel" className="pl-9" placeholder="9876543210"
                  value={phone} onChange={e => setPhone(e.target.value)} autoFocus />
              </div>
              <p className="text-xs text-gray-400">Indian number without country code, e.g. 9876543210</p>
            </div>
            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP…</> : "Send OTP"}
            </Button>
            <button type="button" className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
              onClick={() => setScreen("patient-form")}>← Back</button>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Google Phone Screen (first-time Google users)
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === "google-phone") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div id="firebase-recaptcha-google" />
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">One last step</h2>
            <p className="text-sm text-gray-500 mt-2">
              Add your phone number to receive appointment reminders and for account security.
            </p>
          </div>
          <form onSubmit={handleGooglePhoneSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input type="tel" className="pl-9" placeholder="9876543210"
                  value={phone} onChange={e => setPhone(e.target.value)} autoFocus />
              </div>
              <p className="text-xs text-gray-400">Indian number without country code</p>
            </div>
            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP…</> : "Send OTP"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Login / Signup Screen
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hidden reCAPTCHA container for login flow */}
      <div id="firebase-recaptcha-login" style={{ position: "absolute" }} />

      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <img src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
            alt="Doctor Booked" className="w-8 h-8 rounded-full object-cover shrink-0"
            onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E"; }} />
          <span className="text-base">
            <span className="font-bold text-gray-900">Doctor</span>
            <span className="font-bold text-teal-500"> Booked</span>
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-4xl">
          <Tabs defaultValue="patient" className="w-full">
            <TabsList className="grid w-full max-w-xs mx-auto grid-cols-2 mb-6 sm:mb-8">
              <TabsTrigger value="patient">Patient</TabsTrigger>
              <TabsTrigger value="doctor">Doctor</TabsTrigger>
            </TabsList>

            {/* ── Patient tab ── */}
            <TabsContent value="patient">
              <div className="flex flex-col sm:flex-row max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="hidden sm:flex sm:w-2/5 bg-gradient-to-b from-teal-200 to-teal-500 items-end pb-10 px-8 min-h-[280px]">
                  <div>
                    <h2 className="text-2xl font-bold text-white leading-tight mb-2">Your Health,<br />Prioritized.</h2>
                    <p className="text-teal-50 text-sm leading-relaxed">Book appointments, track your token, and skip the waiting room stress.</p>
                  </div>
                </div>
                <div className="flex-1 bg-white p-6 sm:p-8">
                  <div className="mb-5 hidden sm:block">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                      <Activity className="w-6 h-6 text-teal-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Patient Portal</h3>
                    <p className="text-gray-500 text-sm mt-1">{patientMode === "signup" ? "Create your account" : "Welcome back"}</p>
                  </div>

                  {googleSection}

                  {patientMode === "signup" ? (
                    <form onSubmit={handleSignupNext} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Full Name</Label>
                        <div className="relative"><User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input className="pl-9" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <div className="relative"><Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input type="email" className="pl-9" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Password</Label>
                        <div className="relative"><Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input type="password" className="pl-9" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} /></div>
                      </div>
                      <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11 mt-1" disabled={loading}>
                        Continue →
                      </Button>
                      <p className="text-xs text-center text-gray-500">Already have an account?{" "}
                        <button type="button" className="text-teal-600 hover:underline font-medium" onClick={() => switchMode("login")}>Log in</button></p>
                    </form>
                  ) : (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <div className="relative"><Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input className="pl-9" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Password</Label>
                        <div className="relative"><Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input type="password" className="pl-9" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} /></div>
                      </div>
                      <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
                        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Login"}
                      </Button>
                      <p className="text-xs text-center text-gray-500">Don't have an account?{" "}
                        <button type="button" className="text-teal-600 hover:underline font-medium" onClick={() => switchMode("signup")}>Sign up</button></p>
                    </form>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Doctor tab ── */}
            <TabsContent value="doctor">
              <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden mb-4">
                    <img src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
                      alt="Doctor Booked" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E"; }} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Doctor Login</h3>
                  <p className="text-gray-500 text-sm mt-1 text-center">Enter your assigned login credentials</p>
                </div>
                <form onSubmit={handleDoctorLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Doctor Login Code</Label>
                    <div className="relative"><KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input className="pl-9 font-mono tracking-widest" placeholder="DOC-00001" value={doctorCode} onChange={e => setDoctorCode(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone Number (Password)</Label>
                    <div className="relative"><Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input type="password" className="pl-9" placeholder="Your registered phone number" value={doctorPass} onChange={e => setDoctorPass(e.target.value)} /></div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 rounded-full h-11" disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Access Dashboard"}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
