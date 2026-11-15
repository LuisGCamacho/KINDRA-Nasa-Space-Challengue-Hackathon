"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AlertAction } from "@/lib/alert-types";
import type { ApiError } from "@/lib/types";

async function postResponse(alertId: string, action: AlertAction): Promise<void> {
  const response = await fetch(`/api/fire-alerts/${alertId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, note: null }),
  });
  if (!response.ok) throw new Error(((await response.json()) as ApiError).error);
}

/** Responde una alerta desde la app y recarga la tabla. */
export function useRespondToAlert(alertId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: AlertAction) => postResponse(alertId, action),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["fire-alerts"] }),
  });
}
