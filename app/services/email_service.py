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


def send_dpo_contact_notification(
    protocolo: str,
    nome: str,
    email: str,
    assunto: Optional[str],
    mensagem: str,
) -> None:
    """
    Notify the configured DPO address about a new contact message.
    """
    destinatario = (settings.DPO_EMAIL or "").strip()
    if not destinatario:
        logger.warning(
            "DPO email is not configured. Contact %s will not trigger an e-mail notification.",
            protocolo,
        )
        return

    if not _is_smtp_configured():
        logger.warning(
            "SMTP settings are missing. Unable to notify DPO about protocol %s.",
            protocolo,
        )
        return

    assunto_email = f"[LGPD] Novo contato de titular - {protocolo}"
    assunto_resumido = (assunto or "Assunto nao informado").strip()
    plain_body = (
        f"Voce recebeu uma nova mensagem atraves do canal LGPD.\n\n"
        f"Protocolo: {protocolo}\n"
        f"Nome: {nome}\n"
        f"E-mail informado: {email}\n"
        f"Assunto: {assunto_resumido}\n\n"
        "Mensagem:\n"
        f"{mensagem}\n"
    )
    mensagem_html = mensagem.replace("\n", "<br />")
    html_body = f"""\
<p>Voce recebeu uma nova mensagem atraves do canal LGPD.</p>
<ul>
  <li><strong>Protocolo:</strong> {protocolo}</li>
  <li><strong>Nome:</strong> {nome}</li>
  <li><strong>E-mail informado:</strong> {email}</li>
  <li><strong>Assunto:</strong> {assunto_resumido}</li>
</ul>
<p><strong>Mensagem:</strong></p>
<p>{mensagem_html}</p>
"""

    msg = EmailMessage()
    if settings.EMAIL_FROM:
        msg["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM))
    msg["To"] = destinatario
    msg["Subject"] = assunto_email
    msg.set_content(plain_body)
    msg.add_alternative(html_body, subtype="html")

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
            client.send_message(msg)
        logger.info("DPO notified about protocol %s", protocolo)
    except Exception:
        logger.exception("Failed to notify DPO about protocol %s", protocolo)
