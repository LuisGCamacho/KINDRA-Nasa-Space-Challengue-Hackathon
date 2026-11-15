"use client";

import { useActionState } from "react";
import type { RespondState } from "@/app/responder/actions";
import { PillButton } from "@/components/ui/PillButton";
import { FieldLabel } from "@/components/ui/FieldLabel";

const RESULT_TEXT: Record<NonNullable<RespondState["result"]>, string> = {
  registrada: "Listo, quedó registrada. Gracias.",
  token_usado: "Este enlace ya se usó.",
  ya_respondida: "Alguien ya respondió esta alerta.",
  alerta_inexistente: "La alerta ya no existe.",
  token_invalido: "El enlace venció o no es válido.",
};

interface RespondFormProps {
  action: (previous: RespondState, form: FormData) => Promise<RespondState>;
  token: string;
  /** En falso positivo se puede dejar una nota para el equipo. */
  withNote: boolean;
  submitLabel: string;
}

/** Formulario de un solo botón. Después de responder, muestra el resultado en lugar del botón. */
export function RespondForm({ action, token, withNote, submitLabel }: RespondFormProps) {
  const [state, submit, pending] = useActionState(action, { result: null });

  if (state.result) {
    return (
      <p role="status" className="mt-5 text-[14px]">
        {RESULT_TEXT[state.result]}
      </p>
    );
  }

  return (
    <form action={submit} className="mt-5 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {withNote && (
        <div>
          <FieldLabel htmlFor="note">Qué era (opcional)</FieldLabel>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Por ejemplo: nube baja, polvo de un camión, quema autorizada"
            className="glass w-full rounded-[14px] px-4 py-3 text-[13px]"
          />
        </div>
      )}
      <PillButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </PillButton>
    </form>
  );
}
