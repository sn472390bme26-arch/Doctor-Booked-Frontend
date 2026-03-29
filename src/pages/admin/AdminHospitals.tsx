import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Edit2,
  ImageIcon,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import type { Hospital } from "../../types";

type EditHospitalForm = {
  name: string;
  area: string;
  address: string;
  phone: string;
};

export default function AdminHospitals() {
  const {
    hospitals,
    doctors,
    addHospital,
    deleteHospital,
    updateHospitalPhoto,
    updateHospital,
  } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [photoDialogId, setPhotoDialogId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [form, setForm] = useState({
    name: "",
    area: "",
    address: "",
    phone: "",
  });

  // Edit hospital state
  const [editHospital, setEditHospital] = useState<Hospital | null>(null);
  const [editForm, setEditForm] = useState<EditHospitalForm>({
    name: "",
    area: "",
    address: "",
    phone: "",
  });

  function getDoctorCount(hospitalId: string) {
    return doctors.filter((d) => d.hospitalId === hospitalId).length;
  }

  function handleAdd() {
    if (!form.name || !form.area) {
      toast.error("Name and location are required");
      return;
    }
    const newHospital: Hospital = {
      id: `h_${Date.now()}`,
      name: form.name,
      area: form.area,
      address: form.address,
      phone: form.phone,
      doctorCount: 0,
      rating: 4.0,
      gradient: "from-slate-400 to-slate-600",
    };
    addHospital(newHospital);
    toast.success(`Hospital "${form.name}" added`);
    setForm({ name: "", area: "", address: "", phone: "" });
    setAddOpen(false);
  }

  function handleDelete(id: string) {
    const success = deleteHospital(id, doctors);
    if (!success) {
      toast.error(
        "Cannot delete hospital with assigned doctors. Remove doctors first.",
      );
    } else {
      toast.success("Hospital deleted");
    }
  }

  function handleSavePhoto() {
    if (!photoDialogId) return;
    updateHospitalPhoto(photoDialogId, photoUrl);
    toast.success("Photo updated");
    setPhotoDialogId(null);
    setPhotoUrl("");
    setSelectedFileName("");
  }

  function openEditHospital(hospital: Hospital) {
    setEditHospital(hospital);
    setEditForm({
      name: hospital.name,
      area: hospital.area,
      address: hospital.address ?? "",
      phone: hospital.phone ?? "",
    });
  }

  function handleEditHospital() {
    if (!editHospital) return;
    if (!editForm.name || !editForm.area) {
      toast.error("Name and location are required");
      return;
    }
    updateHospital(editHospital.id, {
      name: editForm.name,
      area: editForm.area,
      address: editForm.address,
      phone: editForm.phone,
    });
    toast.success("Hospital updated");
    setEditHospital(null);
  }

  function readFileAsDataUrl(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoUrl((e.target?.result as string) ?? "");
    };
    reader.readAsDataURL(file);
  }

  function handleFileDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFileAsDataUrl(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFileAsDataUrl(file);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Hospital Management</h1>
          <p className="text-muted-foreground mt-1">
            {hospitals.length} hospitals registered
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button
              className="flex items-center gap-2"
              data-ocid="admin.open_modal_button"
            >
              <Plus className="w-4 h-4" />
              Add Hospital
            </Button>
          </DialogTrigger>
          <DialogContent data-ocid="admin.dialog">
            <DialogHeader>
              <DialogTitle>Add New Hospital</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Hospital Name *</Label>
                <Input
                  placeholder="e.g. City General Hospital"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location / Area *</Label>
                <Input
                  placeholder="e.g. Downtown"
                  value={form.area}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, area: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Full Address</Label>
                <Input
                  placeholder="e.g. 45 Central Avenue"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="e.g. +91 22 4567 8900"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                data-ocid="admin.cancel_button"
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} data-ocid="admin.submit_button">
                Add Hospital
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-border/50">
        <span>✏️</span>
        <span>
          Click the edit icon in the Actions column to modify hospital details.
          Changes are saved immediately.
        </span>
      </div>

      <div
        className="rounded-xl border border-border overflow-hidden bg-card"
        data-ocid="admin.table"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Hospital</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-center">Doctors</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hospitals.map((hospital, idx) => (
              <TableRow key={hospital.id} data-ocid={`admin.item.${idx + 1}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${hospital.gradient} flex items-center justify-center shrink-0`}
                    >
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-medium">{hospital.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {hospital.area}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {hospital.address ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {hospital.phone ?? "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">
                    {getDoctorCount(hospital.id)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditHospital(hospital)}
                      data-ocid="admin.edit_button"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhotoDialogId(hospital.id);
                        setPhotoUrl(hospital.photoUrl ?? "");
                        setSelectedFileName("");
                      }}
                      data-ocid="admin.button"
                    >
                      <ImageIcon className="w-4 h-4 mr-1" />
                      Photo
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          data-ocid="admin.delete_button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-ocid="admin.dialog">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Hospital</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete{" "}
                            <strong>{hospital.name}</strong>? This action cannot
                            be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-ocid="admin.cancel_button">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(hospital.id)}
                            className="bg-destructive hover:bg-destructive/90"
                            data-ocid="admin.confirm_button"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Hospital Dialog */}
      <Dialog
        open={!!editHospital}
        onOpenChange={(open) => !open && setEditHospital(null)}
      >
        <DialogContent data-ocid="admin.dialog">
          <DialogHeader>
            <DialogTitle>Edit Hospital: {editHospital?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Hospital Name *</Label>
              <Input
                placeholder="e.g. City General Hospital"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location / Area *</Label>
              <Input
                placeholder="e.g. Downtown"
                value={editForm.area}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, area: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Full Address</Label>
              <Input
                placeholder="e.g. 45 Central Avenue"
                value={editForm.address}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, address: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="e.g. +91 22 4567 8900"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditHospital(null)}
              data-ocid="admin.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleEditHospital} data-ocid="admin.save_button">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo dialog */}
      <Dialog
        open={!!photoDialogId}
        onOpenChange={(open) => {
          if (!open) {
            setPhotoDialogId(null);
            setSelectedFileName("");
          }
        }}
      >
        <DialogContent data-ocid="admin.dialog">
          <DialogHeader>
            <DialogTitle>Manage Hospital Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {photoUrl && (
              <img
                src={photoUrl}
                alt="Hospital preview"
                className="w-full h-40 object-cover rounded-lg"
              />
            )}

            {/* Drop zone — label wraps hidden input for native click-to-browse */}
            <label
              htmlFor="hospital-photo-upload"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              data-ocid="admin.dropzone"
              className={`flex flex-col items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors py-8 px-4 ${
                isDragOver
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground/30 bg-muted/30 hover:border-primary/60 hover:bg-muted/50"
              }`}
            >
              <UploadCloud
                className={`w-8 h-8 ${
                  isDragOver ? "text-primary" : "text-muted-foreground"
                }`}
              />
              {selectedFileName ? (
                <p className="text-sm font-medium text-foreground text-center break-all">
                  {selectedFileName}
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Drop image here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse
                  </p>
                </>
              )}
              <input
                id="hospital-photo-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPhotoDialogId(null);
                setSelectedFileName("");
              }}
              data-ocid="admin.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleSavePhoto} data-ocid="admin.save_button">
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
