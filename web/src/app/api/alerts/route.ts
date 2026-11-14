import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 1. Leemos los parámetros que vengan en la URL (ej. ?riesgo=Alto)
  const { searchParams } = new URL(request.url);
  const filtroRiesgo = searchParams.get('riesgo');
  const filtroZona = searchParams.get('zona');

  // 2. Tus datos (aquí es donde después conectarás tu fetch o archivo JSON real)
  const todosLosDatos = [
    { id: 1, zona: "Norte", nivelRiesgo: "Bajo", temperatura: "22°C" },
    { id: 2, zona: "Centro", nivelRiesgo: "Moderado", temperatura: "25°C" },
    { id: 3, zona: "Sur", nivelRiesgo: "Alto", temperatura: "30°C" },
    { id: 4, zona: "Este", nivelRiesgo: "Alto", temperatura: "32°C" }
  ];

  // 3. Aplicamos los filtros si el usuario envió alguno en la URL
  let resultados = todosLosDatos;

  if (filtroRiesgo) {
    resultados = resultados.filter(
      (item) => item.nivelRiesgo.toLowerCase() === filtroRiesgo.toLowerCase()
    );
  }

  if (filtroZona) {
    resultados = resultados.filter(
      (item) => item.zona.toLowerCase() === filtroZona.toLowerCase()
    );
  }

  // 4. Devolvemos la respuesta limpia y estructurada
  return NextResponse.json({
    estado: "exitoso",
    filtrosAplicados: {
      riesgo: filtroRiesgo || "ninguno",
      zona: filtroZona || "ninguna"
    },
    totalEncontrados: resultados.length,
    datos: resultados,
    timestamp: new Date().toISOString()
  });
}