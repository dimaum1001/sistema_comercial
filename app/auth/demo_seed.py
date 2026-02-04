import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict

from sqlalchemy import func, text

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.models import (
    Categoria,
    Cliente,
    ContaPagar,
    Endereco,
    EnderecoFornecedor,
    Fornecedor,
    Pagamento,
    PrecoProduto,
    Produto,
    UnidadeMedida,
    Usuario,
    Venda,
    VendaItem,
)


logger = logging.getLogger(__name__)
DEMO_PREFIX = "[DEMO]"

_CODE_QUERIES = {
    "cliente": text(
        "SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_cliente, '\\D', '', 'g') AS INTEGER)), 0) FROM clientes"
    ),
    "fornecedor": text(
        "SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_fornecedor, '\\D', '', 'g') AS INTEGER)), 0) FROM fornecedores"
    ),
    "produto": text(
        "SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_produto, '\\D', '', 'g') AS INTEGER)), 0) FROM produtos"
    ),
}


def _dec(value: float) -> Decimal:
    return Decimal(str(value))


def _next_numeric_code(db, key: str, largura: int = 6) -> str:
    atual = int(db.execute(_CODE_QUERIES[key]).scalar() or 0)
    return f"{atual + 1:0{largura}d}"


def _ensure_unique_document(db, model, column_name: str, desired: str) -> str:
    value = desired
    base = desired[:-2] if len(desired) > 2 else desired
    for idx in range(1, 100):
        exists = db.query(model).filter(getattr(model, column_name) == value).first()
        if not exists:
            return value
        value = f"{base}{idx:02d}"[-len(desired):]
    tail = str(int(datetime.utcnow().timestamp()))[-len(desired):]
    return tail.zfill(len(desired))


def _upsert_unidades(db) -> Dict[str, UnidadeMedida]:
    seeds = [
        {"nome": "Unidade", "sigla": "UN", "permite_decimal": False},
        {"nome": "Quilograma", "sigla": "KG", "permite_decimal": True},
        {"nome": "Caixa", "sigla": "CX", "permite_decimal": False},
    ]
    result = {}
    for item in seeds:
        unidade = (
            db.query(UnidadeMedida)
            .filter(func.lower(UnidadeMedida.sigla) == item["sigla"].lower())
            .first()
        )
        if not unidade:
            unidade = UnidadeMedida(**item)
            db.add(unidade)
            db.flush()
        else:
            unidade.nome = item["nome"]
            unidade.permite_decimal = item["permite_decimal"]
        result[item["sigla"]] = unidade
    return result


def _upsert_categorias(db) -> Dict[str, Categoria]:
    nomes = [
        f"{DEMO_PREFIX} Mercearia",
        f"{DEMO_PREFIX} Bebidas",
        f"{DEMO_PREFIX} Limpeza",
    ]
    result = {}
    for nome in nomes:
        categoria = db.query(Categoria).filter(Categoria.nome == nome).first()
        if not categoria:
            categoria = Categoria(nome=nome)
            db.add(categoria)
            db.flush()
        result[nome] = categoria
    return result


