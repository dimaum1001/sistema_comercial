from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.models.models import Pagamento
from app.schemas.pagamento_schema import PagamentoCreate, PagamentoUpdate, PagamentoOut

router = APIRouter()


@router.post("/pagamentos", response_model=PagamentoOut)
def criar_pagamento(payload: PagamentoCreate, db: Session = Depends(get_db)):
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
def listar_pagamentos(db: Session = Depends(get_db)):
    """ Lista todos os pagamentos ordenados por vencimento """
    return db.query(Pagamento).order_by(Pagamento.data_vencimento.asc().nullslast()).all()


@router.get("/pagamentos/pendentes", response_model=List[PagamentoOut])
def listar_pendentes(db: Session = Depends(get_db)):
    """ Lista apenas pagamentos ainda pendentes """
    return db.query(Pagamento).filter(Pagamento.status == "pendente").order_by(Pagamento.data_vencimento.asc().nullslast()).all()


@router.put("/pagamentos/{pagamento_id}", response_model=PagamentoOut)
def atualizar_pagamento(pagamento_id: UUID, payload: PagamentoUpdate, db: Session = Depends(get_db)):
    pagamento = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    dados = payload.dict(exclude_unset=True)

    # 🔹 Se marcar como pago e não tiver data_pagamento, define agora
    if dados.get("status") == "pago" and not dados.get("data_pagamento"):
        dados["data_pagamento"] = datetime.utcnow()

    for key, value in dados.items():
        setattr(pagamento, key, value)

    db.commit()
    db.refresh(pagamento)
    return pagamento


@router.delete("/pagamentos/{pagamento_id}", status_code=204)
def excluir_pagamento(pagamento_id: UUID, db: Session = Depends(get_db)):
    pagamento = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    db.delete(pagamento)
    db.commit()
    return {"detail": "Pagamento excluído com sucesso"}
