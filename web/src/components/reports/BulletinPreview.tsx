"use client";

import { useState } from "react";
import { useBulletin } from "@/hooks/queries";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { PillButton } from "@/components/ui/PillButton";

/** Boletín en texto, listo para copiar y pegar en un parte. */
export function BulletinPreview({ zoneId, month }: { zoneId: string; month: string }) {
  const { data: bulletin, isPending, error } = useBulletin(zoneId, month);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!bulletin) return;
    await navigator.clipboard.writeText(bulletin.text);
    setCopied(true);
  }

  return (
    <GlassPanel id="boletin" title="Boletín" meta={bulletin && <LevelBadge level={bulletin.level} compact />}>
      {isPending && <p className="text-[12.5px] text-muted">Armando el boletín…</p>}
      {error && <p className="text-[12.5px] text-muted">Boletín pendiente: {error.message}</p>}
      {bulletin && (
        <>
          <pre className="whitespace-pre-wrap rounded-2xl bg-glass p-4 font-sans text-[13px] leading-relaxed">{bulletin.text}</pre>
          <PillButton variant="primary" className="mt-4" onClick={copy}>
            {copied ? "Copiado" : "Copiar texto"}
          </PillButton>
        </>
      )}
    </GlassPanel>
  );
}
