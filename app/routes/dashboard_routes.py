from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.db.database import SessionLocal
from app.models.models import Cliente, Produto, Venda

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/dashboard/resumo")
def get_dashboard_resumo(db: Session = Depends(get_db)):
    # Datas de referência (UTC para evitar problemas de fuso)
    hoje = datetime.utcnow()
    inicio_mes_atual = datetime(hoje.year, hoje.month, 1)
    # primeiro dia do próximo mês
    if hoje.month == 12:
        inicio_proximo_mes = datetime(hoje.year + 1, 1, 1)
    else:
        inicio_proximo_mes = datetime(hoje.year, hoje.month + 1, 1)
    # primeiro dia do mês passado
    if inicio_mes_atual.month == 1:
        inicio_mes_passado = datetime(inicio_mes_atual.year - 1, 12, 1)
    else:
        inicio_mes_passado = datetime(inicio_mes_atual.year, inicio_mes_atual.month - 1, 1)

    # -------- Totais absolutos (base atual) --------
    total_clientes = db.query(func.count(Cliente.id)).scalar() or 0
    total_produtos = db.query(func.count(Produto.id)).scalar() or 0

    # -------- Novos no mês X mês passado (para % e texto) --------
    # Clientes (usa campo Cliente.criado_em)
    novos_clientes_mes = (
        db.query(func.count(Cliente.id))
        .filter(Cliente.criado_em >= inicio_mes_atual, Cliente.criado_em < inicio_proximo_mes)
        .scalar() or 0
    )
    novos_clientes_mes_passado = (
        db.query(func.count(Cliente.id))
        .filter(Cliente.criado_em >= inicio_mes_passado, Cliente.criado_em < inicio_mes_atual)
        .scalar() or 0
    )
    perc_clientes = calcular_variacao(novos_clientes_mes, novos_clientes_mes_passado)

    # Produtos (usa campo Produto.criado_em)
    novos_produtos_mes = (
        db.query(func.count(Produto.id))
        .filter(Produto.criado_em >= inicio_mes_atual, Produto.criado_em < inicio_proximo_mes)
        .scalar() or 0
    )
    novos_produtos_mes_passado = (
        db.query(func.count(Produto.id))
        .filter(Produto.criado_em >= inicio_mes_passado, Produto.criado_em < inicio_mes_atual)
        .scalar() or 0
    )
    perc_produtos = calcular_variacao(novos_produtos_mes, novos_produtos_mes_passado)

    # -------- Vendas: somatório do mês atual vs mês passado --------
    # IMPORTANTE: usa colunas 'data_venda' (timestamp) e 'total' (numeric)
    vendas_mes_atual = (
        db.query(func.coalesce(func.sum(Venda.total), 0))
        .filter(Venda.data_venda >= inicio_mes_atual, Venda.data_venda < inicio_proximo_mes)
        .scalar() or 0
    )
    vendas_mes_passado = (
        db.query(func.coalesce(func.sum(Venda.total), 0))
        .filter(Venda.data_venda >= inicio_mes_passado, Venda.data_venda < inicio_mes_atual)
        .scalar() or 0
    )
    perc_vendas = calcular_variacao(vendas_mes_atual, vendas_mes_passado)

    return {
        # valores principais dos cards
        "total_clientes": int(total_clientes),
        "total_produtos": int(total_produtos),
        "total_vendas": float(vendas_mes_atual),  # total do MÊS ATUAL

        # textos e percentuais prontos para exibir
        "perc_clientes": perc_clientes,
        "txt_clientes": f"{format_percent(perc_clientes)} em relação ao mês passado",

        "perc_produtos": perc_produtos,
        "txt_produtos": f"{format_percent(perc_produtos)} em relação ao mês passado",

        "perc_vendas": perc_vendas,
        "txt_vendas": f"{format_percent(perc_vendas)} em relação ao mês passado",
    }


# ------------------ helpers ------------------

def calcular_variacao(valor_atual, valor_anterior):
    """Retorna variação percentual entre atual e anterior (duas casas)."""
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
