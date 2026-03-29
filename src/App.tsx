import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Calendar, Clock, MapPin } from "lucide-react";
import { motion } from "motion/react";
import TopNav from "./components/layout/TopNav";
import { StoreProvider, useStore } from "./context/StoreContext";
import LoginPage from "./pages/LoginPage";
import AdminPanel from "./pages/admin/AdminPanel";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import HospitalDoctorsPage from "./pages/patient/HospitalDoctorsPage";
import HospitalsPage from "./pages/patient/HospitalsPage";
import MyTokensPage from "./pages/patient/MyTokensPage";
import TokenTrackerPage from "./pages/patient/TokenTrackerPage";
import { RouterProvider, useRouter } from "./router/RouterContext";

const queryClient = new QueryClient();

function LandingPage() {
  const { navigate } = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
              alt="Doctor Booked Logo"
              className="w-9 h-9 rounded-full object-contain bg-white"
            />
            <span>
              <span className="font-bold text-gray-900">Doctor</span>
              <span className="font-bold text-teal-500"> Booked</span>
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate({ path: "/login" })}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-teal-600 transition-colors"
              data-ocid="landing.link"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => navigate({ path: "/login" })}
              className="px-3 sm:px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-full transition-colors whitespace-nowrap"
              data-ocid="landing.primary_button"
            >
              Doctor Portal
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <div className="px-4 pt-6 sm:pt-10 pb-8 sm:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto bg-gradient-to-br from-slate-800 to-teal-900 rounded-3xl p-6 sm:p-12 text-white"
          >
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-2">
                Skip the waiting room.
              </h1>
              <h2 className="text-3xl sm:text-5xl font-bold text-teal-400 leading-tight mb-4 sm:mb-6">
                Track your token live.
              </h2>
              <p className="text-slate-300 text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed">
                Book appointments with top doctors, get a real-time token
                number, and know exactly when it's your turn — all from your
                phone.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => navigate({ path: "/login" })}
                  className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-full font-semibold transition-colors text-center"
                  data-ocid="landing.primary_button"
                >
                  Book an Appointment
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ path: "/login" })}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-full font-semibold transition-colors text-center"
                  data-ocid="landing.secondary_button"
                >
                  Doctor Portal
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Features */}
        <div className="px-4 pb-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <MapPin className="w-5 h-5 text-teal-600" />,
                title: "Find Nearby Hospitals",
                desc: "Browse verified hospitals and clinics near you with real-time doctor availability.",
              },
              {
                icon: <Calendar className="w-5 h-5 text-teal-600" />,
                title: "Book in Seconds",
                desc: "Choose a session, get your token number instantly. No calling, no queuing in person.",
              },
              {
                icon: <Clock className="w-5 h-5 text-teal-600" />,
                title: "Live Queue Tracking",
                desc: "Watch the live token board update in real time so you arrive exactly when needed.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-100">
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

function AppRoutes() {
  const { user } = useStore();
  const { route } = useRouter();

  function renderPage() {
    if (!user) {
      if (route.path === "/") return <LandingPage />;
      return <LoginPage />;
    }
    if (user.role === "admin") return <AdminPanel />;
    if (user.role === "doctor") return <DoctorDashboard />;
    if (route.path === "/patient/hospitals") return <HospitalsPage />;
    if (route.path === "/patient/hospital")
      return <HospitalDoctorsPage id={(route as { id: string }).id} />;
    if (route.path === "/patient/tokens") return <MyTokensPage />;
    if (route.path === "/patient/track") {
      const r = route as { sessionId: string; tokenNumber: number };
      return (
        <TokenTrackerPage sessionId={r.sessionId} tokenNumber={r.tokenNumber} />
      );
    }
    return <HospitalsPage />;
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {user && !isAdmin && <TopNav />}
      <main className="flex-1">{renderPage()}</main>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider>
        <StoreProvider>
          <AppRoutes />
        </StoreProvider>
      </RouterProvider>
    </QueryClientProvider>
  );
}