def _upsert_fornecedores(db) -> Dict[str, Fornecedor]:
    seeds = [
        {
            "email": "demo-fornecedor-1@example.com",
            "razao_social": f"Distribuidora Aurora {DEMO_PREFIX}",
            "nome": f"Aurora {DEMO_PREFIX}",
            "cnpj_cpf": "10000000000001",
            "telefone": "11999990001",
            "contato_nome": "Paula Costa",
            "cidade": "Sao Paulo",
            "estado": "SP",
        },
        {
            "email": "demo-fornecedor-2@example.com",
            "razao_social": f"Atacado Vale Verde {DEMO_PREFIX}",
            "nome": f"Vale Verde {DEMO_PREFIX}",
            "cnpj_cpf": "10000000000002",
            "telefone": "11999990002",
            "contato_nome": "Marcos Lima",
            "cidade": "Campinas",
            "estado": "SP",
        },
        {
            "email": "demo-fornecedor-3@example.com",
            "razao_social": f"Casa da Limpeza {DEMO_PREFIX}",
            "nome": f"Limpeza Plus {DEMO_PREFIX}",
            "cnpj_cpf": "10000000000003",
            "telefone": "11999990003",
            "contato_nome": "Ana Pereira",
            "cidade": "Guarulhos",
            "estado": "SP",
        },
    ]

    result = {}
    for item in seeds:
        fornecedor = (
            db.query(Fornecedor)
            .filter(func.lower(Fornecedor.email) == item["email"].lower())
            .first()
        )
        if not fornecedor:
            cnpj_cpf = _ensure_unique_document(db, Fornecedor, "cnpj_cpf", item["cnpj_cpf"])
            fornecedor = Fornecedor(
                codigo_fornecedor=_next_numeric_code(db, "fornecedor"),
                tipo_pessoa="J",
                razao_social=item["razao_social"],
                nome=item["nome"],
                cnpj_cpf=cnpj_cpf,
                telefone=item["telefone"],
                email=item["email"],
                contato_nome=item["contato_nome"],
                contato_email=item["email"],
                contato_telefone=item["telefone"],
                base_legal_tratamento="execucao_contrato",
            )
            db.add(fornecedor)
            db.flush()
        else:
            fornecedor.razao_social = item["razao_social"]
            fornecedor.nome = item["nome"]
            fornecedor.telefone = item["telefone"]
            fornecedor.contato_nome = item["contato_nome"]
            fornecedor.contato_email = item["email"]
            fornecedor.contato_telefone = item["telefone"]

        endereco_demo = (
            db.query(EnderecoFornecedor)
            .filter(
                EnderecoFornecedor.fornecedor_id == fornecedor.id,
                EnderecoFornecedor.logradouro == f"Avenida Comercial {DEMO_PREFIX}",
            )
            .first()
        )
        if not endereco_demo:
            db.add(
                EnderecoFornecedor(
                    fornecedor_id=fornecedor.id,
                    tipo_endereco="comercial",
                    logradouro=f"Avenida Comercial {DEMO_PREFIX}",
                    numero="100",
                    bairro="Centro",
                    cidade=item["cidade"],
                    estado=item["estado"],
                    cep="01001000",
                    pais="Brasil",
                )
            )

        result[item["email"]] = fornecedor
    return result


def _upsert_clientes(db) -> Dict[str, Cliente]:
    seeds = [
        {
            "email": "demo-cliente-1@example.com",
            "nome": f"Mercadinho Bela Vista {DEMO_PREFIX}",
            "tipo_pessoa": "J",
            "cpf_cnpj": "20000000000001",
            "telefone": "11988880001",
            "cidade": "Sao Paulo",
            "estado": "SP",
        },
        {
            "email": "demo-cliente-2@example.com",
            "nome": f"Padaria Central {DEMO_PREFIX}",
            "tipo_pessoa": "J",
            "cpf_cnpj": "20000000000002",
            "telefone": "11988880002",
            "cidade": "Santo Andre",
            "estado": "SP",
        },
        {
            "email": "demo-cliente-3@example.com",
            "nome": f"Ana Martins {DEMO_PREFIX}",
            "tipo_pessoa": "F",
            "cpf_cnpj": "12345678901",
            "telefone": "11988880003",
            "cidade": "Sao Bernardo do Campo",
            "estado": "SP",
        },
    ]

    result = {}
    for item in seeds:
        cliente = (
            db.query(Cliente)
            .filter(func.lower(Cliente.email) == item["email"].lower())
            .first()
        )
        if not cliente:
            cpf_cnpj = _ensure_unique_document(db, Cliente, "cpf_cnpj", item["cpf_cnpj"])
            cliente = Cliente(
                codigo_cliente=_next_numeric_code(db, "cliente"),
                nome=item["nome"],
                tipo_pessoa=item["tipo_pessoa"],
                cpf_cnpj=cpf_cnpj,
                telefone=item["telefone"],
                email=item["email"],
                base_legal_tratamento="execucao_contrato",
            )
            db.add(cliente)
            db.flush()
        else:
            cliente.nome = item["nome"]
            cliente.telefone = item["telefone"]

        endereco_demo = (
            db.query(Endereco)
            .filter(
                Endereco.cliente_id == cliente.id,
                Endereco.logradouro == f"Rua Cliente {DEMO_PREFIX}",
            )
            .first()
        )
        if not endereco_demo:
            db.add(
                Endereco(
                    cliente_id=cliente.id,
                    tipo_endereco="comercial",
                    logradouro=f"Rua Cliente {DEMO_PREFIX}",
                    numero="200",
                    bairro="Centro",
                    cidade=item["cidade"],
                    estado=item["estado"],
                    cep="01002000",
                    pais="Brasil",
                )
            )

        result[item["email"]] = cliente
    return result


