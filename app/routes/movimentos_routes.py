"""
Rotas para movimentaÃ§Ãµes de estoque.

Permite registrar entradas, saÃ­das e ajustes de estoque e listar os
movimentos cadastrados. A listagem agora aceita parÃ¢metros ``skip`` e
``limit`` para paginaÃ§Ã£o e utiliza eager loading para trazer informaÃ§Ãµes
relacionadas ao produto e seu fornecedor.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import MovimentoEstoque, Produto
from app.schemas.movimento_schema import MovimentoCreate, MovimentoResponse


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/estoque/movimentar", response_model=MovimentoResponse)
def movimentar_estoque(movimento: MovimentoCreate, db: Session = Depends(get_db)) -> MovimentoEstoque:
    """Aplica um movimento de estoque para um produto (entrada, saÃ­da ou ajuste)."""
    produto = db.query(Produto).filter(Produto.id == movimento.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto nÃ£o encontrado")

    if movimento.quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")

    # Aplica o movimento no estoque do produto
    if movimento.tipo == "entrada":
        produto.estoque = (produto.estoque or 0) + movimento.quantidade
    elif movimento.tipo == "saida":
        if (produto.estoque or 0) < movimento.quantidade:
            raise HTTPException(status_code=400, detail="Estoque insuficiente")
        produto.estoque = (produto.estoque or 0) - movimento.quantidade
    elif movimento.tipo == "ajuste":
        produto.estoque = movimento.quantidade
    else:
        raise HTTPException(status_code=400, detail="Tipo invÃ¡lido (use: entrada, saida, ajuste)")

    novo_movimento = MovimentoEstoque(
        produto_id=movimento.produto_id,
        tipo=movimento.tipo,
        quantidade=movimento.quantidade,
        observacao=movimento.observacao
    )
    db.add(novo_movimento)
    db.commit()
    db.refresh(novo_movimento)
    return novo_movimento


@router.get("/estoque/movimentos", response_model=List[MovimentoResponse])
def listar_movimentos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[MovimentoEstoque]:
    """Lista movimentos de estoque em ordem decrescente de data.

    Eagerâ€‘load do produto e do fornecedor relacionado. Permite paginaÃ§Ã£o
    atravÃ©s dos parÃ¢metros ``skip`` e ``limit``.
    """
    query = (
        db.query(MovimentoEstoque)
        .options(
            joinedload(MovimentoEstoque.produto).joinedload(Produto.fornecedor_obj)
        )
        .order_by(MovimentoEstoque.data_movimento.desc())
    )
    movimentos = query.offset(skip).limit(limit).all()
    return movimentos
