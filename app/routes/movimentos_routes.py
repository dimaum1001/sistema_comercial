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
from decimal import Decimal, ROUND_HALF_UP

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import MovimentoEstoque, Produto
from app.schemas.movimento_schema import MovimentoCreate, MovimentoResponse


router = APIRouter(dependencies=[Depends(get_current_user)])

CENT = Decimal("0.01")
QTD = Decimal("0.001")


def _dec(value, default="0") -> Decimal:
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _quantize_qty(value: Decimal) -> Decimal:
    return value.quantize(QTD, rounding=ROUND_HALF_UP)


@router.post("/estoque/movimentar", response_model=MovimentoResponse)
def movimentar_estoque(movimento: MovimentoCreate, db: Session = Depends(get_db)) -> MovimentoEstoque:
    """Aplica um movimento de estoque para um produto (entrada, saÃ­da ou ajuste)."""
    produto = db.query(Produto).filter(Produto.id == movimento.produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto nÃ£o encontrado")

    estoque_atual_decimal = _quantize_qty(_dec(produto.estoque, "0"))
    quantidade_decimal = _quantize_qty(_dec(movimento.quantidade))
    custo_unitario_decimal = None
    valor_total_decimal = None

    if quantidade_decimal <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")

    if movimento.tipo == "entrada":
        if movimento.custo_unitario is None:
            raise HTTPException(status_code=400, detail="Informe o custo_unitario para entradas de estoque")

        custo_unitario_decimal = _money(_dec(movimento.custo_unitario))
        if custo_unitario_decimal < 0:
            raise HTTPException(status_code=400, detail="custo_unitario deve ser maior ou igual a zero")

        novo_estoque_decimal = _qty(estoque_atual_decimal + quantidade_decimal)
        valor_total_decimal = custo_unitario_decimal * quantidade_decimal

        custo_referencia = produto.custo_medio if produto.custo_medio is not None else produto.custo
        total_atual_decimal = (_dec(custo_referencia, "0") * estoque_atual_decimal) if custo_referencia is not None else Decimal("0")
        novo_total_decimal = total_atual_decimal + valor_total_decimal
        novo_custo_medio = custo_unitario_decimal if novo_estoque_decimal <= 0 else novo_total_decimal / novo_estoque_decimal

        produto.custo = _quantize(custo_unitario_decimal)
        produto.custo_medio = _quantize(novo_custo_medio)
        produto.estoque = novo_estoque_decimal
    elif movimento.tipo == "saida":
        if estoque_atual_decimal < quantidade_decimal:
            raise HTTPException(status_code=400, detail="Estoque insuficiente")

        produto.estoque = _qty(estoque_atual_decimal - quantidade_decimal)

        if movimento.custo_unitario is not None:
            custo_unitario_decimal = _money(_dec(movimento.custo_unitario))
        else:
            custo_referencia = produto.custo_medio if produto.custo_medio is not None else produto.custo
            custo_unitario_decimal = _money(_dec(custo_referencia, "0")) if custo_referencia is not None else Decimal("0")

        if custo_unitario_decimal < 0:
            raise HTTPException(status_code=400, detail="custo_unitario deve ser maior ou igual a zero")

        valor_total_decimal = custo_unitario_decimal * quantidade_decimal
    elif movimento.tipo == "ajuste":
        produto.estoque = _qty(quantidade_decimal)

        if movimento.custo_unitario is not None:
            custo_unitario_decimal = _money(_dec(movimento.custo_unitario))
            if custo_unitario_decimal < 0:
                raise HTTPException(status_code=400, detail="custo_unitario deve ser maior ou igual a zero")
            produto.custo = _quantize(custo_unitario_decimal)
            produto.custo_medio = _quantize(custo_unitario_decimal)
            valor_total_decimal = custo_unitario_decimal * quantidade_decimal
        else:
            custo_unitario_decimal = None
            valor_total_decimal = None
    else:
        raise HTTPException(status_code=400, detail="Tipo invalido (use: entrada, saida, ajuste)")

    custo_unitario_registro = _quantize(custo_unitario_decimal) if custo_unitario_decimal is not None else None
    valor_total_registro = _quantize(valor_total_decimal) if valor_total_decimal is not None else None

    novo_movimento = MovimentoEstoque(
        produto_id=movimento.produto_id,
        tipo=movimento.tipo,
        quantidade=quantidade_decimal,
        observacao=movimento.observacao,
        custo_unitario=custo_unitario_registro,
        valor_total=valor_total_registro
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
