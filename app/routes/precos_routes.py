"""
Rotas para gerenciamento de preÃ§os de produtos.

Permite listar, criar e deletar registros de preÃ§os (`PrecoProduto`). A
listagem suporta filtro por ``produto_id`` e agora tambÃ©m aceita paginaÃ§Ã£o
via ``skip`` e ``limit``. Ao criar um novo preÃ§o, os preÃ§os anteriores
relacionados ao produto sÃ£o desativados e o campo ``preco_venda`` do produto
Ã© atualizado.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import PrecoProduto, Produto
from app.schemas.produto_schema import PrecoProdutoCreate, PrecoProdutoOut


router = APIRouter(prefix="/precos", tags=["PreÃ§os de Produtos"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=List[PrecoProdutoOut])
def listar_precos(
    produto_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> List[PrecoProduto]:
    """Lista preÃ§os, podendo filtrar por produto e paginar os resultados."""
    query = db.query(PrecoProduto)
    if produto_id:
        query = query.filter(PrecoProduto.produto_id == produto_id)
    precos = query.order_by(PrecoProduto.data_inicio.desc()).offset(skip).limit(limit).all()
    # forÃ§a carregar relacionamento produto
    for p in precos:
        _ = p.produto
    return precos


@router.post("/", response_model=PrecoProdutoOut)
def criar_preco(payload: PrecoProdutoCreate, db: Session = Depends(get_db)) -> PrecoProduto:
    """Cria um novo registro de preÃ§o para um produto, desativando preÃ§os ativos anteriores."""
    produto = db.query(Produto).filter(Produto.id == payload.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto nÃ£o encontrado")

    # desativa preÃ§os anteriores
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
    # mantÃ©m cache no produto
    produto.preco_venda = payload.preco
    db.add(produto)
    db.commit()
    db.refresh(novo)
    _ = novo.produto  # forÃ§a carregar produto
    return novo


@router.delete("/{preco_id}")
def deletar_preco(preco_id: UUID, db: Session = Depends(get_db)):
    """Deleta um preÃ§o pelo seu identificador."""
    preco = db.query(PrecoProduto).filter(PrecoProduto.id == preco_id).first()
    if not preco:
        raise HTTPException(status_code=404, detail="PreÃ§o nÃ£o encontrado")
    db.delete(preco)
    db.commit()
    return {"detail": "PreÃ§o excluÃ­do com sucesso"}
