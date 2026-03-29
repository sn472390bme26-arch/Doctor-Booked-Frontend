import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { ArrowLeft, Calendar, ChevronRight, User } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import BookingDialog from "../../components/booking/BookingDialog";
import { useStore } from "../../context/StoreContext";
import { getSessionLabel } from "../../data/seed";
import { useRouter } from "../../router/RouterContext";
import type { Doctor, SessionType } from "../../types";

interface Props {
  id: string;
}

export default function HospitalDoctorsPage({ id }: Props) {
  const { goBack } = useRouter();
  const { hospitals, doctors } = useStore();
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);

  const hospital = hospitals.find((h) => h.id === id);
  const hospitalDoctors = doctors.filter((d) => d.hospitalId === id);

  if (!hospital)
    return <div className="p-8 text-center">Hospital not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button
        variant="ghost"
        className="mb-6 -ml-2 text-gray-500 hover:text-gray-700"
        onClick={goBack}
        data-ocid="hospital.button"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Hospitals
      </Button>

      {/* Hospital header */}
      {hospital.photoUrl ? (
        <div
          className="h-32 rounded-2xl relative overflow-hidden flex items-end p-6 mb-8"
          style={{
            backgroundImage: `url(${hospital.photoUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="relative">
            <h1 className="text-2xl font-bold text-white">{hospital.name}</h1>
            <p className="text-white/80 text-sm">
              {hospital.area} &middot; {hospitalDoctors.length} Doctors
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`h-32 rounded-2xl bg-gradient-to-br ${hospital.gradient} flex items-end p-6 mb-8`}
        >
          <div>
            <h1 className="text-2xl font-bold text-white">{hospital.name}</h1>
            <p className="text-white/80 text-sm">
              {hospital.area} &middot; {hospitalDoctors.length} Doctors
            </p>
          </div>
        </div>
      )}

      {/* Doctors header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">Doctors</h2>
          <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {hospitalDoctors.length} available
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          Availability updates live
        </div>
      </div>

      <div className="space-y-4">
        {hospitalDoctors.map((doctor, idx) => (
          <motion.div
            key={doctor.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08 }}
            data-ocid={`doctors.item.${idx + 1}`}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  {doctor.photo ? (
                    <img
                      src={doctor.photo}
                      alt={doctor.name}
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-teal-100 flex items-center justify-center">
                      <User className="w-7 h-7 text-teal-600" />
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{doctor.name}</p>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                    <Activity className="w-3.5 h-3.5" />
                    {doctor.specialty}
                  </div>
                  {/* Session tags with custom timings */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {doctor.sessions.length > 0 ? (
                      doctor.sessions.map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                        >
                          {getSessionLabel(
                            s as SessionType,
                            doctor.sessionTimings,
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        No sessions today
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Divider + CTA */}
              <hr className="my-3 border-gray-100" />
              <button
                type="button"
                className="w-full flex items-center justify-between text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
                onClick={() => setBookingDoctor(doctor)}
                data-ocid={`doctors.primary_button.${idx + 1}`}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Check Schedule
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {bookingDoctor && (
        <BookingDialog
          doctor={bookingDoctor}
          hospital={hospital}
          open={!!bookingDoctor}
          onClose={() => setBookingDoctor(null)}
        />
      )}
    </div>
  );
}
