import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
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
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (element: HTMLElement, config: object) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
    __googleInitialized?: boolean;
  }
}

// ── Load the Google GSI script once for the lifetime of the page ──────────────
// Done at module level so it never loads twice regardless of re-renders
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google) { resolve(); return; }
    if (document.getElementById("google-gsi-script")) {
      // Script tag exists but not loaded yet — wait for it
      const existing = document.getElementById("google-gsi-script") as HTMLScriptElement;
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id    = "google-gsi-script";
    script.src   = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export default function LoginPage() {
  const { login } = useStore();
  const { navigate } = useRouter();

  const [patientMode, setPatientMode] = useState<"login" | "signup">("signup");
  const [patientEmail, setPatientEmail]       = useState("");
  const [patientPassword, setPatientPassword] = useState("");
  const [patientName, setPatientName]         = useState("");
  const [doctorCode, setDoctorCode]           = useState("");
  const [doctorPassword, setDoctorPassword]   = useState("");
  const [loading, setLoading]                 = useState(false);
  const [googleLoading, setGoogleLoading]     = useState(false);

  // Stable ref to the Google button container — never recreated
  const googleBtnRef = useRef<HTMLDivElement>(null);
  // Track whether Google is initialized so we don't re-initialize every render
  const googleReadyRef = useRef(false);

  // ── Initialize Google + render button ─────────────────────────────────────
  // Runs once on mount, and again whenever patientMode changes so the button
  // re-renders into the correct tab's container after the DOM paints
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    async function setup() {
      await loadGoogleScript();

      // Initialize only once
      if (!googleReadyRef.current) {
        window.google!.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true, // modern Chrome requirement
        });
        googleReadyRef.current = true;
      }

      // Wait one frame for the DOM to paint before calling renderButton
      // This ensures googleBtnRef.current actually exists in the DOM
      requestAnimationFrame(() => {
        if (googleBtnRef.current && window.google) {
          // Clear any previous button Google injected to avoid duplicates
          googleBtnRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "pill",
            logo_alignment: "left",
            width: Math.min(googleBtnRef.current.offsetWidth || 320, 400),
          });
        }
      });
    }

    setup().catch(console.error);
  }, [patientMode]); // re-render button when switching login ↔ signup

  // ── Google credential callback ────────────────────────────────────────────
  async function handleGoogleCredential(response: { credential: string }) {
    setGoogleLoading(true);
    try {
      const { token, user } = await auth.googleLogin(response.credential);
      login(user, token);
      toast.success(`Welcome, ${(user as any).name || ""}!`);
      navigate({ path: "/patient/hospitals" });
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  function switchPatientMode(mode: "login" | "signup") {
    setPatientMode(mode);
    setPatientEmail("");
    setPatientPassword("");
    setPatientName("");
  }

  // ── Patient Sign Up ────────────────────────────────────────────────────────
  async function handlePatientSignup(e: React.FormEvent) {
    e.preventDefault();
    const name     = patientName.trim();
    const email    = patientEmail.trim().toLowerCase();
    const password = patientPassword;
    if (!name || !email || !password) { toast.error("Please fill all fields"); return; }
    setLoading(true);
    try {
      const { token, user } = await auth.patientSignup(name, email, password);
      login(user, token);
      navigate({ path: "/patient/hospitals" });
    } catch (err: any) {
      toast.error(err.message || "Sign up failed");
    } finally { setLoading(false); }
  }

  // ── Patient Login (also handles hidden admin login) ────────────────────────
  async function handlePatientLogin(e: React.FormEvent) {
    e.preventDefault();
    const email    = patientEmail.trim();
    const password = patientPassword;
    if (!email || !password) { toast.error("Please fill all fields"); return; }
    setLoading(true);
    try {
      if (
        email.toUpperCase() === HIDDEN_ADMIN_CODE.toUpperCase() &&
        password === HIDDEN_ADMIN_PASSWORD
      ) {
        const { token, user } = await auth.adminLogin(HIDDEN_ADMIN_CODE, HIDDEN_ADMIN_PASSWORD);
        login(user, token);
        navigate({ path: "/admin" });
        return;
      }
      const { token, user } = await auth.patientLogin(email.toLowerCase(), password);
      login(user, token);
      navigate({ path: "/patient/hospitals" });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally { setLoading(false); }
  }

  // ── Doctor Login ───────────────────────────────────────────────────────────
  async function handleDoctorLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorCode)     { toast.error("Please enter your doctor code"); return; }
    if (!doctorPassword) { toast.error("Please enter your phone number as password"); return; }
    setLoading(true);
    try {
      const { token, user } = await auth.doctorLogin(doctorCode.trim(), doctorPassword.trim());
      login(user, token);
      navigate({ path: "/doctor" });
    } catch (err: any) {
      toast.error(err.message || "Doctor login failed");
    } finally { setLoading(false); }
  }

  // ── Shared Google button area — uses stable ref, never unmounts ───────────
  const googleSection = GOOGLE_CLIENT_ID ? (
    <div className="space-y-3">
      {googleLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
          Signing in with Google…
        </div>
      ) : (
        // This div uses a stable ref — Google renders its iframe inside here
        // Never wrap this in a conditional or it will unmount and the button dies
        <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
      )}
      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <img
            src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
            alt="Doctor Booked Logo"
            className="w-8 h-8 rounded-full object-cover shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E";
            }}
          />
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
                {/* Left decorative panel */}
                <div className="hidden sm:flex sm:w-2/5 bg-gradient-to-b from-teal-200 to-teal-500 items-end pb-10 px-8 min-h-[280px]">
                  <div>
                    <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                      Your Health,<br />Prioritized.
                    </h2>
                    <p className="text-teal-50 text-sm leading-relaxed">
                      Book appointments, track your token, and skip the waiting room stress.
                    </p>
                  </div>
                </div>

                {/* Right form panel */}
                <div className="flex-1 bg-white p-6 sm:p-8">
                  <div className="mb-5 hidden sm:block">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                      <Activity className="w-6 h-6 text-teal-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Patient Portal</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      {patientMode === "signup" ? "Create your account" : "Welcome back"}
                    </p>
                  </div>

                  {/* Google button — always rendered, ref is stable */}
                  {googleSection}

                  {patientMode === "signup" ? (
                    <form onSubmit={handlePatientSignup} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="patient-name">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input id="patient-name" className="pl-9" placeholder="Your full name"
                            value={patientName} onChange={e => setPatientName(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="patient-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input id="patient-email" type="email" className="pl-9" placeholder="your@email.com"
                            value={patientEmail} onChange={e => setPatientEmail(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="patient-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input id="patient-password" type="password" className="pl-9"
                            placeholder="Create a password (min 6 chars)"
                            value={patientPassword} onChange={e => setPatientPassword(e.target.value)} />
                        </div>
                      </div>
                      <Button type="submit"
                        className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11"
                        disabled={loading}>
                        {loading
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</>
                          : "Sign Up"}
                      </Button>
                      <p className="text-xs text-center text-gray-500">
                        Already have an account?{" "}
                        <button type="button" className="text-teal-600 hover:underline font-medium"
                          onClick={() => switchPatientMode("login")}>Log in</button>
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={handlePatientLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="patient-email-login">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input id="patient-email-login" className="pl-9" placeholder="your@email.com"
                            value={patientEmail} onChange={e => setPatientEmail(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="patient-password-login">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input id="patient-password-login" type="password" className="pl-9"
                            placeholder="Enter your password"
                            value={patientPassword} onChange={e => setPatientPassword(e.target.value)} />
                        </div>
                      </div>
                      <Button type="submit"
                        className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11"
                        disabled={loading}>
                        {loading
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                          : "Login"}
                      </Button>
                      <p className="text-xs text-center text-gray-500">
                        Don't have an account?{" "}
                        <button type="button" className="text-teal-600 hover:underline font-medium"
                          onClick={() => switchPatientMode("signup")}>Sign up</button>
                      </p>
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
                    <img
                      src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
                      alt="Doctor Booked Logo"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Doctor Login</h3>
                  <p className="text-gray-500 text-sm mt-1 text-center">
                    Enter your assigned login credentials
                  </p>
                </div>
                <form onSubmit={handleDoctorLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="doctor-code">Doctor Login Code</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input id="doctor-code" className="pl-9 font-mono tracking-widest"
                        placeholder="DOC-00001"
                        value={doctorCode} onChange={e => setDoctorCode(e.target.value)} />
                    </div>
                    <p className="text-xs text-gray-400">Your unique code assigned by the admin</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="doctor-phone">Phone Number (Password)</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input id="doctor-phone" type="password" className="pl-9"
                        placeholder="Enter your registered phone number"
                        value={doctorPassword} onChange={e => setDoctorPassword(e.target.value)} />
                    </div>
                    <p className="text-xs text-gray-400">
                      Your password is the phone number registered by the admin
                    </p>
                  </div>
                  <Button type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-full h-11"
                    disabled={loading}>
                    {loading
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                      : "Access Dashboard"}
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
