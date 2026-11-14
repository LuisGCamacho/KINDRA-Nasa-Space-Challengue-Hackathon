import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearFilter = searchParams.get('year');         // Ej: ?year=2019
  const instrumentFilter = searchParams.get('instrument'); // Ej: ?instrument=VIIRS o MODIS
  const sortOrder = searchParams.get('sort') || 'asc'; // 'asc' (2000->2026) o 'desc'
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '1000', 10);

  const rawDir = path.join(process.cwd(), 'data', 'raw');

  try {
    if (!fs.existsSync(rawDir)) {
      return NextResponse.json({ error: 'La carpeta web/data/raw no existe' }, { status: 404 });
    }

    let allRecords: any[] = [];

    // Función recursiva inteligente: explora subcarpetas de sensores y luego carpetas de años
    function readFolderRecursive(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          readFolderRecursive(fullPath); // Entra a la carpeta del año o del sensor
        } else if (entry.isFile() && entry.name.endsWith('.csv')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
          
          // Filtro de calidad de tu compañero: type === '0' (fuego real)
          const cleaned = parsed.data.filter((row: any) => String(row.type) === '0');
          allRecords = allRecords.concat(cleaned);
        }
      }
    }

    // Arranca la lectura masiva desde la raíz 'raw'
    readFolderRecursive(rawDir);

    // 1. Filtros dinámicos por Año (si lo piden explícitamente) o por Instrumento
    if (yearFilter) {
      allRecords = allRecords.filter((r) => r.acq_date && r.acq_date.startsWith(yearFilter));
    }

    if (instrumentFilter) {
      allRecords = allRecords.filter(
        (r) => r.instrument && r.instrument.toLowerCase().includes(instrumentFilter.toLowerCase())
      );
    }

    // 2. ORDENAMIENTO CRONOLÓGICO (Del 2000 a la fecha de forma perfecta)
    allRecords.sort((a, b) => {
      const dateA = new Date(`${a.acq_date}T${String(a.acq_time || '0000').padStart(4, '0').slice(0,2)}:${String(a.acq_time || '0000').padStart(4, '0').slice(2,4)}Z`).getTime();
      const dateB = new Date(`${b.acq_date}T${String(b.acq_time || '0000').padStart(4, '0').slice(0,2)}:${String(b.acq_time || '0000').padStart(4, '0').slice(2,4)}Z`).getTime();
      
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // 3. Paginación para que el mapa web no colapse con tantos años
    const totalRegistros = allRecords.length;
    const totalPaginas = Math.ceil(totalRegistros / limit);
    const startIndex = (page - 1) * limit;
    const paginatedData = allRecords.slice(startIndex, startIndex + limit);

    // 4. Estructura GeoJSON estándar para el mapa
    const geoJson = {
      type: 'FeatureCollection',
      metadata: {
        totalRegistrosDisponibles: totalRegistros,
        paginaActual: page,
        totalPaginas,
        estructuraCatalogo: 'Catalogado por años (2000-Presente)',
        filtroAnio: yearFilter || 'Todos los años (Histórico completo)',
        filtroInstrumento: instrumentFilter || 'Todos los sensores (MODIS + VIIRS)'
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
          confianza: row.confidence,
          frp: parseFloat(row.frp) || 0,
          diaNoche: row.daynight
        }
      }))
    };

    return NextResponse.json(geoJson);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}