import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import { SESSION_TIMES } from "../../data/seed";

export default function AdminSessions() {
  const { tokenStates, doctors, hospitals, cancelSession, isSessionCancelled } =
    useStore();

  // Build session list from tokenStates (exclude __cancelled__ key)
  const sessions = Object.values(tokenStates).filter(
    (s) => s.sessionId !== "__cancelled__",
  );

  function getDoctorName(doctorId: string) {
    return doctors.find((d) => d.id === doctorId)?.name ?? "Unknown Doctor";
  }

  function getHospitalName(doctorId: string) {
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor) return "—";
    return hospitals.find((h) => h.id === doctor.hospitalId)?.name ?? "—";
  }

  function getSessionLabel(session: string) {
    return SESSION_TIMES[session]?.label ?? session;
  }

  function getStatus(s: (typeof sessions)[number]) {
    const cancelled = isSessionCancelled(s.doctorId, s.date, s.session);
    if (cancelled) return "cancelled";
    if (s.isClosed) return "closed";
    if (s.currentToken !== null) return "active";
    return "upcoming";
  }

  const statusVariant: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    upcoming: "secondary",
    closed: "outline",
    cancelled: "destructive",
  };

  function handleCancel(s: (typeof sessions)[number]) {
    cancelSession(s.doctorId, s.date, s.session);
    toast.success("Session cancelled");
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Session Management</h1>
        <p className="text-muted-foreground mt-1">
          {sessions.length} sessions tracked
        </p>
      </div>

      {sessions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          data-ocid="admin.empty_state"
        >
          <p className="text-lg font-medium">No sessions yet</p>
          <p className="text-sm mt-1">
            Sessions will appear once doctors start managing tokens
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
                <TableHead>Doctor</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s, idx) => {
                const status = getStatus(s);
                const canCancel = status === "upcoming" || status === "active";
                return (
                  <TableRow
                    key={s.sessionId}
                    data-ocid={`admin.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium">
                      {getDoctorName(s.doctorId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getHospitalName(s.doctorId)}
                    </TableCell>
                    <TableCell className="text-sm">{s.date}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getSessionLabel(s.session)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[status] ?? "secondary"}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleCancel(s)}
                          data-ocid="admin.delete_button"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
