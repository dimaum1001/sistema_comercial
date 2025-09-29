from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Response, Query
from sqlalchemy import text, or_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.models import Produto, PrecoProduto
from app.schemas.produto_schema import ProdutoCreate, ProdutoOut, ProdutoUpdate

router = APIRouter()


# ------------------------ util ------------------------ #
def gerar_proximo_codigo_produto(db: Session, largura: int = 6) -> str:
    """Gera um código sequencial numérico (zero-padded) para produtos."""
    sql = text(
        """
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_produto, '\\D', '', 'g') AS INTEGER)), 0)
        FROM produtos
        """
    )
    atual = db.execute(sql).scalar() or 0
    proximo = atual + 1
    return f"{proximo:0{largura}d}"


def _normaliza_paginacao(
    page: Optional[int],
    per_page: Optional[int],
    limit: Optional[int],
    offset: Optional[int],
) -> tuple[int, int]:
    """
    Prioriza page/per_page; cai para limit/offset.
    Aplica teto de 200 por página.
    Retorna (skip, lim).
    """
    MAX_PER_PAGE = 200
    if per_page is not None or page is not None:
        p = max(1, int(page or 1))
        pp = min(MAX_PER_PAGE, max(1, int(per_page or MAX_PER_PAGE)))
        return (pp * (p - 1), pp)

    # fallback: limit/offset
    lim = min(MAX_PER_PAGE, max(1, int(limit or MAX_PER_PAGE)))
    off = max(0, int(offset or 0))
    return (off, lim)


def _termo_busca(q: Optional[str], search: Optional[str], term: Optional[str], nome: Optional[str]) -> str:
    for v in (q, search, term, nome):
        if v and str(v).strip():
            return str(v).strip()
    return ""


# ------------------------ rotas ------------------------ #
@router.post("/produtos", response_model=ProdutoOut)
def criar_produto(produto: ProdutoCreate, db: Session = Depends(get_db)) -> Produto:
    """Cria um novo produto e, opcionalmente, seu preço inicial."""
    dados = produto.model_dump(exclude_unset=True)

    # Garante codigo_produto (NOT NULL e UNIQUE)
    codigo = dados.get("codigo_produto")
    if not codigo or not str(codigo).strip():
        dados["codigo_produto"] = gerar_proximo_codigo_produto(db)

    novo_produto = Produto(**dados)
    db.add(novo_produto)

    try:
        db.flush()  # para obter ID antes de criar preço
    except IntegrityError as e:
        db.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail="codigo_produto já existente. Tente novamente.")
        raise HTTPException(status_code=400, detail="Erro ao criar produto.")

    # preço inicial (cache no próprio produto)
    if produto.preco_venda is not None:
        preco_inicial = PrecoProduto(
            produto_id=novo_produto.id,
            preco=produto.preco_venda,
            ativo=True,
        )
        db.add(preco_inicial)
        novo_produto.preco_venda = produto.preco_venda

    db.commit()
    db.refresh(novo_produto)
    _ = novo_produto.precos  # pré-carrega
    return novo_produto


@router.get("/produtos", response_model=List[ProdutoOut])
def listar_produtos(
    response: Response,
    # paginação: prioriza page/per_page; aceita limit/offset
    page: Optional[int] = Query(default=None, ge=1),
    per_page: Optional[int] = Query(default=None, ge=1, le=200),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: Optional[int] = Query(default=None, ge=0),
    # busca (o back aceita qualquer um destes)
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Produto]:
    """
    Lista produtos com paginação e busca server-side.

    Cabeçalhos devolvidos:
      - X-Total-Count: total de itens da busca no banco
      - Content-Range: items <start>-<end>/<total>
    """
    skip, lim = _normaliza_paginacao(page, per_page, limit, offset)
    termo = _termo_busca(q, search, term, nome)

    base_query = db.query(Produto)

    # busca: aplica ILIKE em campos comuns
    if termo:
        like = f"%{termo}%"
        base_query = base_query.filter(
            or_(
                Produto.nome.ilike(like),
                Produto.marca.ilike(like),
                Produto.codigo_barras.ilike(like),
                Produto.codigo_produto.ilike(like),
            )
        )

    total = base_query.with_entities(func.count(Produto.id)).scalar() or 0

    # ordenação padrão (ajuste se quiser)
    query = (
        base_query.options(joinedload(Produto.precos))
        .order_by(Produto.nome.asc(), Produto.id.asc())
        .offset(skip)
        .limit(lim)
    )

    produtos = query.all()

    # Cabeçalhos de total & range
    start = 0 if total == 0 else skip + 1
    end = min(skip + lim, total)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"

    return produtos


