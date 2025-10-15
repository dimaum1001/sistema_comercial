from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.models.models import Produto, UnidadeMedida
from app.schemas.unidade_medida_schema import (
    UnidadeMedidaCreate,
    UnidadeMedidaOut,
    UnidadeMedidaUpdate,
)

router = APIRouter(
    prefix="/unidades-medida",
    tags=["Unidades de Medida"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=List[UnidadeMedidaOut])
def listar_unidades(
    q: Optional[str] = Query(default=None, description="Filtra por nome ou sigla"),
    db: Session = Depends(get_db),
) -> List[UnidadeMedida]:
    consulta = db.query(UnidadeMedida)
    if q and q.strip():
        termo = f"%{q.strip()}%"
        consulta = consulta.filter(
            or_(UnidadeMedida.nome.ilike(termo), UnidadeMedida.sigla.ilike(termo))
        )
    return consulta.order_by(UnidadeMedida.sigla.asc(), UnidadeMedida.nome.asc()).all()


@router.post("", response_model=UnidadeMedidaOut, status_code=201)
def criar_unidade(unidade: UnidadeMedidaCreate, db: Session = Depends(get_db)) -> UnidadeMedida:
    nova_unidade = UnidadeMedida(**unidade.model_dump())
    db.add(nova_unidade)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "unico" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status_code=409, detail="Sigla já cadastrada para outra unidade.")
        raise
    db.refresh(nova_unidade)
    return nova_unidade


@router.put("/{unidade_id}", response_model=UnidadeMedidaOut)
def atualizar_unidade(
    unidade_id: UUID,
    unidade_update: UnidadeMedidaUpdate,
    db: Session = Depends(get_db),
) -> UnidadeMedida:
    unidade = db.query(UnidadeMedida).filter(UnidadeMedida.id == unidade_id).first()
    if not unidade:
        raise HTTPException(status_code=404, detail="Unidade de medida não encontrada.")

    dados = unidade_update.model_dump(exclude_unset=True)
    for campo, valor in dados.items():
        setattr(unidade, campo, valor)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "unico" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(status_code=409, detail="Sigla já cadastrada para outra unidade.")
        raise
    db.refresh(unidade)
    return unidade


@router.delete("/{unidade_id}", status_code=204)
def deletar_unidade(unidade_id: UUID, db: Session = Depends(get_db)):
    unidade = db.query(UnidadeMedida).filter(UnidadeMedida.id == unidade_id).first()
    if not unidade:
        raise HTTPException(status_code=404, detail="Unidade de medida não encontrada.")

    em_uso = db.query(Produto.id).filter(Produto.unidade_id == unidade_id).first()
    if em_uso:
        raise HTTPException(
            status_code=400,
            detail="Não é possível remover a unidade: existem produtos associados a ela.",
        )

    db.delete(unidade)
    db.commit()
