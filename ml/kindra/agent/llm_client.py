"""Única puerta al LLM del agente: Gemini Flash por su API compatible con OpenAI.

Se configura con tres variables de `ml/.env` (AGENTS.md):

- `LLM_BASE_URL`: `https://generativelanguage.googleapis.com/v1beta/openai/` para Gemini, o
  `http://localhost:11434/v1` para el respaldo sin conexión (Ollama con Qwen2.5-VL).
- `LLM_MODEL`: por ejemplo `gemini-3.5-flash`.
- `LLM_API_KEY`: clave de Google AI Studio (vacía para Ollama).

La respuesta se pide en JSON con el esquema de un modelo de Pydantic y se valida aquí: llega con
la forma esperada o se lanza `LLMUnavailable`, y el agente deja la alerta en "revisar".
"""

from __future__ import annotations

import base64
import json
import os
from functools import lru_cache
from typing import TypeVar

from pydantic import BaseModel, ValidationError

TIMEOUT_S = 60  # segundos por pedido; una imagen chica y un texto corto tardan unos pocos
MAX_RETRIES = 2  # el cliente reintenta solo ante 429 y errores 5xx
TEMPERATURE = 0.2  # baja: la misma imagen tiene que dar casi la misma decisión

Output = TypeVar("Output", bound=BaseModel)


class LLMUnavailable(RuntimeError):
    """El LLM no está configurado, no respondió o respondió algo que no cumple el esquema."""


def ask(system: str, text: str, output: type[Output], image_jpeg: bytes | None = None) -> Output:
    """Hace un pedido y devuelve la respuesta validada con el modelo `output`.

    Args:
        system: Instrucciones fijas del agente.
        text: Datos del caso (ya verificados).
        output: Modelo de Pydantic con la forma de la respuesta.
        image_jpeg: Imagen marcada que el LLM tiene que mirar, en JPEG.

    Raises:
        LLMUnavailable: Si falta la configuración, el pedido falla o la respuesta no sirve.
    """
    from openai import OpenAIError

    content: list[dict] = [{"type": "text", "text": text}]
    if image_jpeg is not None:
        content.insert(0, image_part(image_jpeg))
    try:
        response = client().chat.completions.create(
            model=os.environ.get("LLM_MODEL", ""),
            messages=[{"role": "system", "content": system}, {"role": "user", "content": content}],
            response_format={"type": "json_schema",
                             "json_schema": {"name": output.__name__, "schema": output.model_json_schema()}},
            temperature=TEMPERATURE,
        )
    except OpenAIError as error:
        raise LLMUnavailable(f"El LLM no respondió: {error}") from error
    return parse_answer(response.choices[0].message.content if response.choices else None, output)


def parse_answer(raw: str | None, output: type[Output]) -> Output:
    """Valida el JSON que devolvió el LLM. Acepta que venga dentro de un bloque ```json."""
    if not raw:
        raise LLMUnavailable("El LLM devolvió una respuesta vacía")
    text = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return output.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError) as error:
        raise LLMUnavailable(f"La respuesta del LLM no tiene la forma esperada: {error}") from error


def image_part(jpeg: bytes) -> dict:
    """Imagen como `data:` URL, la forma que acepta la API compatible con OpenAI."""
    return {"type": "image_url",
            "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()}}


def is_configured() -> bool:
    """Hay modelo y dirección; la clave puede faltar solo con Ollama (localhost)."""
    base = os.environ.get("LLM_BASE_URL", "")
    has_key = bool(os.environ.get("LLM_API_KEY")) or "localhost" in base or "127.0.0.1" in base
    return bool(base and os.environ.get("LLM_MODEL") and has_key)


@lru_cache(maxsize=1)
def client():
    """Cliente de OpenAI apuntado a Gemini (u Ollama). Se crea una vez, al primer uso."""
    if not is_configured():
        raise LLMUnavailable("Faltan LLM_BASE_URL, LLM_MODEL o LLM_API_KEY en ml/.env")
    from openai import OpenAI

    return OpenAI(base_url=os.environ["LLM_BASE_URL"], api_key=os.environ.get("LLM_API_KEY") or "ollama",
                  timeout=TIMEOUT_S, max_retries=MAX_RETRIES)