@router.get("/produtos/{produto_id}", response_model=ProdutoOut)
def buscar_produto(produto_id: UUID, db: Session = Depends(get_db)) -> Produto:
    """Busca um produto pelo seu identificador."""
    produto = (
        db.query(Produto)
        .options(joinedload(Produto.precos))
        .filter(Produto.id == produto_id)
        .first()
    )
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return produto


@router.put("/produtos/{produto_id}", response_model=ProdutoOut)
def atualizar_produto(produto_id: UUID, produto_update: ProdutoUpdate, db: Session = Depends(get_db)) -> Produto:
    """Atualiza os dados de um produto e gerencia o histórico de preços."""
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    dados_update = produto_update.model_dump(exclude_unset=True)

    # Alteração de preço => fecha preço ativo e cria novo
    if "preco_venda" in dados_update and dados_update["preco_venda"] is not None:
        if dados_update["preco_venda"] != produto.preco_venda:
            preco_ativo = (
                db.query(PrecoProduto)
                .filter(PrecoProduto.produto_id == produto.id, PrecoProduto.ativo.is_(True))
                .first()
            )
            if preco_ativo:
                preco_ativo.ativo = False
                preco_ativo.data_fim = datetime.utcnow()
                db.add(preco_ativo)

            novo_preco = PrecoProduto(
                produto_id=produto.id,
                preco=dados_update["preco_venda"],
                ativo=True,
            )
            db.add(novo_preco)
            produto.preco_venda = dados_update["preco_venda"]

    # Não permitir limpar codigo_produto (NOT NULL)
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


# ------- PATCH parcial (opcional) -------
@router.patch("/produtos/{produto_id}", response_model=ProdutoOut)
def patch_produto(produto_id: UUID, produto_update: ProdutoUpdate, db: Session = Depends(get_db)) -> Produto:
    return atualizar_produto(produto_id, produto_update, db)


# ------- Aliases para compatibilidade com o front -------
@router.get("/produtos/editar/{produto_id}", response_model=ProdutoOut)
def buscar_produto_alias_editar(produto_id: UUID, db: Session = Depends(get_db)) -> Produto:
    """Alias para GET /produtos/{id} (útil se o front chama /produtos/editar/:id)."""
    return buscar_produto(produto_id, db)


@router.put("/produtos/editar/{produto_id}", response_model=ProdutoOut)
def atualizar_produto_alias_editar(produto_id: UUID, produto_update: ProdutoUpdate, db: Session = Depends(get_db)) -> Produto:
    """Alias para PUT /produtos/{id} (útil se o front chama /produtos/editar/:id)."""
    return atualizar_produto(produto_id, produto_update, db)


@router.delete("/produtos/{produto_id}", status_code=204)
def deletar_produto(produto_id: UUID, db: Session = Depends(get_db)):
    """Deleta um produto do banco de dados."""
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    db.delete(produto)
    db.commit()
    return {"detail": "Produto removido com sucesso"}


# -------------------- endpoints auxiliares de total -------------------- #
@router.get("/produtos/count")
def total_produtos_count(
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    db: Session = Depends(get_db),
):
    termo = _termo_busca(q, search, term, nome)
    base = db.query(Produto)
    if termo:
        like = f"%{termo}%"
        base = base.filter(
            or_(
                Produto.nome.ilike(like),
                Produto.marca.ilike(like),
                Produto.codigo_barras.ilike(like),
                Produto.codigo_produto.ilike(like),
            )
        )
    total = base.with_entities(func.count(Produto.id)).scalar() or 0
    return {"total": total}


@router.get("/produtos/total")
def total_produtos_total(
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return total_produtos_count(q=q, search=search, term=term, nome=nome, db=db)
