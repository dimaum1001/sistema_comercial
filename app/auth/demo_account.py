import logging

from passlib.hash import bcrypt

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.models import Usuario


logger = logging.getLogger(__name__)
ALLOWED_USER_TYPES = {"admin", "cliente", "financeiro", "estoque", "vendas"}


def _resolve_demo_user_type() -> str:
    user_type = str(settings.DEMO_ACCOUNT_TIPO or "admin").strip().lower()
    if user_type in ALLOWED_USER_TYPES:
        return user_type

    logger.warning(
        "DEMO_ACCOUNT_TIPO=%r invalido; usando 'admin'.",
        settings.DEMO_ACCOUNT_TIPO,
    )
    return "admin"


def ensure_demo_account() -> None:
    """Cria (ou atualiza campos basicos) da conta demo quando habilitada."""
    if not settings.DEMO_ACCOUNT_ENABLED:
        return

    email = str(settings.DEMO_ACCOUNT_EMAIL or "").strip().lower()
    password = str(settings.DEMO_ACCOUNT_PASSWORD or "").strip()
    if not email or not password:
        logger.warning(
            "Conta demo habilitada, mas DEMO_ACCOUNT_EMAIL/DEMO_ACCOUNT_PASSWORD nao foram definidos. Ignorando provisionamento."
        )
        return

    nome = str(settings.DEMO_ACCOUNT_NAME or "Conta Demo").strip() or "Conta Demo"
    tipo = _resolve_demo_user_type()

    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
        if not usuario:
            usuario = Usuario(
                nome=nome,
                email=email,
                senha_hash=bcrypt.hash(password),
                tipo=tipo,
            )
            db.add(usuario)
            db.commit()
            logger.info("Conta demo criada com sucesso: %s (%s).", email, tipo)
            return

        updated = False

        if usuario.nome != nome:
            usuario.nome = nome
            updated = True

        if str(usuario.tipo or "").lower() != tipo:
            usuario.tipo = tipo
            updated = True

        if settings.DEMO_ACCOUNT_SYNC_PASSWORD_ON_START:
            try:
                same_password = bcrypt.verify(password, usuario.senha_hash)
            except ValueError:
                same_password = False

            if not same_password:
                usuario.senha_hash = bcrypt.hash(password)
                updated = True

        if updated:
            db.commit()
            logger.info("Conta demo atualizada: %s (%s).", email, tipo)
        else:
            logger.info("Conta demo ja disponivel: %s.", email)
    finally:
        db.close()
