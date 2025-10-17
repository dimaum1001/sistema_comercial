# app/routes/relatorios_routes.py
from typing import Optional, Tuple, List
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, cast, Date, or_

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import Venda, VendaItem, Produto, Cliente

router = APIRouter(prefix="/relatorios", tags=["RelatÃ³rios"], dependencies=[Depends(get_current_user)])


def _date_range(inicio: Optional[date], fim: Optional[date]) -> Tuple[date, date]:
    """
    Retorna [di, df) â€” df Ã© exclusivo (um dia apÃ³s a data final).
    Se nada for informado, usa o mÃªs corrente.
    """
    today = date.today()
    di = inicio or today.replace(day=1)
    df = (fim or today) + timedelta(days=1)
    return di, df


def _normalize_pagination(
    page: Optional[int],
    per_page: Optional[int],
    limit: Optional[int],
    offset: Optional[int],
    max_per_page: int = 200,
) -> tuple[int, int]:
    if per_page is not None or page is not None:
        p = max(1, int(page or 1))
        pp = min(max_per_page, max(1, int(per_page or max_per_page)))
        return (pp * (p - 1), pp)
    lim = min(max_per_page, max(1, int(limit or max_per_page)))
    off = max(0, int(offset or 0))
    return (off, lim)


# ======================
# RelatÃ³rio Resumido
# ======================
@router.get("/vendas")
def vendas_por_periodo(
    inicio: Optional[date] = Query(None),
    fim: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    di, df = _date_range(inicio, fim)

    vendas = (
        db.query(Venda)
        .options(joinedload(Venda.pagamentos))  # <â€” importante
        .filter(cast(Venda.data_venda, Date) >= di)
        .filter(cast(Venda.data_venda, Date) < df)
        .all()
    )

    total_vendas = float(sum(v.total or 0 for v in vendas))
    qtd_vendas = len(vendas)

    # somatÃ³rio por forma
    formas = {"dinheiro": 0.0, "credito": 0.0, "debito": 0.0, "pix": 0.0, "outros": 0.0}
    for v in vendas:
        for p in getattr(v, "pagamentos", []) or []:
            forma = str(getattr(p, "forma_pagamento", "") or "").lower()
            valor = float(getattr(p, "valor", 0) or 0)
            if forma in formas:
                formas[forma] += valor
            else:
                formas["outros"] += valor

    return {
        "inicio": di,
        "fim": df - timedelta(days=1),
        "qtd_vendas": int(qtd_vendas or 0),
        "total_vendas": float(total_vendas or 0.0),
        "totais_por_forma": {k: round(v, 2) for k, v in formas.items()},
    }


# ======================
# RelatÃ³rio Detalhado (Paginado)
# ======================
@router.get("/vendas/detalhadas")
def vendas_detalhadas(
    response: Response,
    inicio: Optional[date] = Query(None),
    fim: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    di, df = _date_range(inicio, fim)

    base = (
        db.query(Venda)
        .options(
            joinedload(Venda.cliente),
            joinedload(Venda.itens).joinedload(VendaItem.produto),
            joinedload(Venda.pagamentos),  # <â€” importante
        )
        .filter(cast(Venda.data_venda, Date) >= di)
        .filter(cast(Venda.data_venda, Date) < df)
        .order_by(Venda.data_venda.desc())
    )

    total = base.count()
    offset = (page - 1) * per_page
    vendas = base.offset(offset).limit(per_page).all()

    start = 0 if total == 0 else offset
    end = 0 if total == 0 else min(offset + per_page, total) - 1
    response.headers["X-Total-Count"] = str(total)
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count, Content-Range"

    resultado: List[dict] = []
    for v in vendas:
        # pagamentos (lista) + formas (apenas rÃ³tulos)
        pagamentos = [
            {
                "forma": (p.forma_pagamento or "").lower(),
                "valor": float(p.valor or 0),
            }
            for p in (getattr(v, "pagamentos", []) or [])
        ]
        formas_rotulos = sorted(list({(p.get("forma") or "").upper() for p in pagamentos if p.get("forma")}))

        resultado.append({
            "id": str(v.id),
            "data_venda": v.data_venda,
            "cliente": v.cliente.nome if v.cliente else "Venda sem cliente",
            "total": float(v.total or 0.0),
            "pagamentos": pagamentos,
        "formas": formas_rotulos,
        "itens": [
            {
                "produto": i.produto.nome if i.produto else "Produto removido",
                "quantidade": float(i.quantidade or 0),
                "preco_unit": float(i.preco_unit or 0),
                "subtotal": float(i.preco_unit or 0) * float(i.quantidade or 0),
            }
            for i in v.itens
        ],
    })


    # cabeÃ§alhos de paginaÃ§Ã£o
    start = 0 if total == 0 else (page - 1) * per_page
    end = 0 if total == 0 else min(start + per_page, total) - 1

    from fastapi import Response
    resp = Response()
    resp.headers["X-Total-Count"] = str(total)
    resp.headers["Content-Range"] = f"items {start}-{end}/{total}"

    return resultado



# ======================
# Produtos Mais Vendidos
# ======================
@router.get("/relatorios/produtos-mais-vendidos")  # compatÃ­vel com paths antigos
def _produtos_mais_vendidos_redirect(*args, **kwargs):
    return produtos_mais_vendidos(*args, **kwargs)


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


# ======================
# Estoque Atual (Paginado + Busca)
# ======================
@router.get("/estoque-atual")
def estoque_atual(
    response: Response,
    alerta: Optional[bool] = Query(None, description="Se true, apenas itens abaixo do mÃ­nimo"),
    q: Optional[str] = Query(None, description="Busca por nome/cÃ³digo"),
    # paginaÃ§Ã£o
    page: Optional[int] = Query(default=None, ge=1),
    per_page: Optional[int] = Query(default=None, ge=1, le=200),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: Optional[int] = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    skip, lim = _normalize_pagination(page, per_page, limit, offset)

    base = db.query(
        Produto.id.label("produto_id"),
        Produto.nome.label("produto"),
        Produto.codigo_produto.label("codigo"),
        Produto.estoque.label("estoque"),
        Produto.estoque_minimo.label("estoque_minimo"),
    )

    if q and q.strip():
        like = f"%{q.strip()}%"
        base = base.filter(or_(Produto.nome.ilike(like), Produto.codigo_produto.ilike(like)))

    # COUNT rÃ¡pido
    total = base.with_entities(func.count(Produto.id)).scalar() or 0

    rows = (
        base.order_by(Produto.nome.asc(), Produto.id.asc())
        .offset(skip)
        .limit(lim)
        .all()
    )

    data: List[dict] = []
    for r in rows:
        m = dict(r._mapping)
        m["alerta"] = (m.get("estoque") or 0) < (m.get("estoque_minimo") or 0)
        data.append(m)

    if alerta is True:
        data = [x for x in data if x["alerta"]]
        # quando filtra depois, o total enviado deve refletir o filtro
        total = len(data)

    # headers de paginaÃ§Ã£o (expostos p/ o browser)
    start = 0 if total == 0 else skip
    end = 0 if total == 0 else min(skip + lim, total) - 1
    response.headers["X-Total-Count"] = str(total)
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count, Content-Range"

    return data


# ======================
# Ranking de Clientes
# ======================
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

