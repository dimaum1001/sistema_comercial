"""



Rotas para gerenciamento de vendas e seus itens/pagamentos.







Fornece endpoint para criaÃÂ§ÃÂ£o de vendas com atualizaÃÂ§ÃÂ£o de estoque, cÃÂ¡lculo de



total, geraÃÂ§ÃÂ£o de parcelas e registro de saldo pendente. Permite ainda



consultar uma venda especÃÂ­fica e listar vendas com paginaÃÂ§ÃÂ£o. A listagem



traz itens, cliente e pagamentos relacionados.



"""







from fastapi import APIRouter, Depends, HTTPException



from sqlalchemy.orm import Session



from typing import List



from uuid import UUID



from datetime import datetime, timedelta



from decimal import Decimal, ROUND_HALF_UP



from decimal import Decimal, ROUND_HALF_UP







from app.db.database import get_db



from app.auth.deps import get_current_user



from app.models.models import Venda, VendaItem, Produto, Pagamento, PrecoProduto



from app.schemas.venda_schema import VendaCreate, VendaResponse











router = APIRouter(dependencies=[Depends(get_current_user)])







CENT = Decimal("0.01")



QTD = Decimal("0.001")











def _dec(value, default="0") -> Decimal:



    if value is None:



        return Decimal(default)



    if isinstance(value, Decimal):



        return value



    return Decimal(str(value))











def _money(value: Decimal) -> Decimal:



    return value.quantize(CENT, rounding=ROUND_HALF_UP)











def _qty(value: Decimal) -> Decimal:



    return value.quantize(QTD, rounding=ROUND_HALF_UP)











@router.post("/vendas", response_model=VendaResponse)



def criar_venda(payload: VendaCreate, db: Session = Depends(get_db)) -> Venda:



    """Cria uma nova venda com itens e pagamentos associados."""



    try:



        total_venda = Decimal("0")







        data_venda_local = datetime.now()















        nova_venda = Venda(







            cliente_id=payload.cliente_id,







            usuario_id=None,  # posteriormente pode usar usuário autenticado







            desconto=float(payload.desconto or 0),







            acrescimo=float(payload.acrescimo or 0),







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







                raise HTTPException(status_code=404, detail=f"Produto {item.produto_id} não encontrado")















            estoque_atual = _qty(_dec(produto.estoque, "0"))







            quantidade = _qty(_dec(item.quantidade))







            if quantidade <= 0:







                raise HTTPException(status_code=400, detail="Quantidade invalida")







            if estoque_atual < quantidade:







                raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {produto.nome}")















            preco_ativo = db.query(PrecoProduto).filter(







                PrecoProduto.produto_id == produto.id,







                PrecoProduto.ativo.is_(True)







            ).order_by(PrecoProduto.data_inicio.desc()).first()







            if not preco_ativo:







                raise HTTPException(status_code=400, detail=f"Produto {produto.nome} não possui preço ativo")















            preco_base = item.preco_unit if item.preco_unit is not None else preco_ativo.preco







            preco_unit = _money(_dec(preco_base, "0"))







            subtotal = _money(preco_unit * quantidade)







            total_venda += subtotal















            produto.estoque = _qty(estoque_atual - quantidade)















            db.add(VendaItem(







                venda_id=nova_venda.id,







                produto_id=produto.id,







                quantidade=quantidade,







                preco_unit=preco_unit







            ))















        # aplica desconto/acréscimo



        desconto_decimal = _money(_dec(payload.desconto or 0))



        acrescimo_decimal = _money(_dec(payload.acrescimo or 0))



        nova_venda.total = _money(total_venda - desconto_decimal + acrescimo_decimal)







        # Pagamentos (baixa automática + saldo pendente)



        total_pago = Decimal("0")



        if payload.pagamentos:



            for pag in payload.pagamentos:



                qtd_parcelas = getattr(pag, "parcela_total", 1) or 1



                valor_total_pag = _money(_dec(pag.valor or 0))



                acumulado = Decimal("0")



                for i in range(qtd_parcelas):



                    vencimento = None



                    if pag.data_vencimento:



                        vencimento = pag.data_vencimento + timedelta(days=30 * i)



                    if qtd_parcelas > 1:



                        if i < qtd_parcelas - 1:



                            valor_parcela = _money(valor_total_pag / qtd_parcelas)



                            acumulado += valor_parcela



                        else:



                            valor_parcela = _money(valor_total_pag - acumulado)



                    else:



                        valor_parcela = valor_total_pag



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



        saldo_restante = _money(_dec(nova_venda.total) - total_pago)



        if saldo_restante > Decimal("0"):



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



        # forÃÂ§a carregamento de relacionamentos



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



    """ObtÃÂ©m os dados completos de uma venda pelo seu ID."""



    venda = db.query(Venda).filter(Venda.id == venda_id).first()



    if not venda:



        raise HTTPException(status_code=404, detail="Venda nÃÂ£o encontrada")



    _ = venda.itens



    _ = venda.cliente



    _ = venda.pagamentos



    return venda











@router.get("/vendas", response_model=List[VendaResponse])



def listar_vendas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[Venda]:



    """Lista vendas com paginaÃÂ§ÃÂ£o, ordenadas pela data de venda decrescente."""



    vendas = db.query(Venda).order_by(Venda.data_venda.desc()).offset(skip).limit(limit).all()



    for v in vendas:



        _ = v.itens



        _ = v.cliente



        _ = v.pagamentos



    return vendas



