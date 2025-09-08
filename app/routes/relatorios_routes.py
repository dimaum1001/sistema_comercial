# app/routes/relatorios_routes.py
from datetime import date, timedelta
from typing import List, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models import models

router = APIRouter(prefix="/relatorios", tags=["Relatórios"])

# -------------------------
# Vendas por período (dia)
# -------------------------
@router.get("/vendas", response_model=None)
def relatorio_vendas(inicio: date, fim: date, db: Session = Depends(get_db)) -> List[Dict]:
    # inclui o dia final (fim + 1)
    fim_inclusive = fim + timedelta(days=1)
    rows = (
        db.query(
            func.date(models.Venda.data_venda).label("dia"),
            func.sum(models.Venda.total).label("total"),
        )
        .filter(models.Venda.data_venda >= inicio, models.Venda.data_venda < fim_inclusive)
        .group_by(func.date(models.Venda.data_venda))
        .order_by(func.date(models.Venda.data_venda))
        .all()
    )
    return [{"dia": r.dia.isoformat(), "total": float(r.total or 0)} for r in rows]

# -------------------------
# Produtos mais vendidos
# -------------------------
@router.get("/mais-vendidos", response_model=None)
def relatorio_produtos_mais_vendidos(
    limite: int = 10, db: Session = Depends(get_db)
) -> List[Dict]:
    rows = (
        db.query(
            models.Produto.id.label("produto_id"),
            models.Produto.nome.label("nome"),
            func.sum(models.VendaItem.quantidade).label("quantidade"),
        )
        .join(models.VendaItem, models.VendaItem.produto_id == models.Produto.id)
        .group_by(models.Produto.id, models.Produto.nome)
        .order_by(func.sum(models.VendaItem.quantidade).desc())
        .limit(limite)
        .all()
    )
    return [
        {
            "produto_id": str(r.produto_id),
            "nome": r.nome,
            "quantidade": int(r.quantidade or 0),
        }
        for r in rows
    ]

# -------------------------
# Estoque atual + alerta baixo
# -------------------------
@router.get("/estoque", response_model=None)
def relatorio_estoque_atual(db: Session = Depends(get_db)) -> List[Dict]:
    rows = (
        db.query(
            models.Produto.id.label("produto_id"),
            models.Produto.nome.label("nome"),
            models.Produto.estoque.label("estoque"),
            models.Produto.estoque_minimo.label("estoque_minimo"),
            models.Produto.unidade.label("unidade"),
        )
        .order_by(models.Produto.nome.asc())
        .all()
    )
    saida = []
    for r in rows:
        estoque = int(r.estoque or 0)
        minimo = int(r.estoque_minimo or 0)
        saida.append(
            {
                "produto_id": str(r.produto_id),
                "nome": r.nome,
                "estoque": estoque,
                "estoque_minimo": minimo,
                "unidade": r.unidade,
                "alerta_baixo": minimo > 0 and estoque <= minimo,
            }
        )
    return saida

# -------------------------
# Ranking de clientes por total vendido
# -------------------------
@router.get("/ranking-clientes", response_model=None)
def relatorio_ranking_clientes(
    limite: int = 10, db: Session = Depends(get_db)
) -> List[Dict]:
    rows = (
        db.query(
            models.Cliente.id.label("cliente_id"),
            models.Cliente.nome.label("nome"),
            func.sum(models.Venda.total).label("total"),
        )
        .join(models.Venda, models.Venda.cliente_id == models.Cliente.id)
        .group_by(models.Cliente.id, models.Cliente.nome)
        .order_by(func.sum(models.Venda.total).desc())
        .limit(limite)
        .all()
    )
    return [
        {"cliente_id": str(r.cliente_id), "nome": r.nome, "total": float(r.total or 0)}
        for r in rows
    ]
