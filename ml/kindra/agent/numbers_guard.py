"""Revisa que el texto del LLM no invente cifras.

Toda cifra del texto tiene que aparecer en los datos que se le pasaron. Si aparece una nueva, se
descarta el texto y se usa la plantilla fija: nunca se manda una cifra inventada.
"""

from __future__ import annotations

import re

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")  # enteros y decimales con punto o coma


def invented_numbers(text: str, facts: str) -> set[str]:
    """Devuelve las cifras de `text` que no están en `facts`. Vacío si no inventó nada."""
    return numbers_in(text) - numbers_in(facts)


def numbers_in(text: str) -> set[str]:
    """Cifras de un texto, con la coma decimal pasada a punto: "2,5" y "2.5" son la misma."""
    return {match.replace(",", ".") for match in NUMBER.findall(text)}
