const STEPS = [
  {
    title: "Celdas-día",
    text: "Una celda de la grilla con fuego en un día cuenta una vez, caigan uno o veinte píxeles. Grilla de 0,1° en California y 0,5° en el resto del mundo.",
  },
  {
    title: "Un satélite de la tarde por fecha",
    text: "Terra hasta julio de 2002, Aqua hasta enero de 2012, Suomi NPP hasta noviembre de 2026 y después NOAA-20.",
  },
  {
    title: "Factor mensual",
    text: "k = celdas-día de Aqua / celdas-día de VIIRS, por mes, calibrado en 2012–2021. Lleva VIIRS a la escala MODIS, con su intervalo.",
  },
];

/** Los tres pasos del método, en el orden en que se aplican. */
export function MethodSteps() {
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step.title} className="glass rounded-[22px] p-5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">Paso {index + 1}</span>
          <h2 className="mb-1.5 mt-1 text-[15px] font-medium">{step.title}</h2>
          <p className="text-[12.5px] leading-relaxed text-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
