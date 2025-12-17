from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache


@lru_cache(maxsize=1)
def get_brasilia_tzinfo():
    """
    Retorna o tzinfo de Brasilia (America/Sao_Paulo).

    Em ambientes sem base IANA (ex.: Windows sem tzdata), faz fallback para UTC-3.
    """

    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo("America/Sao_Paulo")
    except Exception:
        return timezone(timedelta(hours=-3))


def now_brasilia() -> datetime:
    """Datetime timezone-aware em Brasilia."""

    return datetime.now(get_brasilia_tzinfo())


def now_brasilia_naive() -> datetime:
    """
    Datetime naive representando o horario de Brasilia.

    Mantem compatibilidade com colunas `TIMESTAMP` (sem timezone) do Postgres.
    """

    return now_brasilia().replace(tzinfo=None)

