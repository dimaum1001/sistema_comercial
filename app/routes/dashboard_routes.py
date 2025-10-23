from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import SessionLocal
from app.models.models import Cliente, Produto, Venda, ContaPagar, VendaItem, UnidadeMedida

router = APIRouter(dependencies=[Depends(get_current_user)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/dashboard/resumo")
def get_dashboard_resumo(db: Session = Depends(get_db)):
    """Resumo geral do dashboard, incluindo contas a pagar."""
    # Datas em UTC para evitar problemas de fuso horario
    hoje = datetime.utcnow()
    inicio_mes_atual = datetime(hoje.year, hoje.month, 1)

    # Primeiro dia do proximo mes
    if hoje.month == 12:
        inicio_proximo_mes = datetime(hoje.year + 1, 1, 1)
    else:
        inicio_proximo_mes = datetime(hoje.year, hoje.month + 1, 1)

    # Primeiro dia do mes passado
    if inicio_mes_atual.month == 1:
        inicio_mes_passado = datetime(inicio_mes_atual.year - 1, 12, 1)
    else:
        inicio_mes_passado = datetime(inicio_mes_atual.year, inicio_mes_atual.month - 1, 1)

    inicio_mes_atual_date = inicio_mes_atual.date()
    inicio_proximo_mes_date = inicio_proximo_mes.date()
    inicio_mes_passado_date = inicio_mes_passado.date()

    # Totais absolutos (base atual)
    total_clientes = db.query(func.count(Cliente.id)).scalar() or 0
    total_produtos = db.query(func.count(Produto.id)).scalar() or 0

    # Novos registros do mes atual vs. mes passado (para percentuais e texto)
    novos_clientes_mes = (
        db.query(func.count(Cliente.id))
        .filter(Cliente.criado_em >= inicio_mes_atual, Cliente.criado_em < inicio_proximo_mes)
        .scalar()
        or 0
    )
    novos_clientes_mes_passado = (
        db.query(func.count(Cliente.id))
        .filter(Cliente.criado_em >= inicio_mes_passado, Cliente.criado_em < inicio_mes_atual)
        .scalar()
        or 0
    )
    perc_clientes = calcular_variacao(novos_clientes_mes, novos_clientes_mes_passado)

    novos_produtos_mes = (
        db.query(func.count(Produto.id))
        .filter(Produto.criado_em >= inicio_mes_atual, Produto.criado_em < inicio_proximo_mes)
        .scalar()
        or 0
    )
    novos_produtos_mes_passado = (
        db.query(func.count(Produto.id))
        .filter(Produto.criado_em >= inicio_mes_passado, Produto.criado_em < inicio_mes_atual)
        .scalar()
        or 0
    )
    perc_produtos = calcular_variacao(novos_produtos_mes, novos_produtos_mes_passado)

    vendas_mes_atual = (
        db.query(func.coalesce(func.sum(Venda.total), 0))
        .filter(Venda.data_venda >= inicio_mes_atual, Venda.data_venda < inicio_proximo_mes)
        .scalar()
        or 0
    )
    vendas_mes_passado = (
        db.query(func.coalesce(func.sum(Venda.total), 0))
        .filter(Venda.data_venda >= inicio_mes_passado, Venda.data_venda < inicio_mes_atual)
        .scalar()
        or 0
    )
    perc_vendas = calcular_variacao(vendas_mes_atual, vendas_mes_passado)

    status_nao_pago = func.lower(func.coalesce(ContaPagar.status, "")) != "paga"

    # Totais de contas a pagar (pendentes em geral e por mes)
    total_contas_pagar = (
        db.query(func.coalesce(func.sum(ContaPagar.valor), 0))
        .filter(status_nao_pago)
        .scalar()
        or 0
    )

    contas_pagar_mes_atual = (
        db.query(func.coalesce(func.sum(ContaPagar.valor), 0))
        .filter(
            status_nao_pago,
            ContaPagar.data_vencimento >= inicio_mes_atual_date,
            ContaPagar.data_vencimento < inicio_proximo_mes_date,
        )
        .scalar()
        or 0
    )

    contas_pagar_mes_passado = (
        db.query(func.coalesce(func.sum(ContaPagar.valor), 0))
        .filter(
            status_nao_pago,
            ContaPagar.data_vencimento >= inicio_mes_passado_date,
            ContaPagar.data_vencimento < inicio_mes_atual_date,
        )
        .scalar()
        or 0
    )
    perc_contas_pagar = calcular_variacao(contas_pagar_mes_atual, contas_pagar_mes_passado)

    # --- Indicadores adicionais ---
    periodo_relatorios = hoje - timedelta(days=90)
    custo_base = func.coalesce(Produto.custo_medio, Produto.custo, 0)

    lucro_mes_atual = (
        db.query(func.coalesce(func.sum((VendaItem.preco_unit - custo_base) * VendaItem.quantidade), 0))
        .select_from(VendaItem)
        .join(Venda, Venda.id == VendaItem.venda_id)
        .join(Produto, Produto.id == VendaItem.produto_id)
        .filter(Venda.data_venda >= inicio_mes_atual, Venda.data_venda < inicio_proximo_mes)
        .scalar()
        or 0
    )

    vendas_qtd_mes_atual = (
        db.query(func.count(Venda.id))
        .filter(Venda.data_venda >= inicio_mes_atual, Venda.data_venda < inicio_proximo_mes)
        .scalar()
        or 0
    )
    ticket_medio = float(vendas_mes_atual) / vendas_qtd_mes_atual if vendas_qtd_mes_atual else 0.0

    faturamento_expr = func.sum(VendaItem.preco_unit * VendaItem.quantidade)
    custo_estimado_expr = func.sum(custo_base * VendaItem.quantidade)
    lucro_expr = func.sum((VendaItem.preco_unit - custo_base) * VendaItem.quantidade)

    top_produtos_rows = (
        db.query(
            Produto.id.label("produto_id"),
            Produto.nome.label("nome"),
            func.coalesce(func.sum(VendaItem.quantidade), 0).label("quantidade"),
            faturamento_expr.label("faturamento"),
            custo_estimado_expr.label("custo_estimado"),
            lucro_expr.label("lucro"),
        )
        .join(VendaItem, VendaItem.produto_id == Produto.id)
        .join(Venda, Venda.id == VendaItem.venda_id)
        .filter(Venda.data_venda >= periodo_relatorios)
        .group_by(Produto.id, Produto.nome)
        .order_by(lucro_expr.desc())
        .limit(5)
        .all()
    )

    top_clientes_rows = (
        db.query(
            Cliente.id.label("cliente_id"),
            func.coalesce(Cliente.nome, Cliente.codigo_cliente).label("nome"),
            func.count(Venda.id).label("quantidade_vendas"),
            func.coalesce(func.sum(Venda.total), 0).label("faturamento"),
        )
        .join(Venda, Venda.cliente_id == Cliente.id)
        .filter(Venda.data_venda >= periodo_relatorios)
        .group_by(Cliente.id, func.coalesce(Cliente.nome, Cliente.codigo_cliente))
        .order_by(func.coalesce(func.sum(Venda.total), 0).desc())
        .limit(5)
        .all()
    )

    estoque_critico_rows = (
        db.query(
            Produto.id.label("produto_id"),
            Produto.nome,
            Produto.estoque,
            Produto.estoque_minimo,
            UnidadeMedida.sigla.label("unidade"),
        )
        .outerjoin(UnidadeMedida, UnidadeMedida.id == Produto.unidade_id)
        .filter(
            func.coalesce(Produto.estoque_minimo, 0) > 0,
            Produto.estoque <= func.coalesce(Produto.estoque_minimo, 0),
        )
        .order_by(Produto.estoque.asc())
        .limit(5)
        .all()
    )

    def _to_float(value):
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0

    top_produtos = []
    for row in top_produtos_rows:
        faturamento = _to_float(row.faturamento)
        lucro = _to_float(row.lucro)
        custo_estimado = _to_float(row.custo_estimado)
        quantidade = _to_float(row.quantidade)
        margem = round((lucro / faturamento * 100) if faturamento else 0.0, 2)
        top_produtos.append(
            {
                "produto_id": str(row.produto_id),
                "nome": row.nome,
                "quantidade": quantidade,
                "faturamento": faturamento,
                "custo_estimado": custo_estimado,
                "lucro": lucro,
                "margem": margem,
            }
        )

    top_clientes = [
        {
            "cliente_id": str(row.cliente_id),
            "nome": row.nome,
            "faturamento": _to_float(row.faturamento),
            "vendas": int(row.quantidade_vendas or 0),
        }
        for row in top_clientes_rows
    ]

    estoque_critico = [
        {
            "produto_id": str(row.produto_id),
            "nome": row.nome,
            "estoque": _to_float(row.estoque),
            "estoque_minimo": _to_float(row.estoque_minimo),
            "unidade": row.unidade or "",
        }
        for row in estoque_critico_rows
    ]

    return {
        "total_clientes": int(total_clientes),
        "total_produtos": int(total_produtos),
        "total_vendas": float(vendas_mes_atual),
        "total_contas_pagar": float(total_contas_pagar),
        "perc_clientes": perc_clientes,
        "txt_clientes": f"{format_percent(perc_clientes)} em relacao ao mes passado",
        "perc_produtos": perc_produtos,
        "txt_produtos": f"{format_percent(perc_produtos)} em relacao ao mes passado",
        "perc_vendas": perc_vendas,
        "txt_vendas": f"{format_percent(perc_vendas)} em relacao ao mes passado",
        "perc_contas_pagar": perc_contas_pagar,
        "txt_contas_pagar": f"{format_percent(perc_contas_pagar)} em relacao ao mes passado",
        "lucro_mes": float(lucro_mes_atual),
        "ticket_medio": ticket_medio,
        "top_produtos_lucro": top_produtos,
        "top_clientes": top_clientes,
        "estoque_critico": estoque_critico,
    }
# ------------------ helpers ------------------

def calcular_variacao(valor_atual, valor_anterior):
    """Retorna a variaÃ§Ã£o percentual entre atual e anterior (duas casas)."""
    if not valor_anterior:
        return 0.0
    return round(((valor_atual - valor_anterior) / valor_anterior) * 100, 2)


def format_percent(valor):
    """Formata +x% / -x% / 0%."""
    if valor > 0:
        return f"+{valor}%"
    if valor < 0:
        return f"{valor}%"
    return "0%"
