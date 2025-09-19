from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.models.models import PrecoProduto, Produto
from app.schemas.produto_schema import PrecoProdutoCreate, PrecoProdutoOut

router = APIRouter(prefix="/precos", tags=["Preços de Produtos"])


# ========================
# Listar todos preços ou apenas de um produto
# ========================
@router.get("/", response_model=List[PrecoProdutoOut])
def listar_precos(produto_id: Optional[UUID] = None, db: Session = Depends(get_db)):
    query = db.query(PrecoProduto)
    if produto_id:
        query = query.filter(PrecoProduto.produto_id == produto_id)
    precos = query.order_by(PrecoProduto.data_inicio.desc()).all()

    # força carregar relacionamento
    for p in precos:
        _ = p.produto

    return precos


# ========================
# Criar um novo preço
# ========================
@router.post("/", response_model=PrecoProdutoOut)
def criar_preco(payload: PrecoProdutoCreate, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == payload.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    # desativa preços anteriores
    db.query(PrecoProduto).filter(
        PrecoProduto.produto_id == payload.produto_id,
        PrecoProduto.ativo == True
    ).update({
        "ativo": False,
        "data_fim": datetime.utcnow()
    }, synchronize_session=False)

    novo = PrecoProduto(
        produto_id=payload.produto_id,
        preco=payload.preco,
        ativo=bool(payload.ativo)
    )
    db.add(novo)

    # mantém cache no produto
    produto.preco_venda = payload.preco
    db.add(produto)

    db.commit()
    db.refresh(novo)
    _ = novo.produto  # 🔹 força carregar produto
    return novo


# ========================
# Deletar preço
# ========================
@router.delete("/{preco_id}")
def deletar_preco(preco_id: UUID, db: Session = Depends(get_db)):
    preco = db.query(PrecoProduto).filter(PrecoProduto.id == preco_id).first()
    if not preco:
        raise HTTPException(status_code=404, detail="Preço não encontrado")

    db.delete(preco)
    db.commit()
    return {"detail": "Preço excluído com sucesso"}
