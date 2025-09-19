"""
Configurações da aplicação (Pydantic v2 + pydantic-settings).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import secrets
import logging

logger = logging.getLogger("settings")


def _gen_dev_secret_key() -> str:
    # Aviso explícito para não usar isso em produção
    logger.warning(
        "SECRET_KEY ausente no .env; gerando uma chave temporária para DESENVOLVIMENTO. "
        "Defina SECRET_KEY no .env para evitar rotação a cada reinício."
    )
    return secrets.token_urlsafe(64)


class Settings(BaseSettings):
    # URL de conexão com o banco de dados
    DATABASE_URL: str

    # JWT: use .env em produção; fallback temporário só para DEV
    SECRET_KEY: str = Field(default_factory=_gen_dev_secret_key)

    # Algoritmo de assinatura JWT
    ALGORITHM: str = "HS256"

    # Tempo de expiração do token em minutos
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
