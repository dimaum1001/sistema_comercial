from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.auth_handler import verificar_token
from app.db.database import get_db
from app.models.models import Usuario


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Usuario:
    """Retorna o usuario autenticado a partir do header Bearer token."""
    token_header = authorization
    if not token_header or not token_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente ou invalido")

    payload = verificar_token(token_header[7:])
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente ou invalido")

    usuario = db.query(Usuario).filter(Usuario.id == payload["sub"]).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario nao encontrado")

    return usuario


def require_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    if str(getattr(user, "tipo", "")).lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem acessar")
    return user


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[Usuario]:
    """Retorna o usuário autenticado ou None quando o header não está presente ou é inválido."""
    token_header = authorization
    if not token_header or not token_header.startswith("Bearer "):
        return None

    payload = verificar_token(token_header[7:])
    if not payload or not payload.get("sub"):
        return None

    usuario = db.query(Usuario).filter(Usuario.id == payload["sub"]).first()
    return usuario