def _upsert_produtos(db, unidades, categorias, fornecedores) -> Dict[str, Produto]:
    seeds = [
        {
            "nome": f"{DEMO_PREFIX} Cafe Torrado 500g",
            "categoria": f"{DEMO_PREFIX} Mercearia",
            "fornecedor_email": "demo-fornecedor-1@example.com",
            "unidade_sigla": "UN",
            "estoque": 45,
            "estoque_minimo": 10,
            "custo": 12.5,
            "preco": 18.9,
            "marca": "Sabor Real",
        },
        {
            "nome": f"{DEMO_PREFIX} Acucar Cristal 1kg",
            "categoria": f"{DEMO_PREFIX} Mercearia",
            "fornecedor_email": "demo-fornecedor-1@example.com",
            "unidade_sigla": "KG",
            "estoque": 60,
            "estoque_minimo": 12,
            "custo": 3.8,
            "preco": 6.4,
            "marca": "Doce Lar",
        },
        {
            "nome": f"{DEMO_PREFIX} Refrigerante Cola 2L",
            "categoria": f"{DEMO_PREFIX} Bebidas",
            "fornecedor_email": "demo-fornecedor-2@example.com",
            "unidade_sigla": "UN",
            "estoque": 70,
            "estoque_minimo": 20,
            "custo": 5.1,
            "preco": 8.9,
            "marca": "Refri Max",
        },
        {
            "nome": f"{DEMO_PREFIX} Agua Mineral 500ml",
            "categoria": f"{DEMO_PREFIX} Bebidas",
            "fornecedor_email": "demo-fornecedor-2@example.com",
            "unidade_sigla": "UN",
            "estoque": 120,
            "estoque_minimo": 30,
            "custo": 1.1,
            "preco": 2.5,
            "marca": "Fonte Azul",
        },
        {
            "nome": f"{DEMO_PREFIX} Detergente Neutro 500ml",
            "categoria": f"{DEMO_PREFIX} Limpeza",
            "fornecedor_email": "demo-fornecedor-3@example.com",
            "unidade_sigla": "UN",
            "estoque": 28,
            "estoque_minimo": 15,
            "custo": 2.9,
            "preco": 4.9,
            "marca": "Brilho Bom",
        },
        {
            "nome": f"{DEMO_PREFIX} Papel Toalha c/2",
            "categoria": f"{DEMO_PREFIX} Limpeza",
            "fornecedor_email": "demo-fornecedor-3@example.com",
            "unidade_sigla": "CX",
            "estoque": 16,
            "estoque_minimo": 8,
            "custo": 5.2,
            "preco": 8.7,
            "marca": "Casa Limpa",
        },
    ]

    result = {}
    for item in seeds:
        produto = db.query(Produto).filter(Produto.nome == item["nome"]).first()
        if not produto:
            produto = Produto(
                codigo_produto=_next_numeric_code(db, "produto"),
                nome=item["nome"],
                categoria_id=categorias[item["categoria"]].id,
                fornecedor_id=fornecedores[item["fornecedor_email"]].id,
                unidade_id=unidades[item["unidade_sigla"]].id,
                estoque=_dec(item["estoque"]),
                estoque_minimo=item["estoque_minimo"],
                custo=_dec(item["custo"]),
                custo_medio=_dec(item["custo"]),
                preco_venda=_dec(item["preco"]),
                marca=item["marca"],
                localizacao=f"Gondola {DEMO_PREFIX}",
                ativo=True,
            )
            db.add(produto)
            db.flush()
        else:
            produto.categoria_id = categorias[item["categoria"]].id
            produto.fornecedor_id = fornecedores[item["fornecedor_email"]].id
            produto.unidade_id = unidades[item["unidade_sigla"]].id
            produto.estoque = _dec(item["estoque"])
            produto.estoque_minimo = item["estoque_minimo"]
            produto.custo = _dec(item["custo"])
            produto.custo_medio = _dec(item["custo"])
            produto.preco_venda = _dec(item["preco"])
            produto.marca = item["marca"]
            produto.ativo = True

        preco_ativo = (
            db.query(PrecoProduto)
            .filter(PrecoProduto.produto_id == produto.id, PrecoProduto.ativo.is_(True))
            .order_by(PrecoProduto.data_inicio.desc())
            .first()
        )
        if not preco_ativo:
            db.add(
                PrecoProduto(
                    produto_id=produto.id,
                    preco=_dec(item["preco"]),
                    ativo=True,
                )
            )
        else:
            preco_ativo.preco = _dec(item["preco"])
            produto.preco_venda = _dec(item["preco"])

        result[item["nome"]] = produto
    return result


