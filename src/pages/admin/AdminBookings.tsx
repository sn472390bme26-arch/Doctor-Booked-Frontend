import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen } from "lucide-react";
import { useStore } from "../../context/StoreContext";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  unvisited: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminBookings() {
  const { bookings } = useStore();

  const recentBookings = [...bookings].reverse().slice(0, 100);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Booking Management</h1>
        <p className="text-muted-foreground mt-1">
          Showing last {Math.min(bookings.length, 100)} bookings (read-only)
        </p>
      </div>

      {recentBookings.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          data-ocid="admin.empty_state"
        >
          <BookOpen className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No bookings yet</p>
          <p className="text-sm mt-1">
            Bookings will appear after patients book tokens
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border border-border overflow-hidden bg-card"
          data-ocid="admin.table"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Token #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentBookings.map((booking, idx) => (
                <TableRow key={booking.id} data-ocid={`admin.item.${idx + 1}`}>
                  <TableCell className="font-mono font-bold text-primary">
                    #{booking.tokenNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    {booking.patientName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {booking.doctorName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {booking.hospitalName}
                  </TableCell>
                  <TableCell className="text-sm">{booking.date}</TableCell>
                  <TableCell className="text-sm capitalize">
                    {booking.session}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[booking.status] ??
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {booking.status.charAt(0).toUpperCase() +
                        booking.status.slice(1)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
