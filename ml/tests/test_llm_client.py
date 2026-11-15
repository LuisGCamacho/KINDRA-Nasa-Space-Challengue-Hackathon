"""Pruebas del cliente del LLM, sin llamar a Gemini."""

from typing import Literal

import pytest
from pydantic import BaseModel

from kindra.agent import llm_client


class Answer(BaseModel):
    decision: Literal["confirmar", "descartar", "revisar"]
    reasons: list[str]


def test_respuesta_valida_y_dentro_de_un_bloque_json():
    plain = llm_client.parse_answer('{"decision": "confirmar", "reasons": ["Columna de humo"]}', Answer)
    fenced = llm_client.parse_answer('```json\n{"decision": "revisar", "reasons": []}\n```', Answer)
    assert plain.decision == "confirmar" and fenced.decision == "revisar"


def test_respuesta_rota_o_fuera_del_esquema_no_pasa():
    for raw in (None, "", "no es json", '{"decision": "quizas", "reasons": []}'):
        with pytest.raises(llm_client.LLMUnavailable):
            llm_client.parse_answer(raw, Answer)


def test_sin_clave_no_esta_configurado(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
    monkeypatch.setenv("LLM_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("LLM_API_KEY", "")
    assert not llm_client.is_configured()
    monkeypatch.setenv("LLM_BASE_URL", "http://localhost:11434/v1")  # Ollama no pide clave
    assert llm_client.is_configured()


def test_la_imagen_va_como_data_url():
    part = llm_client.image_part(b"\xff\xd8jpeg")
    assert part["image_url"]["url"].startswith("data:image/jpeg;base64,")
