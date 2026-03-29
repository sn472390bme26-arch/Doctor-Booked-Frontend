import { Button } from "@/components/ui/button";
import { BookOpen, Hospital, LogOut, User } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";

export default function TopNav() {
  const { user, logout, doctors } = useStore();
  const { navigate, route } = useRouter();

  // Resolve display name: for doctors look up from live doctors list
  const displayName =
    user?.role === "patient"
      ? (user as { name: string }).name
      : user?.role === "doctor"
        ? (doctors.find((d) => d.code === (user as { code: string }).code)?.name ?? "Doctor")
        : "Admin";

  const isPatient = user?.role === "patient";
  const isDoctor  = user?.role === "doctor";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-3 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-6">
        {/* Logo */}
        <button
          type="button"
          className="flex items-center gap-1.5 shrink-0"
          onClick={() =>
            navigate(isDoctor ? { path: "/doctor" } : { path: "/patient/hospitals" })
          }
          data-ocid="nav.link"
        >
          <img
            src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
            alt="Doctor Booked Logo"
            className="w-8 h-8 rounded-full object-cover"
          />
          <span className="text-sm sm:text-base hidden xs:inline">
            <span className="font-bold text-gray-900">Doctor</span>
            <span className="font-bold text-teal-500"> Booked</span>
          </span>
        </button>

        {/* Patient nav */}
        {isPatient && (
          <nav className="flex items-center gap-1 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={`text-sm gap-1.5 ${route.path === "/patient/hospitals" ? "text-teal-600 bg-teal-50" : "text-gray-600"}`}
              onClick={() => navigate({ path: "/patient/hospitals" })}
              data-ocid="nav.link"
            >
              <Hospital className="w-4 h-4" /> Hospitals
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`text-sm gap-1.5 ${route.path === "/patient/tokens" ? "text-teal-600 bg-teal-50" : "text-gray-600"}`}
              onClick={() => navigate({ path: "/patient/tokens" })}
              data-ocid="nav.link"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">My Bookings</span>
            </Button>
          </nav>
        )}

        {isDoctor && <div className="flex-1" />}

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
            <User className="w-3.5 h-3.5" />
            {displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-red-500 gap-1.5"
            onClick={logout}
            data-ocid="nav.logout_button"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
