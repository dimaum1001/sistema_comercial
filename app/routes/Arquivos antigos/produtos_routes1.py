from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db, SessionLocal
from app.models.models import Produto, PrecoProduto
from app.schemas.produto_schema import ProdutoCreate, ProdutoOut, ProdutoUpdate
from typing import List
from uuid import UUID
from datetime import datetime

router = APIRouter()


# -------------------------------------------------------------------
# Utilitário: gerar próximo código (numérico zero-padded, largura=6)
# -------------------------------------------------------------------
def gerar_proximo_codigo_produto(db: Session, largura: int = 6) -> str:
    """
    Gera um codigo_produto sequencial numérico com zero-padding.
    Ex.: 000001, 000002, 000003 ...

    Observação:
    - Não usa prefixo; a máscara visual 'PROD-000001' pode ser feita na UI.
    - Em alto volume/concorRência, considere sequence/trigger no Postgres.
    """
    # Extrai apenas os dígitos (considerando que alguns registros antigos podem ter vindo com prefixo)
    # e pega o maior número para incrementar.
    sql = text("""
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_produto, '\\D', '', 'g') AS INTEGER)), 0)
        FROM produtos
    """)
    atual = db.execute(sql).scalar() or 0
    proximo = atual + 1
    return f"{proximo:0{largura}d}"


# Dependência local opcional (não usada nos endpoints pois usamos get_db)
def get_db_local():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------------------------------------------------
# Criar produto
# -------------------------------------------------------------------
@router.post("/produtos", response_model=ProdutoOut)
def criar_produto(produto: ProdutoCreate, db: Session = Depends(get_db)):
    dados = produto.dict(exclude_unset=True)

    # Garante codigo_produto pois a coluna é NOT NULL e UNIQUE
    codigo = dados.get("codigo_produto")
    if not codigo or not str(codigo).strip():
        dados["codigo_produto"] = gerar_proximo_codigo_produto(db)

    novo_produto = Produto(**dados)
    db.add(novo_produto)

    try:
        # Flush para obter ID antes de criar o preço
        db.flush()
    except IntegrityError as e:
        db.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="codigo_produto já existente. Tente novamente.")
        raise HTTPException(status_code=400, detail="Erro ao criar produto.")

    # Cria o preço inicial, se enviado
    if produto.preco_venda is not None:
        preco_inicial = PrecoProduto(
            produto_id=novo_produto.id,
            preco=produto.preco_venda,
            ativo=True
        )
        db.add(preco_inicial)
        # Atualiza o cache do preço no próprio produto
        novo_produto.preco_venda = produto.preco_venda

    db.commit()
    db.refresh(novo_produto)
    # Pré-carrega relacionamentos úteis
    _ = novo_produto.precos
    return novo_produto


# -------------------------------------------------------------------
# Listar produtos
# -------------------------------------------------------------------
@router.get("/produtos", response_model=List[ProdutoOut])
def listar_produtos(db: Session = Depends(get_db)):
    produtos = db.query(Produto).all()
    # Pré-carrega histórico de preços (se precisar exibir)
    for p in produtos:
        _ = p.precos
    return produtos


# -------------------------------------------------------------------
# Buscar produto por ID
# -------------------------------------------------------------------
@router.get("/produtos/{produto_id}", response_model=ProdutoOut)
def buscar_produto(produto_id: UUID, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    _ = produto.precos
    return produto


# -------------------------------------------------------------------
# Atualizar produto
# -------------------------------------------------------------------
@router.put("/produtos/{produto_id}", response_model=ProdutoOut)
def atualizar_produto(produto_id: UUID, produto_update: ProdutoUpdate, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    dados_update = produto_update.dict(exclude_unset=True)

    # Se veio preco_venda novo e diferente, encerra o preço ativo e cria novo
    if "preco_venda" in dados_update and dados_update["preco_venda"] is not None:
        if dados_update["preco_venda"] != produto.preco_venda:
            preco_ativo = db.query(PrecoProduto).filter(
                PrecoProduto.produto_id == produto.id,
                PrecoProduto.ativo == True
            ).first()
            if preco_ativo:
                preco_ativo.ativo = False
                preco_ativo.data_fim = datetime.utcnow()
                db.add(preco_ativo)

            novo_preco = PrecoProduto(
                produto_id=produto.id,
                preco=dados_update["preco_venda"],
                ativo=True
            )
            db.add(novo_preco)
            produto.preco_venda = dados_update["preco_venda"]

    # Não permitir apagar codigo_produto (coluna NOT NULL)
    if "codigo_produto" in dados_update:
        val = (dados_update["codigo_produto"] or "").strip()
        if not val:
            dados_update.pop("codigo_produto", None)

    # Aplica demais campos
    for key, value in dados_update.items():
        setattr(produto, key, value)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="codigo_produto já existente.")
        raise HTTPException(status_code=400, detail="Erro ao atualizar produto.")

    db.refresh(produto)
    _ = produto.precos
    return produto


# -------------------------------------------------------------------
# Deletar produto
# -------------------------------------------------------------------
@router.delete("/produtos/{produto_id}", status_code=204)
def deletar_produto(produto_id: UUID, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    db.delete(produto)
    db.commit()
    return {"detail": "Produto excluído com sucesso"}
