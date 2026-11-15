"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Zone {
  id: string;
  name: string;
}

export default function ZonePicker({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentZona = searchParams.get("zona") || "us-ca-shasta";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zonaId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set("zona", zonaId);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="zone-select" className="text-sm font-medium">Zona:</label>
      <select
        id="zone-select"
        value={currentZona}
        onChange={handleChange}
        className="border rounded px-2 py-1 text-sm bg-background"
      >
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
          </option>
        ))}
      </select>
    </div>
  );
}