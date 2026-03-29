import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Building2,
  CalendarCheck,
  RefreshCw,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";

const STAT_CARD_DEFS = [
  {
    label: "Total Hospitals",
    key: "totalHospitals" as const,
    icon: Building2,
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    label: "Total Doctors",
    key: "totalDoctors" as const,
    icon: UserCog,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    label: "Total Patients",
    key: "totalPatients" as const,
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-50",
  },
  {
    label: "Total Bookings",
    key: "totalBookings" as const,
    icon: CalendarCheck,
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
  {
    label: "Active Sessions",
    key: "activeSessions" as const,
    icon: Activity,
    color: "text-rose-500",
    bg: "bg-rose-50",
  },
];

export default function AdminDashboard() {
  const { getStats } = useStore();
  const [stats, setStats] = useState(() => getStats());

  // Re-derive stats whenever store data changes
  useEffect(() => { setStats(getStats()); }, [getStats]);

  function refresh() { setStats(getStats()); }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            System-wide statistics at a glance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          className="flex items-center gap-2"
          data-ocid="admin.button"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5"
        data-ocid="admin.panel"
      >
        {STAT_CARD_DEFS.map((card) => (
          <Card
            key={card.label}
            className="border border-border shadow-sm"
            data-ocid="admin.card"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-foreground">
                  {stats[card.key]}
                </span>
                <div
                  className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}
                >
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Navigate to sections using the sidebar to manage hospitals,
              doctors, patients, sessions, and bookings.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Hospitals", "Doctors", "Patients", "Sessions", "Bookings"].map(
                (item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-base">System Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">MediToken v1.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data Store</span>
              <span className="font-medium">SQLite Database</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Refreshed</span>
              <span className="font-medium">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
