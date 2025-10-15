import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_smtp_configured() -> bool:
    """Check whether minimal SMTP settings are in place."""
    return bool(settings.SMTP_HOST and settings.EMAIL_FROM)


def _build_reset_link(token: str) -> str:
    """
    Compose the password reset link by appending ?token=... to the configured base URL.
    Defaults to the local frontend route if no base has been configured.
    """
    base = (settings.PASSWORD_RESET_URL_BASE or "").strip() or "http://localhost:5173/redefinir-senha"
    parsed = urlparse(base)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["token"] = token
    new_query = urlencode(query)
    updated = parsed._replace(query=new_query)
    return urlunparse(updated)


def send_password_reset_email(email: str, nome: Optional[str], token: str) -> None:
    """
    Send the password reset email. Falls back to logging the token when SMTP is not configured
    and PASSWORD_RESET_DEV_ECHO_TOKEN is True.
    """
    if not email:
        logger.warning("Password reset requested without a destination email.")
        return

    if not _is_smtp_configured():
        logger.warning(
            "SMTP settings are not configured. Password reset e-mail for %s was not sent.",
            email,
        )
        if settings.PASSWORD_RESET_DEV_ECHO_TOKEN:
            logger.info("Reset token for %s (dev mode): %s", email, token)
        return

    link = _build_reset_link(token)
    nome_destino = (nome or "").strip() or "usuario"
    subject = "Redefinicao de senha - Sistema Comercial"
    plain_body = (
        f"Ola {nome_destino},\n\n"
        "Recebemos uma solicitacao para redefinir a sua senha de acesso ao Sistema Comercial.\n"
        f"Para continuar, acesse o link abaixo dentro de {settings.PASSWORD_RESET_TOKEN_TTL_HOURS} horas:\n\n"
        f"{link}\n\n"
        "Se voce nao solicitou essa acao, ignore este e-mail. Sua senha atual permanecera inalterada.\n\n"
        "Atenciosamente,\n"
        "Equipe do Sistema Comercial"
    )
    html_body = f"""\
<p>Ola {nome_destino},</p>
<p>Recebemos uma solicitacao para redefinir a sua senha de acesso ao Sistema Comercial.</p>
<p>Para escolher uma nova senha dentro de {settings.PASSWORD_RESET_TOKEN_TTL_HOURS} horas, clique no link abaixo:</p>
<p><a href="{link}">{link}</a></p>
<p>Se voce nao reconhece este pedido, basta ignorar esta mensagem.</p>
<p>Atenciosamente,<br />Equipe do Sistema Comercial</p>
"""

    message = EmailMessage()
    if settings.EMAIL_FROM:
        message["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM))
    message["To"] = email
    message["Subject"] = subject
    message.set_content(plain_body)
    message.add_alternative(html_body, subtype="html")

    try:
        if settings.SMTP_USE_SSL:
            smtp_class = smtplib.SMTP_SSL
        else:
            smtp_class = smtplib.SMTP

        with smtp_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as client:
            client.ehlo()
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                client.starttls()
                client.ehlo()
            if settings.SMTP_USERNAME:
                client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
            client.send_message(message)
        logger.info("Password reset e-mail sent to %s", email)
    except Exception:
        logger.exception("Failed to deliver password reset e-mail to %s", email)
