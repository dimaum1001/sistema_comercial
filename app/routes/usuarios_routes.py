
"""
Rotas para gerenciamento de usuarios.

Este modulo define endpoints CRUD para o modelo ``Usuario``. Inclui funcoes
para listar, criar, atualizar e deletar usuarios, alem de dependencias para
obter a sessao do banco de dados e validar o token do usuario autenticado.

Principais melhorias em relacao a versao original:

* A listagem de usuarios agora suporta paginacao via parametros ``skip`` e
  ``limit`` para evitar carregamento excessivo de dados.
* O carregamento de configuracoes de autenticacao continua baseado em
  dependencias injetadas via ``app.auth.deps``.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import SessionLocal
from app.auth.deps import require_admin
from app.models.models import Usuario
from app.schemas.usuario_schema import UsuarioCreate, UsuarioOut
from passlib.hash import bcrypt


router = APIRouter(dependencies=[Depends(require_admin)])


ALLOWED_USER_TYPES = {"admin", "cliente", "financeiro", "estoque", "vendas"}


def get_db() -> Session:
    """Retorna uma nova sessao de banco de dados usando SessionLocal."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/usuarios", response_model=List[UsuarioOut])
def listar_usuarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Lista usuarios com suporte a paginacao."""
    return db.query(Usuario).offset(skip).limit(limit).all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def criar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    """Cria um novo usuario. O primeiro registro sempre recebe tipo admin."""
    if db.query(Usuario).count() == 0:
        tipo = "admin"
    else:
        tipo = (usuario.tipo or "").strip().lower()
        if tipo not in ALLOWED_USER_TYPES:
            raise HTTPException(status_code=400, detail="Tipo de usuario invalido")

    if db.query(Usuario).filter(Usuario.email == usuario.email).first():
        raise HTTPException(status_code=400, detail="Email ja registrado")

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


@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
def atualizar_usuario(usuario_id: str, usuario_dados: UsuarioCreate, db: Session = Depends(get_db)):
    """Atualiza os dados de um usuario existente."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")

    tipo_normalizado = (usuario_dados.tipo or "").strip().lower()
    if tipo_normalizado not in ALLOWED_USER_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de usuario invalido")

    usuario.nome = usuario_dados.nome
    usuario.email = usuario_dados.email
    usuario.tipo = tipo_normalizado
    usuario.senha_hash = bcrypt.hash(usuario_dados.senha)

    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_usuario(usuario_id: str, db: Session = Depends(get_db)):
    """Remove um usuario do banco de dados."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    db.delete(usuario)
    db.commit()
    return {"detail": "Usuario removido com sucesso"}
