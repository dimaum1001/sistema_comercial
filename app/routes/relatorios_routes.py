# app/routes/relatorios_routes.py
from typing import Optional, Tuple, List
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, cast, Date

from app.db.database import get_db
from app.models.models import Venda, VendaItem, Produto, Cliente

router = APIRouter(prefix="/relatorios", tags=["Relatórios"])


def _date_range(inicio: Optional[date], fim: Optional[date]) -> Tuple[date, date]:
    """
    Retorna [di, df) — df é exclusivo (um dia após a data final).
    Se nada for informado, usa o mês corrente.
    """
    today = date.today()
    di = inicio or today.replace(day=1)
    df = (fim or today) + timedelta(days=1)
    return di, df


@router.get("/vendas")
def vendas_por_periodo(
    inicio: Optional[date] = Query(None),
    fim: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    di, df = _date_range(inicio, fim)

    total = (
        db.query(func.coalesce(func.sum(Venda.total), 0.0))
        .filter(cast(Venda.data_venda, Date) >= di)
        .filter(cast(Venda.data_venda, Date) < df)
        .scalar()
    )

    qtd_vendas = (
        db.query(func.count(Venda.id))
        .filter(cast(Venda.data_venda, Date) >= di)
        .filter(cast(Venda.data_venda, Date) < df)
        .scalar()
    )

    return {
        "inicio": di,
        "fim": df - timedelta(days=1),
        "qtd_vendas": int(qtd_vendas or 0),
        "total_vendas": float(total or 0.0),
    }


@router.get("/produtos-mais-vendidos")
def produtos_mais_vendidos(
    inicio: Optional[date] = Query(None),
    fim: Optional[date] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    di, df = _date_range(inicio, fim)

    rows = (
        db.query(
            Produto.id.label("produto_id"),
            Produto.nome.label("produto"),
            Produto.codigo_produto.label("codigo"),
            func.coalesce(func.sum(VendaItem.quantidade), 0).label("quantidade"),
            func.coalesce(func.sum(VendaItem.quantidade * VendaItem.preco_unit), 0.0).label("faturamento"),
        )
        .join(VendaItem, VendaItem.produto_id == Produto.id)
        .join(Venda, Venda.id == VendaItem.venda_id)
        .filter(cast(Venda.data_venda, Date) >= di)
        .filter(cast(Venda.data_venda, Date) < df)
        .group_by(Produto.id, Produto.nome, Produto.codigo_produto)
        .order_by(desc("quantidade"))
        .limit(limit)
        .all()
    )

    return [dict(r._mapping) for r in rows]


@router.get("/estoque-atual")
def estoque_atual(
    alerta: Optional[bool] = Query(None, description="Se true, retorna apenas itens abaixo do mínimo"),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Produto.id.label("produto_id"),
            Produto.nome.label("produto"),
            Produto.codigo_produto.label("codigo"),
            Produto.estoque.label("estoque"),
            Produto.estoque_minimo.label("estoque_minimo"),
        )
        .all()
    )

    data: List[dict] = []
    for r in rows:
        m = dict(r._mapping)
        m["alerta"] = (m.get("estoque") or 0) < (m.get("estoque_minimo") or 0)
        data.append(m)

    if alerta is True:
        data = [x for x in data if x["alerta"]]
    return data


@router.get("/ranking-clientes")
def ranking_clientes(
    inicio: Optional[date] = Query(None),
    fim: Optional[date] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    di, df = _date_range(inicio, fim)

    rows = (
        db.query(
            Cliente.id.label("cliente_id"),
            Cliente.nome.label("cliente"),
            func.coalesce(func.sum(Venda.total), 0.0).label("total_gasto"),
            func.count(Venda.id).label("qtd_compras"),
        )
        .join(Venda, Venda.cliente_id == Cliente.id)
        .filter(cast(Venda.data_venda, Date) >= di)
        .filter(cast(Venda.data_venda, Date) < df)
        .group_by(Cliente.id, Cliente.nome)
        .order_by(desc("total_gasto"))
        .limit(limit)
        .all()
    )

    return [dict(r._mapping) for r in rows]
