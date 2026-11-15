import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearFilter = searchParams.get('year');         
  const instrumentFilter = searchParams.get('instrument'); 
  const sortOrder = searchParams.get('sort') || 'asc'; 
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '1000', 10);

  const rawDir = path.join(process.cwd(), 'data', 'raw');

  try {
    if (!fs.existsSync(rawDir)) {
      return NextResponse.json({ error: 'La carpeta web/data/raw no existe' }, { status: 404 });
    }

    let allRecords: any[] = [];

    // 1. Lectura recursiva respetando las carpetas de tu compañero (viirs y modis por año)
    function readFolderRecursive(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          readFolderRecursive(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.csv')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
          
          // Filtro de calidad del pipeline: type === '0' (fuegos reales)
          const cleaned = parsed.data.filter((row: any) => String(row.type) === '0');
          allRecords = allRecords.concat(cleaned);
        }
      }
    }

    readFolderRecursive(rawDir);

    // 2. ARMONIZACIÓN DE DATOS (Solución al salto estadístico MODIS vs VIIRS)
    // Factor de corrección espacial para VIIRS (píxeles de 375m vs 1km de MODIS)
    const FACTOR_VIIRS = 0.48; 

    allRecords = allRecords.map((row: any) => {
      const instrument = (row.instrument || '').toLowerCase();
      const rawFrp = parseFloat(row.frp) || 0;
      
      // Si el registro pertenece a VIIRS, aplicamos el factor de armonización cruzada
      const isViirs = instrument.includes('viirs') || (row.satellite && row.satellite.includes('N'));
      const harmonizedFrp = isViirs ? rawFrp * FACTOR_VIIRS : rawFrp;

      return {
        ...row,
        frp_harmonized: parseFloat(harmonizedFrp.toFixed(2)),
        sensor_harmonized: isViirs ? 'VIIRS (Calibrado)' : 'MODIS (Base)'
      };
    });

    // 3. Filtros dinámicos por Año e Instrumento
    if (yearFilter) {
      allRecords = allRecords.filter((r) => r.acq_date && r.acq_date.startsWith(yearFilter));
    }

    if (instrumentFilter) {
      allRecords = allRecords.filter(
        (r) => r.instrument && r.instrument.toLowerCase().includes(instrumentFilter.toLowerCase())
      );
    }

    // 4. Ordenamiento cronológico perfecto (2000 a la fecha)
    allRecords.sort((a, b) => {
      const dateA = new Date(`${a.acq_date}T${String(a.acq_time || '0000').padStart(4, '0').slice(0,2)}:${String(a.acq_time || '0000').padStart(4, '0').slice(2,4)}Z`).getTime();
      const dateB = new Date(`${b.acq_date}T${String(b.acq_time || '0000').padStart(4, '0').slice(0,2)}:${String(b.acq_time || '0000').padStart(4, '0').slice(2,4)}Z`).getTime();
      
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // 5. Paginación y construcción de la respuesta GeoJSON
    const totalRegistros = allRecords.length;
    const totalPaginas = Math.ceil(totalRegistros / limit);
    const startIndex = (page - 1) * limit;
    const paginatedData = allRecords.slice(startIndex, startIndex + limit);

    const geoJson = {
      type: 'FeatureCollection',
      metadata: {
        totalRegistrosDisponibles: totalRegistros,
        paginaActual: page,
        totalPaginas,
        estadoArmonizacion: "Calibración cruzada MODIS/VIIRS aplicada (Factor VIIRS: 0.48)",
        filtroAnio: yearFilter || 'Histórico completo (2000-2026)',
      },
      features: paginatedData.map((row: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
        },
        properties: {
          fecha: row.acq_date,
          hora: row.acq_time,
          satelite: row.satellite,
          instrumento: row.instrument,
          sensorArmonizado: row.sensor_harmonized,
          confianza: row.confidence,
          frpOriginal: parseFloat(row.frp) || 0,
          frpHarmonized: row.frp_harmonized, // <- Dato clave ya armonizado por el pipeline
          diaNoche: row.daynight
        }
      }))
    };

    return NextResponse.json(geoJson);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}