import { CameraGrid } from "@/components/camera/CameraGrid";

/** Todas las cámaras públicas, con la última detección de cada una. */
export default function CamarasPage() {
  return (
    <section className="py-6">
      <h1 className="mb-1 text-[22px] font-medium tracking-[-0.02em]">Cámaras</h1>
      <p className="mb-5 text-[13px] text-muted">
        Solo cámaras que su dueño publica para uso abierto. El modelo busca humo y llamas; no detecta personas ni patentes.
      </p>
      <CameraGrid />
    </section>
  );
}
