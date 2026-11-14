import { NextResponse } from 'next/server';

export async function GET() {
  // Estructura GeoJSON estándar para mapas interactivos
  const geoJsonData = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [-64.1888, -31.4201] // Ejemplo: Córdoba, Argentina
        },
        properties: {
          idZona: "AR-CB-01",
          nombreZona: "Sierras de Córdoba",
          sensorPrincipal: "VIIRS / MODIS (Armonizado)",
          focosCrudos: 142,
          focosArmonizados: 31.2,
          indiceAnomalia: 4.2,
          nivelRiesgo: "Muy alto",
          alertaActiva: true
        }
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [-65.1793, -26.8083] // Ejemplo: Tucumán / Norte
        },
        properties: {
          idZona: "AR-TU-02",
          nombreZona: "Yungas / Tucumán",
          sensorPrincipal: "VIIRS / MODIS (Armonizado)",
          focosCrudos: 85,
          focosArmonizados: 18.5,
          indiceAnomalia: 1.8,
          nivelRiesgo: "Alto",
          alertaActiva: true
        }
      }
    ]
  };

  return NextResponse.json(geoJsonData);
}