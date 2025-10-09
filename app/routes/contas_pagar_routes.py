"""
Rotas para gerenciamento de contas a pagar.

Define operaÃ§Ãµes CRUD sobre ``ContaPagar``, com listagem paginada e
substituiÃ§Ã£o do mÃ©todo depreciado ``db.query(...).get()`` pelo mÃ©todo
recomendado ``db.get()`` do SQLAlchemy 2.x. A listagem retorna todas as
contas a pagar existentes de forma paginada.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models import models
from app.schemas.conta_pagar_schema import (
    ContaPagar as ContaPagarSchema,
    ContaPagarCreate,
    ContaPagarUpdate,
)


router = APIRouter(prefix="/contas-pagar", tags=["Contas a Pagar"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[ContaPagarSchema])
def listar_contas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[models.ContaPagar]:
    """Retorna todas as contas a pagar cadastradas com suporte a paginaÃ§Ã£o."""
    return db.query(models.ContaPagar).offset(skip).limit(limit).all()


@router.get("/{conta_id}", response_model=ContaPagarSchema)
def obter_conta(conta_id: uuid.UUID, db: Session = Depends(get_db)) -> models.ContaPagar:
    """Retorna uma conta a pagar especÃ­fica pelo ID."""
    conta = db.get(models.ContaPagar, conta_id)
    if not conta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta nÃ£o encontrada")
    return conta


@router.post("/", response_model=ContaPagarSchema, status_code=status.HTTP_201_CREATED)
def criar_conta(conta: ContaPagarCreate, db: Session = Depends(get_db)) -> models.ContaPagar:
    """Cria uma nova conta a pagar."""
    nova_conta = models.ContaPagar(**conta.dict())
    db.add(nova_conta)
    db.commit()
    db.refresh(nova_conta)
    return nova_conta


@router.put("/{conta_id}", response_model=ContaPagarSchema)
def atualizar_conta(conta_id: uuid.UUID, conta_update: ContaPagarUpdate, db: Session = Depends(get_db)) -> models.ContaPagar:
    """Atualiza os campos de uma conta a pagar existente."""
    conta = db.get(models.ContaPagar, conta_id)
    if not conta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta nÃ£o encontrada")
    for campo, valor in conta_update.dict(exclude_unset=True).items():
        setattr(conta, campo, valor)
    db.commit()
    db.refresh(conta)
    return conta


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_conta(conta_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    """Remove uma conta a pagar do banco de dados."""
    conta = db.get(models.ContaPagar, conta_id)
    if not conta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta nÃ£o encontrada")
    db.delete(conta)
    db.commit()
    return None