def _upsert_contas_pagar(db, fornecedores) -> None:
    now = datetime.utcnow()
    inicio_mes_atual = datetime(now.year, now.month, 1)
    inicio_mes_passado = (inicio_mes_atual - timedelta(days=1)).replace(day=1)

    seeds = [
        {
            "descricao": f"{DEMO_PREFIX} Reposicao de bebidas",
            "fornecedor_email": "demo-fornecedor-2@example.com",
            "valor": 850.0,
            "status": "pendente",
            "data_vencimento": (inicio_mes_atual + timedelta(days=20)).date(),
        },
        {
            "descricao": f"{DEMO_PREFIX} Compra de limpeza",
            "fornecedor_email": "demo-fornecedor-3@example.com",
            "valor": 420.0,
            "status": "pendente",
            "data_vencimento": (inicio_mes_passado + timedelta(days=20)).date(),
        },
    ]

    for item in seeds:
        conta = (
            db.query(ContaPagar)
            .filter(ContaPagar.descricao == item["descricao"])
            .first()
        )
        if not conta:
            conta = ContaPagar(
                fornecedor_id=fornecedores[item["fornecedor_email"]].id,
                descricao=item["descricao"],
                valor=_dec(item["valor"]),
                data_vencimento=item["data_vencimento"],
                status=item["status"],
            )
            db.add(conta)
        else:
            conta.fornecedor_id = fornecedores[item["fornecedor_email"]].id
            conta.valor = _dec(item["valor"])
            conta.data_vencimento = item["data_vencimento"]
            conta.status = item["status"]


