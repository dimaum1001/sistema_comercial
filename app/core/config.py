"""
Configurações da aplicação (Pydantic v2 + pydantic-settings).
"""

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, EmailStr
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

    # Rate limiting
    RATE_LIMIT_REQUESTS: int = 120
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Auditoria / retenção
    AUDIT_RETENTION_DAYS: int = 90
    AUDIT_CLEANUP_INTERVAL_SECONDS: int = 3600

    # E-mail / redefini��ǜo de senha
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    EMAIL_FROM: Optional[EmailStr] = None
    EMAIL_FROM_NAME: str = "Sistema Comercial"
    PASSWORD_RESET_URL_BASE: str = "http://localhost:5173/redefinir-senha"
    PASSWORD_RESET_TOKEN_TTL_HOURS: int = 2
    PASSWORD_RESET_DEV_ECHO_TOKEN: bool = False

    # DPO / encarregado de dados
    DPO_NAME: str = "Encarregado de Protecao de Dados"
    DPO_EMAIL: EmailStr = Field(default="dpo@example.com")
    DPO_PHONE: Optional[str] = None
    DPO_ADDITIONAL_CONTACT: Optional[str] = None
    DPO_WORKING_HOURS: str = "Segunda a sexta-feira, das 9h as 18h (horario de Brasilia)"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
