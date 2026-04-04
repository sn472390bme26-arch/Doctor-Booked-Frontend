import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, KeyRound, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { auth } from "../api";
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
  | "patient-form"     // signup or login form
  | "otp"              // enter the 6-digit OTP
  | "google-phone"     // Google login — collect phone number
  | "google-otp"       // Google login — verify phone OTP
  | "add-phone";       // existing user needs to add phone

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google) { resolve(); return; }
    if (document.getElementById("google-gsi-script")) {
      (document.getElementById("google-gsi-script") as HTMLScriptElement)
        .addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = "google-gsi-script"; s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export default function LoginPage() {
  const { login } = useStore();
  const { navigate } = useRouter();

  // ── form state ──────────────────────────────────────────────────────────────
  const [patientMode, setPatientMode] = useState<"login" | "signup">("signup");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone]       = useState("");

  // ── OTP state ───────────────────────────────────────────────────────────────
  const [screen, setScreen]     = useState<Screen>("patient-form");
  const [otpId, setOtpId]       = useState("");
  const [otp, setOtp]           = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // ── Google state ─────────────────────────────────────────────────────────────
  const [googleUserId, setGoogleUserId] = useState("");
  const [googlePhone, setGooglePhone]   = useState("");

  // ── Doctor state ─────────────────────────────────────────────────────────────
  const [doctorCode, setDoctorCode]     = useState("");
  const [doctorPass, setDoctorPass]     = useState("");

  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleBtnRef  = useRef<HTMLDivElement>(null);
  const googleReady   = useRef(false);
  const resendRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Resend countdown ─────────────────────────────────────────────────────────
  function startResendTimer() {
    setResendTimer(60);
    if (resendRef.current) clearInterval(resendRef.current);
    resendRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(resendRef.current!); return 0; } return t - 1; });
    }, 1000);
  }

  function maskPhone(p: string) {
    return `+${p.slice(0, 2)}XXXXX${p.slice(-4)}`;
  }

  // ── Google button init ────────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    async function setup() {
      await loadGoogleScript();
      if (!googleReady.current) {
        window.google!.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
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

  // ── Google credential callback ────────────────────────────────────────────
  async function handleGoogleCredential(response: { credential: string }) {
    setGoogleLoading(true);
    try {
      const result = await auth.googleLogin(response.credential);
      if (result.token && result.user) {
        // Phone already verified — straight in
        login(result.user, result.token);
        toast.success(`Welcome, ${(result.user as any).name || ""}!`);
        navigate({ path: "/patient/hospitals" });
      } else if (result.needsPhone) {
        // Need to collect and verify phone
        setGoogleUserId(result.userId!);
        setScreen("google-phone");
      }
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  // ── Google: send OTP to collected phone ───────────────────────────────────
  async function handleGooglePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!googlePhone.trim()) { toast.error("Please enter your phone number"); return; }
    setLoading(true);
    try {
      const res = await auth.googlePhoneOTP(googleUserId, googlePhone.trim());
      setOtpId(res.otpId);
      setMaskedPhone(maskPhone(res.phone));
      setScreen("google-otp");
      startResendTimer();
      if (res.devOtp) toast.info(`[Dev] OTP: ${res.devOtp}`, { duration: 60000 });
      else toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally { setLoading(false); }
  }

  // ── Signup: submit form → send OTP ───────────────────────────────────────
  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !phone.trim()) {
      toast.error("Please fill all fields including phone number"); return;
    }
    setLoading(true);
    try {
      const res = await auth.patientSignupRequestOTP(name.trim(), email.trim().toLowerCase(), password, phone.trim());
      setOtpId(res.otpId);
      setMaskedPhone(maskPhone(res.phone));
      setScreen("otp");
      startResendTimer();
      if (res.devOtp) toast.info(`[Dev] OTP: ${res.devOtp}`, { duration: 60000 });
      else toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally { setLoading(false); }
  }

  // ── Login: submit form → send OTP (or log in if no phone saved yet) ───────
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    const pw = password;
    if (!em || !pw) { toast.error("Please fill all fields"); return; }

    // Hidden admin detection
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
      const res = await auth.patientLoginRequestOTP(em.toLowerCase(), pw);

      if (res.token && res.user) {
        // Old account without phone — log in and prompt to add phone
        login(res.user, res.token);
        if (res.needsPhone) {
          navigate({ path: "/patient/hospitals" });
          toast.info("Please add your phone number in settings for appointment reminders.");
        } else {
          navigate({ path: "/patient/hospitals" });
        }
        return;
      }

      if (res.otpId) {
        setOtpId(res.otpId);
        setMaskedPhone(maskPhone(res.phone!));
        setScreen("otp");
        startResendTimer();
        if (res.devOtp) toast.info(`[Dev] OTP: ${res.devOtp}`, { duration: 60000 });
        else toast.success(res.message!);
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally { setLoading(false); }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (otp.trim().length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      const { token, user } = await auth.verifyOTP(otpId, otp.trim());
      login(user, token);
      toast.success("Verified! Welcome to Doctor Booked.");
      navigate({ path: "/patient/hospitals" });
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally { setLoading(false); }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendTimer > 0) return;
    try {
      const res = await auth.resendOTP(otpId);
      startResendTimer();
      if (res.devOtp) toast.info(`[Dev] New OTP: ${res.devOtp}`, { duration: 60000 });
      else toast.success(res.message);
    } catch (err: any) { toast.error(err.message || "Failed to resend OTP"); }
  }

  // ── Doctor login ──────────────────────────────────────────────────────────
  async function handleDoctorLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorCode || !doctorPass) { toast.error("Please fill all fields"); return; }
    setLoading(true);
    try {
      const { token, user } = await auth.doctorLogin(doctorCode.trim(), doctorPass.trim());
      login(user, token); navigate({ path: "/doctor" });
    } catch (err: any) { toast.error(err.message || "Doctor login failed"); }
    finally { setLoading(false); }
  }

  function switchMode(mode: "login" | "signup") {
    setPatientMode(mode); setScreen("patient-form");
    setEmail(""); setPassword(""); setName(""); setPhone(""); setOtp("");
  }

  // ── Shared Google button ───────────────────────────────────────────────────
  const googleSection = GOOGLE_CLIENT_ID && screen === "patient-form" ? (
    <div className="space-y-3 mb-4">
      {googleLoading
        ? <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2.5">
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

  // ── OTP screen ─────────────────────────────────────────────────────────────
  if (screen === "otp" || screen === "google-otp") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verify your phone</h2>
            <p className="text-sm text-gray-500 mt-2">
              We sent a 6-digit OTP to <span className="font-semibold text-gray-700">{maskedPhone}</span>
            </p>
          </div>
          <form onSubmit={screen === "google-otp"
            ? async (e) => {
                e.preventDefault();
                if (otp.trim().length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
                setLoading(true);
                try {
                  const { token, user } = await auth.verifyOTP(otpId, otp.trim());
                  login(user, token);
                  toast.success("Phone verified! Welcome.");
                  navigate({ path: "/patient/hospitals" });
                } catch (err: any) { toast.error(err.message || "Invalid OTP"); }
                finally { setLoading(false); }
              }
            : handleVerifyOTP
          } className="space-y-4">
            <div className="space-y-1.5">
              <Label>Enter OTP</Label>
              <Input
                className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Verify OTP"}
            </Button>
            <div className="text-center text-sm text-gray-500">
              Didn't receive it?{" "}
              <button type="button"
                className={`font-medium ${resendTimer > 0 ? "text-gray-400 cursor-not-allowed" : "text-teal-600 hover:underline"}`}
                onClick={handleResend} disabled={resendTimer > 0}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </button>
            </div>
            <button type="button" className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
              onClick={() => { setScreen("patient-form"); setOtp(""); }}>
              ← Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Google phone collection screen ─────────────────────────────────────────
  if (screen === "google-phone") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">One last step</h2>
            <p className="text-sm text-gray-500 mt-2">
              Add your phone number to receive appointment reminders and OTP verification.
            </p>
          </div>
          <form onSubmit={handleGooglePhoneSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="g-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input id="g-phone" type="tel" className="pl-9"
                  placeholder="e.g. 9876543210"
                  value={googlePhone} onChange={e => setGooglePhone(e.target.value)} />
              </div>
              <p className="text-xs text-gray-400">Indian number without country code e.g. 9876543210</p>
            </div>
            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP…</> : "Send OTP"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main login/signup screen ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
                    <form onSubmit={handleSignupSubmit} className="space-y-3">
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
                      <div className="space-y-1.5">
                        <Label>Phone Number</Label>
                        <div className="relative"><Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input type="tel" className="pl-9" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                        <p className="text-xs text-gray-400">For OTP verification & appointment reminders</p>
                      </div>
                      <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11 mt-1" disabled={loading}>
                        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP…</> : "Sign Up & Verify Phone"}
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
                          <Input type="password" className="pl-9" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} /></div>
                      </div>
                      <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
                        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP…</> : "Login"}
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
                    <p className="text-xs text-gray-400">Your unique code assigned by the admin</p>
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
