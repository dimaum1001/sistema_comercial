from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, get_db
from app.models.models import Produto, PrecoProduto
from app.schemas.produto_schema import ProdutoCreate, ProdutoOut, ProdutoUpdate
from typing import List
from uuid import UUID
from datetime import datetime

router = APIRouter()

# Dependência para obter a sessão do banco
def get_db_local():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Criar produto
@router.post("/produtos", response_model=ProdutoOut)
def criar_produto(produto: ProdutoCreate, db: Session = Depends(get_db)):
    novo_produto = Produto(**produto.dict(exclude_unset=True))
    db.add(novo_produto)
    db.flush()

    # cria o preço inicial se enviado
    if produto.preco_venda is not None:
        preco_inicial = PrecoProduto(
            produto_id=novo_produto.id,
            preco=produto.preco_venda,
            ativo=True
        )
        db.add(preco_inicial)
        # atualiza preco_venda cache
        novo_produto.preco_venda = produto.preco_venda

    db.commit()
    db.refresh(novo_produto)
    return novo_produto

# Listar todos os produtos
@router.get("/produtos", response_model=List[ProdutoOut])
def listar_produtos(db: Session = Depends(get_db)):
    produtos = db.query(Produto).all()
    # opcional: pré-carregar precos
    for p in produtos:
        _ = p.precos
    return produtos

# Buscar produto por ID
@router.get("/produtos/{produto_id}", response_model=ProdutoOut)
def buscar_produto(produto_id: UUID, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    _ = produto.precos
    return produto

# Atualizar produto
@router.put("/produtos/{produto_id}", response_model=ProdutoOut)
def atualizar_produto(produto_id: UUID, produto_update: ProdutoUpdate, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    # se houve atualização de preço
    if produto_update.preco_venda is not None and produto_update.preco_venda != produto.preco_venda:
        # encerra preço antigo
        preco_ativo = db.query(PrecoProduto).filter(
            PrecoProduto.produto_id == produto.id,
            PrecoProduto.ativo == True
        ).first()
        if preco_ativo:
            preco_ativo.ativo = False
            preco_ativo.data_fim = datetime.utcnow()
            db.add(preco_ativo)

        # cria novo preço
        novo_preco = PrecoProduto(
            produto_id=produto.id,
            preco=produto_update.preco_venda,
            ativo=True
        )
        db.add(novo_preco)
        produto.preco_venda = produto_update.preco_venda

    for key, value in produto_update.dict(exclude_unset=True).items():
        setattr(produto, key, value)

    db.commit()
    db.refresh(produto)
    return produto

# Deletar produto por ID
@router.delete("/produtos/{produto_id}", status_code=204)
def deletar_produto(produto_id: UUID, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    db.delete(produto)
    db.commit()
    return {"detail": "Produto excluído com sucesso"}
