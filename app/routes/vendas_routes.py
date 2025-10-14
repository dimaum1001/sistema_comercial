"""
Rotas para gerenciamento de vendas e seus itens/pagamentos.

Fornece endpoint para criaÃ§Ã£o de vendas com atualizaÃ§Ã£o de estoque, cÃ¡lculo de
total, geraÃ§Ã£o de parcelas e registro de saldo pendente. Permite ainda
consultar uma venda especÃ­fica e listar vendas com paginaÃ§Ã£o. A listagem
traz itens, cliente e pagamentos relacionados.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime, timedelta

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import Venda, VendaItem, Produto, Pagamento, PrecoProduto
from app.schemas.venda_schema import VendaCreate, VendaResponse


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/vendas", response_model=VendaResponse)
def criar_venda(payload: VendaCreate, db: Session = Depends(get_db)) -> Venda:
    """Cria uma nova venda com itens e pagamentos associados."""
    try:
        total_venda: float = 0.0
        data_venda_local = datetime.now()

        nova_venda = Venda(
            cliente_id=payload.cliente_id,
            usuario_id=None,  # posteriormente pode usar usuÃ¡rio autenticado
            desconto=payload.desconto,
            acrescimo=payload.acrescimo,
            observacao=payload.observacao,
            status="concluida",
            data_venda=data_venda_local
        )
        db.add(nova_venda)
        db.flush()

        # Itens da venda
        for item in payload.itens:
            produto = db.query(Produto).filter(Produto.id == item.produto_id).first()
            if not produto:
                raise HTTPException(status_code=404, detail=f"Produto {item.produto_id} nÃ£o encontrado")
            if produto.estoque is None:
                produto.estoque = 0
            if produto.estoque < item.quantidade:
                raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {produto.nome}")
            # busca preÃ§o ativo
            preco_ativo = db.query(PrecoProduto).filter(
                PrecoProduto.produto_id == produto.id,
                PrecoProduto.ativo == True
            ).order_by(PrecoProduto.data_inicio.desc()).first()
            if not preco_ativo:
                raise HTTPException(status_code=400, detail=f"Produto {produto.nome} nÃ£o possui preÃ§o ativo")
            preco_unit = float(item.preco_unit or preco_ativo.preco or 0)
            subtotal = preco_unit * int(item.quantidade)
            total_venda += subtotal
            produto.estoque = int(produto.estoque) - int(item.quantidade)
            db.add(VendaItem(
                venda_id=nova_venda.id,
                produto_id=produto.id,
                quantidade=int(item.quantidade),
                preco_unit=preco_unit
            ))

        # aplica desconto/acrÃ©scimo
        nova_venda.total = total_venda - float(payload.desconto or 0) + float(payload.acrescimo or 0)

        # Pagamentos (baixa automÃ¡tica + saldo pendente)
        total_pago: float = 0.0
        if payload.pagamentos:
            for pag in payload.pagamentos:
                qtd_parcelas = getattr(pag, "parcela_total", 1) or 1
                for i in range(qtd_parcelas):
                    vencimento = None
                    if pag.data_vencimento:
                        vencimento = pag.data_vencimento + timedelta(days=30 * i)
                    valor_parcela = float(pag.valor) / qtd_parcelas
                    total_pago += valor_parcela
                    db.add(Pagamento(
                        venda_id=nova_venda.id,
                        forma_pagamento=pag.forma_pagamento,
                        valor=valor_parcela,
                        status="pago",
                        data_pagamento=data_venda_local,
                        data_vencimento=vencimento,
                        parcela_numero=(i + 1) if qtd_parcelas > 1 else None,
                        parcela_total=qtd_parcelas if qtd_parcelas > 1 else None,
                        observacao=pag.observacao
                    ))

        # saldo pendente
        saldo_restante = float(nova_venda.total) - total_pago
        if saldo_restante > 0:
            db.add(Pagamento(
                venda_id=nova_venda.id,
                forma_pagamento="A Receber",
                valor=saldo_restante,
                status="pendente",
                data_vencimento=(data_venda_local + timedelta(days=30)).date(),
                observacao="Gerado automaticamente (saldo pendente)"
            ))

        db.commit()
        db.refresh(nova_venda)
        # forÃ§a carregamento de relacionamentos
        _ = nova_venda.itens
        _ = nova_venda.cliente
        _ = nova_venda.pagamentos
        return nova_venda
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao criar venda: {str(e)}")


@router.get("/vendas/{venda_id}", response_model=VendaResponse)
def obter_venda(venda_id: UUID, db: Session = Depends(get_db)) -> Venda:
    """ObtÃ©m os dados completos de uma venda pelo seu ID."""
    venda = db.query(Venda).filter(Venda.id == venda_id).first()
    if not venda:
        raise HTTPException(status_code=404, detail="Venda nÃ£o encontrada")
    _ = venda.itens
    _ = venda.cliente
    _ = venda.pagamentos
    return venda


@router.get("/vendas", response_model=List[VendaResponse])
def listar_vendas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[Venda]:
    """Lista vendas com paginaÃ§Ã£o, ordenadas pela data de venda decrescente."""
    vendas = db.query(Venda).order_by(Venda.data_venda.desc()).offset(skip).limit(limit).all()
    for v in vendas:
        _ = v.itens
        _ = v.cliente
        _ = v.pagamentos
    return vendas
