import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Header, BackgroundTasks
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from app.core.config import settings
from app.schemas.usuario_schema import UsuarioCreate, UsuarioLogin, UsuarioOut
from app.schemas.password_reset_schema import ForgotPasswordRequest, ResetPasswordRequest
from app.models.models import Usuario, PasswordResetToken
from app.db.database import SessionLocal
from app.auth.auth_handler import criar_token, verificar_token
from app.services.email_service import send_password_reset_email


router = APIRouter()
logger = logging.getLogger(__name__)
RESET_TOKEN_VALIDITY_HOURS = settings.PASSWORD_RESET_TOKEN_TTL_HOURS or 2

# Dependência para obter uma sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_usuario_autenticado(
    db: Session = Depends(get_db),
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    
    token = authorization[7:]
    payload = verificar_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    usuario_id = payload.get("sub")
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario


@router.post("/login")
def login(usuario: UsuarioLogin, db: Session = Depends(get_db)):
    db_usuario = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if not db_usuario or not bcrypt.verify(usuario.senha, db_usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    token = criar_token({"sub": str(db_usuario.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register", response_model=UsuarioOut, status_code=201)
def criar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == usuario.email).first():
        raise HTTPException(status_code=400, detail="Email já registrado")

    total_usuarios = db.query(Usuario).count()
    if total_usuarios == 0:
        tipo_normalizado = "admin"
    else:
        tipo_normalizado = (usuario.tipo or "").strip().lower()
        if tipo_normalizado != "cliente":
            raise HTTPException(status_code=403, detail="Somente administradores podem definir esse tipo de usuário")
    
    
    novo_usuario = Usuario(
        nome=usuario.nome,
        email=usuario.email,
        senha_hash=bcrypt.hash(usuario.senha),
        tipo=tipo_normalizado,
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    return UsuarioOut.model_validate(novo_usuario)




@router.get("/me", response_model=UsuarioOut)
def get_me(usuario: Usuario = Depends(get_usuario_autenticado)):
    return usuario


@router.post("/forgot-password", status_code=202)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    usuario = db.query(Usuario).filter(Usuario.email == email).first()

    if usuario:
        solicitacao_em = datetime.utcnow()
        token_plain = secrets.token_urlsafe(48)
        token_hash = bcrypt.hash(token_plain)
        expires_at = solicitacao_em + timedelta(hours=RESET_TOKEN_VALIDITY_HOURS)

        reset_entry = PasswordResetToken(
            usuario_id=usuario.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(reset_entry)
        db.flush()

        (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.usuario_id == usuario.id,
                PasswordResetToken.usado.is_(False),
                PasswordResetToken.id != reset_entry.id,
            )
            .update({"usado": True, "usado_em": solicitacao_em}, synchronize_session=False)
        )

        db.commit()
        db.refresh(reset_entry)

        background_tasks.add_task(
            send_password_reset_email,
            email=usuario.email,
            nome=usuario.nome,
            token=token_plain,
        )
        logger.info("Password reset token generated for %s", email)

    return {
        "message": "Se o e-mail estiver cadastrado, enviaremos instrucoes para redefinir a senha."
    }



@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token_recebido = payload.token.strip()
    agora = datetime.utcnow()

    candidatos = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.usado.is_(False))
        .filter(PasswordResetToken.expires_at >= agora)
        .order_by(PasswordResetToken.criado_em.desc())
        .all()
    )

    token_encontrado = None
    for candidato in candidatos:
        if bcrypt.verify(token_recebido, candidato.token_hash):
            token_encontrado = candidato
            break

    if not token_encontrado:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")

    usuario = db.query(Usuario).filter(Usuario.id == token_encontrado.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if bcrypt.verify(payload.nova_senha, usuario.senha_hash):
        raise HTTPException(status_code=400, detail="Nova senha deve ser diferente da atual.")

    usuario.senha_hash = bcrypt.hash(payload.nova_senha)
    token_encontrado.usado = True
    token_encontrado.usado_em = agora

    # Invalida outros tokens ativos do usuário por segurança
    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.usuario_id == usuario.id,
            PasswordResetToken.usado.is_(False),
            PasswordResetToken.id != token_encontrado.id,
        )
        .update({"usado": True, "usado_em": agora}, synchronize_session=False)
    )

    db.commit()

    return {"message": "Senha redefinida com sucesso."}
