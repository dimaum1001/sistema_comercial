"""
Rotas para gerenciamento de contas a pagar.

Este módulo define as operações CRUD para o modelo ContaPagar. As rotas
são registradas em um APIRouter com prefixo ``/contas-pagar`` e tag
``Contas a Pagar``. Elas permitem listar todas as contas, buscar uma
conta específica, criar novas contas, atualizar campos existentes e
marcar uma conta como paga.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.schemas.conta_pagar_schema import (
    ContaPagar as ContaPagarSchema,
    ContaPagarCreate,
    ContaPagarUpdate,
)


router = APIRouter(prefix="/contas-pagar", tags=["Contas a Pagar"])


@router.get("/", response_model=List[ContaPagarSchema])
def listar_contas(db: Session = Depends(get_db)) -> List[models.ContaPagar]:
    """Retorna todas as contas a pagar cadastradas."""
    return db.query(models.ContaPagar).all()


@router.get("/{conta_id}", response_model=ContaPagarSchema)
def obter_conta(conta_id: uuid.UUID, db: Session = Depends(get_db)) -> models.ContaPagar:
    """Retorna uma conta a pagar específica pelo ID."""
    conta = db.query(models.ContaPagar).get(conta_id)
    if not conta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta não encontrada")
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
def atualizar_conta(
    conta_id: uuid.UUID, conta_update: ContaPagarUpdate, db: Session = Depends(get_db)
) -> models.ContaPagar:
    """Atualiza os campos de uma conta a pagar existente."""
    conta = db.query(models.ContaPagar).get(conta_id)
    if not conta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta não encontrada")

    for campo, valor in conta_update.dict(exclude_unset=True).items():
        setattr(conta, campo, valor)

    db.commit()
    db.refresh(conta)
    return conta


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_conta(conta_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    """Remove uma conta a pagar do banco de dados."""
    conta = db.query(models.ContaPagar).get(conta_id)
    if not conta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta não encontrada")
    db.delete(conta)
    db.commit()
    return None