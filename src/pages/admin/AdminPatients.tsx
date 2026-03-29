import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import { useStore } from "../../context/StoreContext";

export default function AdminPatients() {
  const { patients, bookings } = useStore();

  function getBookingCount(patientId: string) {
    return bookings.filter((b) => b.patientId === patientId).length;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Patient Management</h1>
        <p className="text-muted-foreground mt-1">
          {patients.length} registered patients (read-only)
        </p>
      </div>

      {patients.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          data-ocid="admin.empty_state"
        >
          <Users className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No patients registered yet</p>
          <p className="text-sm mt-1">
            Patients will appear here after they log in
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
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-center">Total Bookings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient, idx) => (
                <TableRow key={patient.id} data-ocid={`admin.item.${idx + 1}`}>
                  <TableCell className="text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {patient.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(patient.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {getBookingCount(patient.id)}
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
