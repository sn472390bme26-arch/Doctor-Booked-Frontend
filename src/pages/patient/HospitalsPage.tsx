import { Input } from "@/components/ui/input";
import { MapPin, Search, Star, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useStore } from "../../context/StoreContext";
import { useRouter } from "../../router/RouterContext";

export default function HospitalsPage() {
  const [search, setSearch] = useState("");
  const { navigate } = useRouter();
  const { hospitals, doctors } = useStore();

  const filtered = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.area.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-teal-50 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Find a Hospital</h1>
          <p className="text-gray-500 text-sm mt-1">
            Search and book appointments at top hospitals near you
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10 bg-white border-gray-200"
            placeholder="Search hospital or area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-ocid="hospitals.search_input"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 text-gray-400"
          data-ocid="hospitals.empty_state"
        >
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No hospitals found</p>
          <p className="text-sm">Try a different name or area</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((hospital, idx) => {
            const docCount = doctors.filter(
              (d) => d.hospitalId === hospital.id,
            ).length;
            return (
              <motion.div
                key={hospital.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                data-ocid={`hospitals.item.${idx + 1}`}
              >
                <button
                  type="button"
                  className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                  onClick={() =>
                    navigate({ path: "/patient/hospital", id: hospital.id })
                  }
                >
                  {hospital.photoUrl ? (
                    <div
                      className="h-36 relative flex flex-col justify-between p-3 bg-cover bg-center"
                      style={{ backgroundImage: `url(${hospital.photoUrl})` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="relative flex justify-end">
                        <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
                          <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
                          {hospital.rating}
                        </span>
                      </div>
                      <div className="relative">
                        <p className="text-white font-bold text-sm leading-tight">
                          {hospital.name}
                        </p>
                        <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {hospital.area}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`h-36 bg-gradient-to-br ${hospital.gradient} flex flex-col justify-between p-3`}
                    >
                      <div className="flex justify-end">
                        <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
                          <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
                          {hospital.rating}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm leading-tight">
                          {hospital.name}
                        </p>
                        <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {hospital.area}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="p-4 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      <Users className="w-3 h-3" />
                      {docCount} Doctors
                    </span>
                    <span className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= Math.floor(hospital.rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                        />
                      ))}
                    </span>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
