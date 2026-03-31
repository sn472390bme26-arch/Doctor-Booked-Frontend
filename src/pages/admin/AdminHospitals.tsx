import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge }   from "@/components/ui/badge";
import { Button }  from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, CheckCircle2, Edit2, ImageIcon, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast }  from "sonner";
import { useStore } from "../../context/StoreContext";
import type { Hospital } from "../../types";

// Resolve photo URL — base64 data URLs work as-is; relative paths need Railway prefix
function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  const base = (import.meta.env.VITE_API_URL as string || "").replace(/\/api$/, "");
  return base ? `${base}${url}` : url;
}

type EditHospitalForm = { name: string; area: string; address: string; phone: string; };

export default function AdminHospitals() {
  const { hospitals, doctors, addHospital, deleteHospital, updateHospitalPhoto, updateHospital } = useStore();
  const [addOpen, setAddOpen]             = useState(false);
  const [photoDialogId, setPhotoDialogId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview]   = useState<string>("");   // what we show in preview
  const [pendingFile, setPendingFile]     = useState<File | null>(null); // file waiting to save
  const [isDragOver, setIsDragOver]       = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [uploaded, setUploaded]           = useState(false);        // confirms save succeeded
  const [form, setForm] = useState({ name: "", area: "", address: "", phone: "" });
  const [editHospital, setEditHospital]   = useState<Hospital | null>(null);
  const [editForm, setEditForm]           = useState<EditHospitalForm>({ name: "", area: "", address: "", phone: "" });

  function getDoctorCount(id: string) {
    return doctors.filter(d => d.hospitalId === id).length;
  }

  // ── Add hospital ────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!form.name || !form.area) { toast.error("Name and location are required"); return; }
    await addHospital({
      id: `h_${Date.now()}`, name: form.name, area: form.area,
      address: form.address, phone: form.phone,
      doctorCount: 0, rating: 4.0, gradient: "from-slate-400 to-slate-600",
    } as any);
    toast.success(`Hospital "${form.name}" added`);
    setForm({ name: "", area: "", address: "", phone: "" });
    setAddOpen(false);
  }

  // ── Delete hospital ─────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const ok = await deleteHospital(id, doctors);
    if (!ok) toast.error("Cannot delete hospital with assigned doctors. Remove doctors first.");
    else toast.success("Hospital deleted");
  }

  // ── Open photo dialog ───────────────────────────────────────────────────────
  function openPhotoDialog(hospital: Hospital) {
    setPhotoDialogId(hospital.id);
    // Show existing photo if any
    setPhotoPreview(resolvePhotoUrl(hospital.photoUrl) || "");
    setPendingFile(null);
    setUploaded(false);
  }

  // ── File selected (drag or click) ───────────────────────────────────────────
  function handleFileSelected(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setPendingFile(file);
    setUploaded(false);
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview((e.target?.result as string) || "");
    reader.readAsDataURL(file);
  }

  function handleFileDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  }

  // ── Save photo — uploads base64 to DB (persistent, survives redeploys) ──────
  async function handleSavePhoto() {
    if (!photoDialogId) return;
    if (!pendingFile && !photoPreview) { toast.error("Please select a photo first"); return; }

    setUploading(true);
    try {
      if (pendingFile) {
        // Convert to base64 and save directly to DB
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(pendingFile);
        });
        await updateHospitalPhoto(photoDialogId, base64);
        setUploaded(true);
        toast.success("Photo saved permanently ✓");
        // Close after brief confirmation
        setTimeout(() => {
          setPhotoDialogId(null);
          setPhotoPreview("");
          setPendingFile(null);
          setUploaded(false);
        }, 1200);
      } else {
        // No new file — just close
        setPhotoDialogId(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save photo");
    } finally {
      setUploading(false);
    }
  }

  // ── Edit hospital ───────────────────────────────────────────────────────────
  function openEditHospital(hospital: Hospital) {
    setEditHospital(hospital);
    setEditForm({ name: hospital.name, area: hospital.area, address: hospital.address ?? "", phone: hospital.phone ?? "" });
  }

  async function handleEditHospital() {
    if (!editHospital) return;
    if (!editForm.name || !editForm.area) { toast.error("Name and location are required"); return; }
    await updateHospital(editHospital.id, editForm);
    toast.success("Hospital updated");
    setEditHospital(null);
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Hospital Management</h1>
          <p className="text-muted-foreground mt-1">{hospitals.length} hospitals registered</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" data-ocid="admin.open_modal_button">
              <Plus className="w-4 h-4" /> Add Hospital
            </Button>
          </DialogTrigger>
          <DialogContent data-ocid="admin.dialog">
            <DialogHeader><DialogTitle>Add New Hospital</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {[
                { label: "Hospital Name *", key: "name", placeholder: "e.g. City General Hospital" },
                { label: "Location / Area *", key: "area", placeholder: "e.g. Downtown" },
                { label: "Full Address", key: "address", placeholder: "e.g. 45 Central Avenue" },
                { label: "Phone", key: "phone", placeholder: "e.g. +91 22 4567 8900" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    data-ocid="admin.input" />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)} data-ocid="admin.cancel_button">Cancel</Button>
              <Button onClick={handleAdd} data-ocid="admin.submit_button">Add Hospital</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-border/50 mb-4">
        <span>✏️</span>
        <span>Click the edit icon in the Actions column to modify hospital details. Changes are saved immediately.</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card" data-ocid="admin.table">
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
                    {/* Show actual photo thumbnail if available */}
                    {resolvePhotoUrl(hospital.photoUrl) ? (
                      <img
                        src={resolvePhotoUrl(hospital.photoUrl)!}
                        alt={hospital.name}
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style");
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${hospital.gradient} flex items-center justify-center shrink-0`}
                      style={{ display: resolvePhotoUrl(hospital.photoUrl) ? "none" : "" }}
                    >
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-medium">{hospital.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{hospital.area}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{hospital.address ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{hospital.phone ?? "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{getDoctorCount(hospital.id)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEditHospital(hospital)} data-ocid="admin.edit_button">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openPhotoDialog(hospital)} data-ocid="admin.button">
                      <ImageIcon className="w-4 h-4 mr-1" />
                      {resolvePhotoUrl(hospital.photoUrl) ? "Change Photo" : "Add Photo"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-ocid="admin.delete_button">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-ocid="admin.dialog">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Hospital</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{hospital.name}</strong>? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-ocid="admin.cancel_button">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(hospital.id)}
                            className="bg-destructive hover:bg-destructive/90" data-ocid="admin.confirm_button">
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

      {/* Edit Dialog */}
      <Dialog open={!!editHospital} onOpenChange={open => !open && setEditHospital(null)}>
        <DialogContent data-ocid="admin.dialog">
          <DialogHeader><DialogTitle>Edit Hospital: {editHospital?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { label: "Hospital Name *", key: "name", placeholder: "e.g. City General Hospital" },
              { label: "Location / Area *", key: "area", placeholder: "e.g. Downtown" },
              { label: "Full Address", key: "address", placeholder: "e.g. 45 Central Avenue" },
              { label: "Phone", key: "phone", placeholder: "e.g. +91 22 4567 8900" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input placeholder={placeholder} value={(editForm as any)[key]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  data-ocid="admin.input" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditHospital(null)} data-ocid="admin.cancel_button">Cancel</Button>
            <Button onClick={handleEditHospital} data-ocid="admin.save_button">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Dialog */}
      <Dialog open={!!photoDialogId} onOpenChange={open => { if (!open) { setPhotoDialogId(null); setPhotoPreview(""); setPendingFile(null); setUploaded(false); } }}>
        <DialogContent data-ocid="admin.dialog">
          <DialogHeader><DialogTitle>Manage Hospital Photo</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* Preview — shows existing OR newly selected photo */}
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Hospital preview"
                  className="w-full h-44 object-cover rounded-xl border border-border"
                  onError={() => setPhotoPreview("")}
                />
                {uploaded && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Saved
                  </div>
                )}
                {pendingFile && !uploaded && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    New — not saved yet
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-20 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">
                No photo uploaded yet
              </div>
            )}

            {/* Drop zone */}
            <label
              htmlFor="hospital-photo-upload"
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              data-ocid="admin.dropzone"
              className={`flex flex-col items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors py-6 px-4 ${
                isDragOver
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground/30 bg-muted/30 hover:border-primary/60 hover:bg-muted/50"
              }`}
            >
              <UploadCloud className={`w-7 h-7 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
              {pendingFile ? (
                <p className="text-sm font-medium text-foreground text-center break-all">{pendingFile.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Drop image here</p>
                  <p className="text-xs text-muted-foreground">or click to browse · Max 5MB</p>
                </>
              )}
              <input id="hospital-photo-upload" type="file" accept="image/*" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }} />
            </label>

            <p className="text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2 border border-teal-100">
              📌 Photo is stored permanently in the database — it will not disappear after server restarts or redeploys.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPhotoDialogId(null); setPhotoPreview(""); setPendingFile(null); setUploaded(false); }}
              data-ocid="admin.cancel_button">
              Cancel
            </Button>
            <Button onClick={handleSavePhoto} disabled={uploading || !pendingFile} data-ocid="admin.save_button"
              className="bg-teal-500 hover:bg-teal-600 text-white">
              {uploading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                : uploaded
                  ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved!</>
                  : "Save Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
