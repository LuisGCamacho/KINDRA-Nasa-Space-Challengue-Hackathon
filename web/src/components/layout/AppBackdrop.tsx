/** Fondo fijo del monitor. Sin animación: la atención va a la lupa. */
export function AppBackdrop() {
  return <div aria-hidden className="app-backdrop pointer-events-none fixed inset-0 -z-10" />;
}
