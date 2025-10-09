"""
Rotas para gerenciamento de pagamentos das vendas.

Inclui criaÃ§Ã£o, listagem (com paginaÃ§Ã£o), listagem de pendentes, atualizaÃ§Ã£o
e exclusÃ£o de pagamentos. Ao marcar um pagamento como pago, se nenhuma data
for fornecida, define a data de pagamento como o momento atual.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import Pagamento
from app.schemas.pagamento_schema import PagamentoCreate, PagamentoUpdate, PagamentoOut


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/pagamentos", response_model=PagamentoOut)
def criar_pagamento(payload: PagamentoCreate, db: Session = Depends(get_db)) -> Pagamento:
    """Cria um novo pagamento associado a uma venda."""
    novo_pagamento = Pagamento(
        venda_id=payload.venda_id,
        forma_pagamento=payload.forma_pagamento,
        valor=payload.valor,
        status=payload.status or "pendente",
        data_vencimento=payload.data_vencimento,
        parcela_numero=payload.parcela_numero,
        parcela_total=payload.parcela_total,
        observacao=payload.observacao
    )
    db.add(novo_pagamento)
    db.commit()
    db.refresh(novo_pagamento)
    return novo_pagamento


@router.get("/pagamentos", response_model=List[PagamentoOut])
def listar_pagamentos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[Pagamento]:
    """Lista todos os pagamentos ordenados por vencimento com paginaÃ§Ã£o."""
    return (
        db.query(Pagamento)
        .order_by(Pagamento.data_vencimento.asc().nullslast())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/pagamentos/pendentes", response_model=List[PagamentoOut])
def listar_pendentes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[Pagamento]:
    """Lista apenas os pagamentos ainda pendentes com paginaÃ§Ã£o."""
    return (
        db.query(Pagamento)
        .filter(Pagamento.status == "pendente")
        .order_by(Pagamento.data_vencimento.asc().nullslast())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.put("/pagamentos/{pagamento_id}", response_model=PagamentoOut)
def atualizar_pagamento(pagamento_id: UUID, payload: PagamentoUpdate, db: Session = Depends(get_db)) -> Pagamento:
    """Atualiza campos de um pagamento existente; define data_pagamento quando status=\"pago\"."""
    pagamento = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento nÃ£o encontrado")
    dados = payload.dict(exclude_unset=True)
    # Se marcar como pago e nÃ£o tiver data_pagamento, define agora
    if dados.get("status") == "pago" and not dados.get("data_pagamento"):
        dados["data_pagamento"] = datetime.utcnow()
    for key, value in dados.items():
        setattr(pagamento, key, value)
    db.commit()
    db.refresh(pagamento)
    return pagamento


@router.delete("/pagamentos/{pagamento_id}", status_code=204)
def excluir_pagamento(pagamento_id: UUID, db: Session = Depends(get_db)):
    """Exclui um pagamento pelo seu identificador."""
    pagamento = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento nÃ£o encontrado")
    db.delete(pagamento)
    db.commit()
    return {"detail": "Pagamento excluÃ­do com sucesso"}
