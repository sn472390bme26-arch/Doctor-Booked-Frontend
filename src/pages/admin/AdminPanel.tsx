import {
  BookOpen,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";
import AdminBookings from "./AdminBookings";
import AdminDashboard from "./AdminDashboard";
import AdminDoctors from "./AdminDoctors";
import AdminHospitals from "./AdminHospitals";
import AdminPatients from "./AdminPatients";
import AdminSessions from "./AdminSessions";

const NAV_ITEMS = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/hospitals", label: "Hospitals", icon: Building2 },
  { path: "/admin/doctors", label: "Doctors", icon: UserCog },
  { path: "/admin/patients", label: "Patients", icon: Users },
  { path: "/admin/sessions", label: "Sessions", icon: CalendarCheck },
  { path: "/admin/bookings", label: "Bookings", icon: BookOpen },
] as const;

export default function AdminPanel() {
  const { logout } = useStore();
  const { route, navigate } = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function renderContent() {
    switch (route.path) {
      case "/admin/hospitals":
        return <AdminHospitals />;
      case "/admin/doctors":
        return <AdminDoctors />;
      case "/admin/patients":
        return <AdminPatients />;
      case "/admin/sessions":
        return <AdminSessions />;
      case "/admin/bookings":
        return <AdminBookings />;
      default:
        return <AdminDashboard />;
    }
  }

  const activeItem =
    NAV_ITEMS.find((item) => item.path === route.path) ?? NAV_ITEMS[0];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-admin-sidebar text-admin-sidebar-fg flex-col shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
              alt="Doctor Booked Logo"
              className="w-9 h-9 rounded-lg object-contain bg-white"
            />
            <div>
              <p className="font-bold text-white text-sm">Doctor Booked</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">
                Admin Console
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" data-ocid="admin.panel">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = route.path === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() =>
                  navigate({ path } as Parameters<typeof navigate>[0])
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white/90"
                }`}
                data-ocid="admin.link"
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors"
            data-ocid="admin.button"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-admin-sidebar text-white flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <img
            src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
            alt="Doctor Booked Logo"
            className="w-7 h-7 rounded-lg object-contain bg-white"
          />
          <span className="font-bold text-sm">Doctor Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">{activeItem.label}</span>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            data-ocid="admin.open_modal_button"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-50 bg-black/50 cursor-default"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="md:hidden fixed left-0 top-0 bottom-0 w-72 z-50 bg-admin-sidebar flex flex-col">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/uploads/final_logo_page-0001-019d2d83-8a36-752f-9b4e-dec5e9e187fd-1.jpg"
                  alt="Doctor Booked Logo"
                  className="w-9 h-9 rounded-lg object-contain bg-white"
                />
                <div>
                  <p className="font-bold text-white text-sm">Doctor Booked</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">
                    Admin Console
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10"
                data-ocid="admin.close_button"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1" data-ocid="admin.panel">
              {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                const isActive = route.path === path;
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      navigate({ path } as Parameters<typeof navigate>[0]);
                      setDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-white/60 hover:bg-white/8 hover:text-white/90"
                    }`}
                    data-ocid="admin.link"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="px-3 py-4 border-t border-white/10">
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors"
                data-ocid="admin.button"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        {renderContent()}
      </main>
    </div>
  );
}
