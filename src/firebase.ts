/**
 * firebase.ts — Firebase client configuration
 * All values come from Vite env vars (VITE_FIREBASE_*)
 * Set these in Vercel environment variables
 */
import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
};

// Initialise only once across hot reloads
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

// ── reCAPTCHA verifier ────────────────────────────────────────────────────────
// Must be "invisible" so it doesn't show a challenge to the user
let _recaptchaVerifier: RecaptchaVerifier | null = null;

export function getRecaptchaVerifier(buttonId: string): RecaptchaVerifier {
  // Clear stale verifier if it exists
  if (_recaptchaVerifier) {
    try { _recaptchaVerifier.clear(); } catch {}
    _recaptchaVerifier = null;
  }
  _recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, buttonId, {
    size: "invisible",
    callback: () => {},        // fires when reCAPTCHA is solved (invisible = automatic)
    "expired-callback": () => {
      // Reset on expiry so next attempt works
      if (_recaptchaVerifier) {
        try { _recaptchaVerifier.clear(); } catch {}
        _recaptchaVerifier = null;
      }
    },
  });
  return _recaptchaVerifier;
}

// ── Send OTP via Firebase ─────────────────────────────────────────────────────
// phone must be in E.164 format: +919876543210
export async function sendFirebaseOTP(
  phone: string,
  buttonId: string,
): Promise<ConfirmationResult> {
  const verifier = getRecaptchaVerifier(buttonId);
  return await signInWithPhoneNumber(firebaseAuth, phone, verifier);
}

// ── Format phone to E.164 ─────────────────────────────────────────────────────
export function toE164(phone: string, defaultCountry = "91"): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${defaultCountry}${digits}`;
}
