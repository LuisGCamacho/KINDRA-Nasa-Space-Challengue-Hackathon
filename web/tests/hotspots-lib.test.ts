import { describe, expect, it } from "vitest";
import type { FirmsHotspot } from "@/lib/alert-types";
import type { Zone } from "@/lib/types";
import { hotspotBounds, hotspotsMonth, hotspotsToGeoJson, satelliteName, zoneContaining } from "@/lib/hotspots";

const CAMERA: [number, number] = [-118.54878, 34.08642];

const viirs: FirmsHotspot = {
  position: [-118.55, 34.0674],
  sensor: "VIIRS",
  source: "VIIRS_NOAA20",
  acquiredAt: "2025-01-07T19:46:00Z",
  frp: 34.5,
  confidence: "n",
  distanceKm: 2.12,
};
const modis: FirmsHotspot = { ...viirs, position: [-118.5, 34.03], sensor: "MODIS", source: "MODIS", acquiredAt: "2025-01-07T22:40:00Z", frp: null };

function zone(id: string, bbox: Zone["bbox"], areaKm2: number): Zone {
  return { id, name: id, type: "departamento", country: "US", center: [0, 0], bbox, areaKm2 };
}

describe("focos de una alerta en el mapa", () => {
  it("nombra el satélite con o sin el sufijo NRT", () => {
    expect(satelliteName("VIIRS_NOAA20")).toBe("VIIRS NOAA-20");
    expect(satelliteName("VIIRS_NOAA20_NRT")).toBe("VIIRS NOAA-20");
    expect(satelliteName("OTRA")).toBe("OTRA");
  });

  it("arma un punto por foco con su sensor y el texto del cursor", () => {
    const [first, second] = hotspotsToGeoJson([viirs, modis]).features;
    expect(first.geometry.coordinates).toEqual(viirs.position);
    expect(first.properties.sensor).toBe("VIIRS");
    expect(first.properties.detail).toContain("FRP 34,5 MW");
    expect(first.properties.detail).toContain("a 2,1 km de la cámara");
    expect(second.properties.detail).not.toContain("FRP");
  });

  it("encuadra los focos y la cámara con margen", () => {
    const [west, south, east, north] = hotspotBounds([viirs, modis], CAMERA);
    expect(west).toBeLessThan(-118.55);
    expect(east).toBeGreaterThan(-118.5);
    expect(south).toBeLessThan(34.03);
    expect(north).toBeGreaterThan(CAMERA[1]);
  });

  it("elige el condado antes que el estado y toma el mes del primer foco", () => {
    const zones = [zone("us-ca", [-124.5, 32.5, -114.1, 42], 423_970), zone("us-ca-los-angeles", [-118.95, 32.8, -117.6, 34.83], 12_308)];
    expect(zoneContaining(zones, CAMERA)?.id).toBe("us-ca-los-angeles");
    expect(zoneContaining(zones, [0, 0])).toBeUndefined();
    expect(hotspotsMonth([modis, viirs])).toBe("2025-01");
    expect(hotspotsMonth([])).toBeNull();
  });
});
