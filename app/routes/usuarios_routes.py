from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import SessionLocal
from app.models.models import Usuario
from app.schemas.usuario_schema import UsuarioCreate, UsuarioOut
from app.auth.auth_handler import verificar_token
from passlib.hash import bcrypt

router = APIRouter()

# Dependência de banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Dependência para validar token e retornar usuário autenticado
def get_usuario_autenticado(token: str = Depends(verificar_token), db: Session = Depends(get_db)):
    if not token or "sub" not in token:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    usuario = db.query(Usuario).filter(Usuario.id == token["sub"]).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario

# Verifica se é admin
def somente_admin(usuario: Usuario = Depends(get_usuario_autenticado)):
    if usuario.tipo != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem acessar")
    return usuario


# 📌 Listar usuários
@router.get("/usuarios", response_model=List[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db)):

    return db.query(Usuario).all()


# 📌 Criar usuário (admin pode criar qualquer tipo)
@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
def criar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    # se não existir nenhum usuário, o primeiro sempre será admin
    if db.query(Usuario).count() == 0:
        tipo = "admin"
    else:
        tipo = usuario.tipo.strip().lower()

    if db.query(Usuario).filter(Usuario.email == usuario.email).first():
        raise HTTPException(status_code=400, detail="Email já registrado")

    novo_usuario = Usuario(
        nome=usuario.nome,
        email=usuario.email,
        senha_hash=bcrypt.hash(usuario.senha),
        tipo=tipo,
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return novo_usuario



# 📌 Atualizar usuário
@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
def atualizar_usuario(usuario_id: str, usuario_dados: UsuarioCreate, db: Session = Depends(get_db), admin: Usuario = Depends(somente_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    usuario.nome = usuario_dados.nome
    usuario.email = usuario_dados.email
    usuario.tipo = usuario_dados.tipo.strip().lower()
    usuario.senha_hash = bcrypt.hash(usuario_dados.senha)

    db.commit()
    db.refresh(usuario)
    return usuario


# 📌 Deletar usuário
@router.delete("/usuarios/{usuario_id}", status_code=204)
def deletar_usuario(usuario_id: str, db: Session = Depends(get_db), admin: Usuario = Depends(somente_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    db.delete(usuario)
    db.commit()
    return {"detail": "Usuário removido com sucesso"}
