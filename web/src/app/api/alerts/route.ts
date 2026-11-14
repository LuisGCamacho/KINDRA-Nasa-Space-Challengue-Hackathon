import { NextResponse } from 'next/server';

export async function GET() {
  // Aquí defines los datos que responderá tu API
  const datos = {
    mensaje: "Conexión exitosa con la API",
    estado: "activo",
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(datos);
}