def _upsert_vendas(db, clientes, produtos) -> None:
    now = datetime.utcnow()
    inicio_mes_atual = datetime(now.year, now.month, 1, 10, 0, 0)
    inicio_mes_passado = (inicio_mes_atual - timedelta(days=1)).replace(day=1, hour=10)

    demo_user_email = str(settings.DEMO_ACCOUNT_EMAIL or "").strip().lower()
    demo_user = db.query(Usuario).filter(func.lower(Usuario.email) == demo_user_email).first()
    demo_user_id = demo_user.id if demo_user else None

    seeds = [
        {
            "observacao": f"{DEMO_PREFIX} Venda mes passado",
            "cliente_email": "demo-cliente-1@example.com",
            "data_venda": inicio_mes_passado + timedelta(days=5),
            "forma_pagamento": "pix",
            "itens": [
                (f"{DEMO_PREFIX} Cafe Torrado 500g", 3, 18.9),
                (f"{DEMO_PREFIX} Refrigerante Cola 2L", 4, 8.9),
            ],
        },
        {
            "observacao": f"{DEMO_PREFIX} Venda atual 01",
            "cliente_email": "demo-cliente-2@example.com",
            "data_venda": inicio_mes_atual + timedelta(days=4),
            "forma_pagamento": "cartao",
            "itens": [
                (f"{DEMO_PREFIX} Acucar Cristal 1kg", 8, 6.4),
                (f"{DEMO_PREFIX} Agua Mineral 500ml", 12, 2.5),
            ],
        },
        {
            "observacao": f"{DEMO_PREFIX} Venda atual 02",
            "cliente_email": "demo-cliente-3@example.com",
            "data_venda": inicio_mes_atual + timedelta(days=10),
            "forma_pagamento": "dinheiro",
            "itens": [
                (f"{DEMO_PREFIX} Detergente Neutro 500ml", 6, 4.9),
                (f"{DEMO_PREFIX} Papel Toalha c/2", 5, 8.7),
            ],
        },
    ]

    for item in seeds:
        total = sum(_dec(qtd) * _dec(preco) for _, qtd, preco in item["itens"])
        venda = db.query(Venda).filter(Venda.observacao == item["observacao"]).first()
        if not venda:
            venda = Venda(
                cliente_id=clientes[item["cliente_email"]].id,
                usuario_id=demo_user_id,
                data_venda=item["data_venda"],
                total=total,
                forma_pagamento=item["forma_pagamento"],
                status="concluida",
                desconto=_dec(0),
                acrescimo=_dec(0),
                observacao=item["observacao"],
            )
            db.add(venda)
            db.flush()
        else:
            venda.cliente_id = clientes[item["cliente_email"]].id
            venda.usuario_id = demo_user_id
            venda.data_venda = item["data_venda"]
            venda.total = total
            venda.forma_pagamento = item["forma_pagamento"]
            venda.status = "concluida"

            db.query(VendaItem).filter(VendaItem.venda_id == venda.id).delete(synchronize_session=False)
            db.query(Pagamento).filter(Pagamento.venda_id == venda.id).delete(synchronize_session=False)

        for produto_nome, qtd, preco in item["itens"]:
            db.add(
                VendaItem(
                    venda_id=venda.id,
                    produto_id=produtos[produto_nome].id,
                    quantidade=_dec(qtd),
                    preco_unit=_dec(preco),
                )
            )

        db.add(
            Pagamento(
                venda_id=venda.id,
                forma_pagamento=item["forma_pagamento"],
                valor=total,
                status="pago",
                data_pagamento=item["data_venda"],
                data_vencimento=item["data_venda"].date(),
                observacao=f"{DEMO_PREFIX} Pagamento automatico",
            )
        )


def ensure_demo_seed_data() -> None:
    """Cria/atualiza um conjunto de dados ficticios para uso em conta demo."""
    if not settings.DEMO_SEED_DATA_ENABLED:
        return

    db = SessionLocal()
    try:
        unidades = _upsert_unidades(db)
        categorias = _upsert_categorias(db)
        fornecedores = _upsert_fornecedores(db)
        clientes = _upsert_clientes(db)
        produtos = _upsert_produtos(db, unidades, categorias, fornecedores)
        _upsert_contas_pagar(db, fornecedores)
        _upsert_vendas(db, clientes, produtos)
        db.commit()
        logger.info("Dados demo verificados e prontos para uso.")
    except Exception:
        db.rollback()
        logger.exception("Falha ao preparar dados ficticios da conta demo.")
        raise
    finally:
        db.close()
