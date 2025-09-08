from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.database import get_db
from app.models.models import MovimentoEstoque, Produto
from app.schemas.movimento_schema import MovimentoCreate, MovimentoResponse
from typing import List

router = APIRouter()


@router.post("/estoque/movimentar", response_model=MovimentoResponse)
def movimentar_estoque(movimento: MovimentoCreate, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == movimento.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

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
        raise HTTPException(status_code=400, detail="Tipo inválido (use: entrada, saida, ajuste)")

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
def listar_movimentos(db: Session = Depends(get_db)):
    """
    Eager-load do produto e do fornecedor RELACIONADO.
    IMPORTANTE: usar Produto.fornecedor_obj (relationship), NÃO Produto.fornecedor (coluna string).
    """
    return (
        db.query(MovimentoEstoque)
        .options(
            joinedload(MovimentoEstoque.produto)
            .joinedload(Produto.fornecedor_obj)
        )
        .order_by(MovimentoEstoque.data_movimento.desc())
        .all()
    )
