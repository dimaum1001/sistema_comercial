from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import SessionLocal
from app.models.models import Cliente, Produto, Venda

router = APIRouter(dependencies=[Depends(get_current_user)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/dashboard/resumo")
def get_dashboard_resumo(db: Session = Depends(get_db)):
    # Datas de referÃªncia em UTC para evitar problemas de fuso horÃ¡rio
    hoje = datetime.utcnow()
    inicio_mes_atual = datetime(hoje.year, hoje.month, 1)

    # Primeiro dia do prÃ³ximo mÃªs
    if hoje.month == 12:
        inicio_proximo_mes = datetime(hoje.year + 1, 1, 1)
    else:
        inicio_proximo_mes = datetime(hoje.year, hoje.month + 1, 1)

    # Primeiro dia do mÃªs passado
    if inicio_mes_atual.month == 1:
        inicio_mes_passado = datetime(inicio_mes_atual.year - 1, 12, 1)
    else:
        inicio_mes_passado = datetime(inicio_mes_atual.year, inicio_mes_atual.month - 1, 1)

    # Totais absolutos (base atual)
    total_clientes = db.query(func.count(Cliente.id)).scalar() or 0
    total_produtos = db.query(func.count(Produto.id)).scalar() or 0

    # Novos registros do mÃªs atual vs. mÃªs passado (para percentuais e texto)
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

    return {
        "total_clientes": int(total_clientes),
        "total_produtos": int(total_produtos),
        "total_vendas": float(vendas_mes_atual),
        "perc_clientes": perc_clientes,
        "txt_clientes": f"{format_percent(perc_clientes)} em relaÃ§Ã£o ao mÃªs passado",
        "perc_produtos": perc_produtos,
        "txt_produtos": f"{format_percent(perc_produtos)} em relaÃ§Ã£o ao mÃªs passado",
        "perc_vendas": perc_vendas,
        "txt_vendas": f"{format_percent(perc_vendas)} em relaÃ§Ã£o ao mÃªs passado",
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
