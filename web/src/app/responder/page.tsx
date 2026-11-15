import { Suspense } from "react";
import type { Metadata } from "next";
import { readActionToken } from "@/server/tokens";
import { getFireAlert } from "@/server/fire-alerts";
import { getCamera } from "@/server/data";
import { AppBackdrop } from "@/components/layout/AppBackdrop";
import { RespondForm } from "@/components/alerts/RespondForm";
import { respondFromEmail } from "./actions";

export const metadata: Metadata = { title: "Responder alerta · KINDRA", robots: { index: false } };

const ACTION_TEXT = {
  confirmar: { title: "Confirmar incendio", button: "Sí, es un incendio" },
  falso_positivo: { title: "Marcar como falso positivo", button: "Sí, no es un incendio" },
} as const;

type ResponderParams = PageProps<"/responder">["searchParams"];

/**
 * Página a la que llevan los botones del correo. Abrirla no cambia nada: la respuesta se guarda
 * solo al tocar el botón del formulario (POST). Está fuera del grupo `(app)`: sin encabezado ni pestañas.
 */
export default function ResponderPage({ searchParams }: PageProps<"/responder">) {
  return (
    <>
      <AppBackdrop />
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4">
        <section className="glass w-full rounded-[22px] p-6">
          {/* Con `cacheComponents`, lo que lee `searchParams` va dentro de `<Suspense>`. */}
          <Suspense fallback={<p className="text-[13px] text-muted">Revisando el enlace…</p>}>
            <ResponderContent searchParams={searchParams} />
          </Suspense>
        </section>
      </main>
    </>
  );
}

/** Lee el token del enlace; si no sirve (o falta `ALERT_TOKEN_SECRET`), lo trata como enlace inválido. */
function safeReadToken(token: unknown) {
  if (typeof token !== "string") return null;
  try {
    return readActionToken(token);
  } catch (error) {
    console.error("[responder]", error);
    return null;
  }
}

async function ResponderContent({ searchParams }: { searchParams: ResponderParams }) {
  const { token } = await searchParams;
  const payload = safeReadToken(token);
  const alert = payload ? await getFireAlert(payload.alertId) : null;

  if (!payload || !alert || typeof token !== "string") {
    return (
      <>
        <h1 className="text-[20px] font-medium">El enlace no sirve</h1>
        <p className="mt-2 text-[13px] text-muted">Venció, ya se usó o no es válido. Puedes responder la alerta desde la pantalla Alertas.</p>
      </>
    );
  }

  const camera = await getCamera(alert.cameraId);
  return (
    <>
      <h1 className="text-[20px] font-medium">{ACTION_TEXT[payload.action].title}</h1>
      <p className="mt-2 text-[13px] text-muted">
        Alerta de la cámara {camera?.name ?? alert.cameraId}. Si la marcas como falso positivo, el agente guarda el caso para
        que el equipo revise el modelo.
      </p>
      <RespondForm
        action={respondFromEmail}
        token={token}
        withNote={payload.action === "falso_positivo"}
        submitLabel={ACTION_TEXT[payload.action].button}
      />
    </>
  );
}
