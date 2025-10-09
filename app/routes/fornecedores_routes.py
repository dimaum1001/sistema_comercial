"""
Rotas para gerenciamento de fornecedores (padronizado).
- PaginaÃ§Ã£o server-side (page/per_page OU limit/offset; teto=200)
- Busca server-side (q | search | term | nome/razÃ£o) + filtros cnpj_cpf, email, telefone, codigo_fornecedor
- CabeÃ§alhos X-Total-Count e Content-Range (0-based, inclusivo) + expose CORS
- Endpoints /fornecedores/count e /fornecedores/total como fallback
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Response, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text, or_, func

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import Fornecedor, EnderecoFornecedor
from app.schemas.fornecedor_schema import FornecedorCreate, FornecedorUpdate, FornecedorOut
from app.utils.privacy import mask_cpf_cnpj, mask_phone

router = APIRouter(dependencies=[Depends(get_current_user)])


def _fornecedor_to_out(fornecedor: Fornecedor) -> FornecedorOut:
    data = FornecedorOut.model_validate(fornecedor)
    data.cnpj_cpf = mask_cpf_cnpj(data.cnpj_cpf)
    if data.telefone:
        data.telefone = mask_phone(data.telefone)
    if getattr(data, 'contato_telefone', None):
        data.contato_telefone = mask_phone(data.contato_telefone)
    return data


# ------------------------ utils ------------------------ #
def gerar_proximo_codigo_fornecedor(db: Session, largura: int = 6) -> str:
    sql = text(
        "SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_fornecedor, '\\D', '', 'g') AS INTEGER)), 0) FROM fornecedores"
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
    MAX_PER_PAGE = 200
    if per_page is not None or page is not None:
        p = max(1, int(page or 1))
        pp = min(MAX_PER_PAGE, max(1, int(per_page or MAX_PER_PAGE)))
        return (pp * (p - 1), pp)
    lim = min(MAX_PER_PAGE, max(1, int(limit or MAX_PER_PAGE)))
    off = max(0, int(offset or 0))
    return (off, lim)


def _termo_busca(q: Optional[str], search: Optional[str], term: Optional[str], nome: Optional[str]) -> str:
    for v in (q, search, term, nome):
        if v and str(v).strip():
            return str(v).strip()
    return ""


# ------------------------ rotas ------------------------ #
@router.post("/fornecedores", response_model=FornecedorOut)
def criar_fornecedor(payload: FornecedorCreate, db: Session = Depends(get_db)) -> Fornecedor:
    """Cria fornecedor (com endereÃ§os opcionais)."""
    if payload.cnpj_cpf and db.query(Fornecedor).filter(Fornecedor.cnpj_cpf == payload.cnpj_cpf).first():
        raise HTTPException(status_code=400, detail="Fornecedor jÃ¡ cadastrado com este CNPJ/CPF")

    dados = payload.model_dump(by_alias=False, exclude={"enderecos"}, exclude_unset=True)

    if not (dados.get("codigo_fornecedor") or "").strip():
        dados["codigo_fornecedor"] = gerar_proximo_codigo_fornecedor(db)
    if not (dados.get("nome") or "").strip():
        if (dados.get("razao_social") or "").strip():
            dados["nome"] = dados["razao_social"]
    if dados.get("tipo_pessoa") not in ("F", "J"):
        dados["tipo_pessoa"] = "J"

    novo = Fornecedor(**dados)
    db.add(novo)
    try:
        db.flush()  # garante ID sem precisar commitar ainda
        # endereÃ§os (se houver)
        for end in payload.enderecos or []:
            data_end = end.model_dump() if hasattr(end, "model_dump") else dict(end)
            data_end["fornecedor_id"] = novo.id
            db.add(EnderecoFornecedor(**data_end))
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Conflito de unicidade (cÃ³digo ou CNPJ/CPF).")
        raise HTTPException(status_code=400, detail="Erro ao criar fornecedor.")
    db.refresh(novo)
    return _fornecedor_to_out(novo)


@router.get("/fornecedores", response_model=List[FornecedorOut])
def listar_fornecedores(
    response: Response,
    # paginaÃ§Ã£o (ou modo batch por ids)
    page: Optional[int] = Query(default=None, ge=1),
    per_page: Optional[int] = Query(default=None, ge=1, le=200),
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: Optional[int] = Query(default=None, ge=0),
    # batch: ?ids=uuid1,uuid2 (sem paginaÃ§Ã£o/headers)
    ids: Optional[str] = Query(default=None, description="Lista de IDs separados por vÃ­rgula"),
    # busca genÃ©rica
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    # filtros
    cnpj_cpf: Optional[str] = None,
    codigo_fornecedor: Optional[str] = None,
    razao_social: Optional[str] = None,
    email: Optional[str] = None,
    telefone: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Fornecedor]:
    """
    Lista fornecedores.

    - Se `ids` for informado, retorna esses fornecedores (sem paginaÃ§Ã£o e sem cabeÃ§alhos).
    - Caso contrÃ¡rio, aplica paginaÃ§Ã£o e busca server-side, retornando:
        X-Total-Count  e  Content-Range: items <start>-<end>/<total>  (0-based, inclusivo)
    """
    if ids:
        id_list = [s.strip() for s in ids.split(",") if s.strip()]
        if not id_list:
            return []
        fornecedores = (
            db.query(Fornecedor)
            .options(joinedload(Fornecedor.enderecos))
            .filter(Fornecedor.id.in_(id_list))
            .all()
        )
        return [_fornecedor_to_out(f) for f in fornecedores]

    skip, lim = _normaliza_paginacao(page, per_page, limit, offset)
    termo = _termo_busca(q, search, term, nome)

    base = db.query(Fornecedor)

    if termo:
        like = f"%{termo}%"
        base = base.filter(
            or_(
                Fornecedor.nome.ilike(like),
                Fornecedor.razao_social.ilike(like),
                Fornecedor.codigo_fornecedor.ilike(like),
                Fornecedor.cnpj_cpf.ilike(like),
                Fornecedor.email.ilike(like),
                Fornecedor.telefone.ilike(like),
            )
        )
    if cnpj_cpf:
        base = base.filter(Fornecedor.cnpj_cpf.ilike(f"%{cnpj_cpf.strip()}%"))
    if codigo_fornecedor:
        base = base.filter(Fornecedor.codigo_fornecedor.ilike(f"%{codigo_fornecedor.strip()}%"))
    if razao_social:
        base = base.filter(Fornecedor.razao_social.ilike(f"%{razao_social.strip()}%"))
    if email:
        base = base.filter(Fornecedor.email.ilike(f"%{email.strip()}%"))
    if telefone:
        base = base.filter(Fornecedor.telefone.ilike(f"%{telefone.strip()}%"))

    total = base.with_entities(func.count(Fornecedor.id)).scalar() or 0

    query = (
        base.options(joinedload(Fornecedor.enderecos))
        .order_by(Fornecedor.nome.asc(), Fornecedor.id.asc())
        .offset(skip)
        .limit(lim)
    )
    fornecedores = query.all()

    # headers 0-based inclusivo + expose
    if total == 0:
        start = end = 0
    else:
        start = skip
        end = min(skip + lim, total) - 1
    response.headers["X-Total-Count"] = str(total)
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count, Content-Range"

    return [_fornecedor_to_out(f) for f in fornecedores]


@router.get("/fornecedores/{fornecedor_id}", response_model=FornecedorOut)
def obter_fornecedor(fornecedor_id: UUID, db: Session = Depends(get_db)) -> Fornecedor:
    """ObtÃ©m um fornecedor pelo ID (inclui endereÃ§os)."""
    fornecedor = (
        db.query(Fornecedor)
        .options(joinedload(Fornecedor.enderecos))
        .filter(Fornecedor.id == fornecedor_id)
        .first()
    )
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor nÃ£o encontrado")
    return _fornecedor_to_out(fornecedor)


@router.put("/fornecedores/{fornecedor_id}", response_model=FornecedorOut)
def atualizar_fornecedor(fornecedor_id: UUID, payload: FornecedorUpdate, db: Session = Depends(get_db)) -> Fornecedor:
    """Atualiza parcialmente fornecedor. Se `enderecos` vier, substitui todos os endereÃ§os."""
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor nÃ£o encontrado")

    dados = payload.model_dump(by_alias=False, exclude_unset=True)
    novos_enderecos = dados.pop("enderecos", None)

    if "codigo_fornecedor" in dados:
        val = (dados["codigo_fornecedor"] or "").strip()
        if not val:
            dados.pop("codigo_fornecedor", None)

    if "cnpj_cpf" in dados and dados["cnpj_cpf"]:
        existe = (
            db.query(Fornecedor)
            .filter(Fornecedor.cnpj_cpf == dados["cnpj_cpf"], Fornecedor.id != fornecedor.id)
            .first()
        )
        if existe:
            raise HTTPException(status_code=409, detail="CNPJ/CPF jÃ¡ cadastrado para outro fornecedor.")

    if "nome" in dados and (dados["nome"] or "").strip() == "" and fornecedor.razao_social:
        dados["nome"] = fornecedor.razao_social
    if "tipo_pessoa" in dados and dados["tipo_pessoa"] not in ("F", "J"):
        dados["tipo_pessoa"] = "J"

    for k, v in dados.items():
        setattr(fornecedor, k, v)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Conflito de unicidade (cÃ³digo ou CNPJ/CPF).")
        raise HTTPException(status_code=400, detail="Erro ao atualizar fornecedor.")
    db.refresh(fornecedor)

    if novos_enderecos is not None:
        db.query(EnderecoFornecedor).filter(EnderecoFornecedor.fornecedor_id == fornecedor.id).delete()
        for end in novos_enderecos:
            data_end = end if isinstance(end, dict) else end.model_dump()
            data_end["fornecedor_id"] = fornecedor.id
            db.add(EnderecoFornecedor(**data_end))
        db.commit()
        db.refresh(fornecedor)

    return _fornecedor_to_out(fornecedor)


@router.delete("/fornecedores/{fornecedor_id}")
def deletar_fornecedor(fornecedor_id: UUID, db: Session = Depends(get_db)):
    """Remove fornecedor (endereÃ§os sÃ£o removidos em cascata)."""
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor nÃ£o encontrado")
    db.delete(fornecedor)
    db.commit()
    return {"message": "Fornecedor excluÃ­do com sucesso"}


# -------------------- endpoints auxiliares de total -------------------- #
@router.get("/fornecedores/count")
def total_fornecedores_count(
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    cnpj_cpf: Optional[str] = None,
    codigo_fornecedor: Optional[str] = None,
    razao_social: Optional[str] = None,
    email: Optional[str] = None,
    telefone: Optional[str] = None,
    db: Session = Depends(get_db),
):
    termo = _termo_busca(q, search, term, nome)
    base = db.query(Fornecedor)
    if termo:
        like = f"%{termo}%"
        base = base.filter(
            or_(
                Fornecedor.nome.ilike(like),
                Fornecedor.razao_social.ilike(like),
                Fornecedor.codigo_fornecedor.ilike(like),
                Fornecedor.cnpj_cpf.ilike(like),
                Fornecedor.email.ilike(like),
                Fornecedor.telefone.ilike(like),
            )
        )
    if cnpj_cpf:
        base = base.filter(Fornecedor.cnpj_cpf.ilike(f"%{cnpj_cpf.strip()}%"))
    if codigo_fornecedor:
        base = base.filter(Fornecedor.codigo_fornecedor.ilike(f"%{codigo_fornecedor.strip()}%"))
    if razao_social:
        base = base.filter(Fornecedor.razao_social.ilike(f"%{razao_social.strip()}%"))
    if email:
        base = base.filter(Fornecedor.email.ilike(f"%{email.strip()}%"))
    if telefone:
        base = base.filter(Fornecedor.telefone.ilike(f"%{telefone.strip()}%"))
    total = base.with_entities(func.count(Fornecedor.id)).scalar() or 0
    return {"total": total}


@router.get("/fornecedores/total")
def total_fornecedores_total(
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    cnpj_cpf: Optional[str] = None,
    codigo_fornecedor: Optional[str] = None,
    razao_social: Optional[str] = None,
    email: Optional[str] = None,
    telefone: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return total_fornecedores_count(
        q=q,
        search=search,
        term=term,
        nome=nome,
        cnpj_cpf=cnpj_cpf,
        codigo_fornecedor=codigo_fornecedor,
        razao_social=razao_social,
        email=email,
        telefone=telefone,
        db=db,
    )

