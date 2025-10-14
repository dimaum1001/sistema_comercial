from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import SessionLocal
from app.models.models import Cliente, Produto, Venda, ContaPagar

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
