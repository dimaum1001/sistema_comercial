"""
Rotas para gerenciamento de clientes.

- Paginação server-side (aceita page/per_page OU limit/offset/skip)
- Máx 200 por página quando usar per_page (UI), mas limit pode ser maior (até 5000) para varreduras
- Busca server-side (q | search | term | nome) + filtros cpf_cnpj, email, telefone, codigo_cliente
- Retorna total via cabeçalhos X-Total-Count e Content-Range (0-based, inclusivo)
- Endpoints /clientes/count e /clientes/total como fallback
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Response, Query
from sqlalchemy import text, or_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.models import Cliente, Endereco
from app.schemas.cliente_schema import ClienteCreate, ClienteOut, ClienteUpdate

router = APIRouter()


# ------------------------ utils ------------------------ #
def gerar_proximo_codigo_cliente(db: Session, largura: int = 6) -> str:
    """Gera um código sequencial numérico para clientes (zero-padding)."""
    sql = text(
        """
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_cliente, '\\D', '', 'g') AS INTEGER)), 0)
        FROM clientes
        """
    )
    atual = db.execute(sql).scalar() or 0
    proximo = atual + 1
    return f"{proximo:0{largura}d}"


def _normaliza_paginacao(
    *,
    page: Optional[int],
    per_page: Optional[int],
    limit: Optional[int],
    offset: Optional[int],
    skip: Optional[int],
) -> tuple[int, int]:
    """
    Regras:
      - Se 'skip' OU 'limit' vierem, priorizamos esse par (compatível com o front atual).
      - Caso contrário, usamos page/per_page (com teto de 200).
      - Fallback: limit default 200, offset 0.
      - Para varreduras (ex.: total), permitimos limit grande (até MAX_LIMIT) quando 'limit' for usado.
    """
    MAX_PER_PAGE = 200
    MAX_LIMIT = 5000  # permite varreduras grandes (ex.: 1000) sem travar

    # Prioridade para 'skip/limit' (API antiga do front)
    if skip is not None or limit is not None:
        off = max(0, int(skip or 0))
        lim = int(limit or MAX_PER_PAGE)
        lim = max(1, min(lim, MAX_LIMIT))
        return off, lim

    # Depois, page/per_page
    if per_page is not None or page is not None:
        p = max(1, int(page or 1))
        pp = max(1, min(int(per_page or MAX_PER_PAGE), MAX_PER_PAGE))
        return (pp * (p - 1), pp)

    # Por fim, offset/limit genéricos
    off = max(0, int(offset or 0))
    lim = int(limit or MAX_PER_PAGE)
    lim = max(1, min(lim, MAX_PER_PAGE))
    return off, lim


def _termo_busca(q: Optional[str], search: Optional[str], term: Optional[str], nome: Optional[str]) -> str:
    for v in (q, search, term, nome):
        if v and str(v).strip():
            return str(v).strip()
    return ""


# ------------------------ rotas ------------------------ #
@router.post("/clientes", response_model=ClienteOut)
def criar_cliente(cliente: ClienteCreate, db: Session = Depends(get_db)) -> Cliente:
    """Cria um novo cliente e seus endereços relacionados."""
    # valida duplicidade de CPF/CNPJ
    if cliente.cpf_cnpj and db.query(Cliente).filter(Cliente.cpf_cnpj == cliente.cpf_cnpj).first():
        raise HTTPException(status_code=400, detail="CPF/CNPJ já cadastrado")

    # Garante código do cliente (NOT NULL/UNIQUE)
    valor = getattr(cliente, "codigo_cliente", None)
    codigo = valor.strip() if isinstance(valor, str) else ""
    if not codigo:
        codigo = gerar_proximo_codigo_cliente(db)

    novo_cliente = Cliente(
        codigo_cliente=codigo,
        nome=cliente.nome,
        tipo_pessoa=cliente.tipo_pessoa,
        cpf_cnpj=cliente.cpf_cnpj,
        telefone=cliente.telefone,
        email=cliente.email,
    )
    db.add(novo_cliente)

    try:
        db.flush()  # garante ID para endereços
    except IntegrityError as e:
        db.rollback()
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Registro duplicado (código, CPF/CNPJ ou e-mail).")
        raise HTTPException(status_code=400, detail="Erro ao criar cliente.")

    # cria endereços associados (se enviados)
    for end in cliente.enderecos or []:
        novo_endereco = Endereco(
            cliente_id=novo_cliente.id,
            tipo_endereco=end.tipo_endereco,
            logradouro=end.logradouro,
            numero=end.numero,
            complemento=end.complemento,
            bairro=end.bairro,
            cidade=end.cidade,
            estado=end.estado,
            cep=end.cep,
            pais=end.pais,
        )
        db.add(novo_endereco)

    db.commit()
    db.refresh(novo_cliente)
    _ = novo_cliente.enderecos  # pré-carrega
    return novo_cliente


@router.get("/clientes", response_model=List[ClienteOut])
def listar_clientes(
    response: Response,
    # paginação (suporta ambos os estilos)
    page: Optional[int] = Query(default=None, ge=1),
    per_page: Optional[int] = Query(default=None, ge=1, le=200),
    limit: Optional[int] = Query(default=None, ge=1),
    offset: Optional[int] = Query(default=None, ge=0),
    skip: Optional[int] = Query(default=None, ge=0),  # <--- compatível com seu front atual
    # busca genérica
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    # filtros específicos
    cpf_cnpj: Optional[str] = None,
    email: Optional[str] = None,
    telefone: Optional[str] = None,
    codigo_cliente: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Cliente]:
    """
    Lista clientes com paginação e busca server-side.

    Cabeçalhos devolvidos:
      - X-Total-Count: total de itens da busca no banco
      - Content-Range: items <start>-<end>/<total>   (0-based, inclusivo)
    """
    skip_val, lim_val = _normaliza_paginacao(
        page=page, per_page=per_page, limit=limit, offset=offset, skip=skip
    )
    termo = _termo_busca(q, search, term, nome)

    base = db.query(Cliente)

    # busca por vários campos
    if termo:
        like = f"%{termo}%"
        base = base.filter(
            or_(
                Cliente.nome.ilike(like),
                Cliente.codigo_cliente.ilike(like),
                Cliente.cpf_cnpj.ilike(like),
                Cliente.email.ilike(like),
                Cliente.telefone.ilike(like),
            )
        )

    # filtros diretos quando fornecidos
    if cpf_cnpj:
        base = base.filter(Cliente.cpf_cnpj.ilike(f"%{cpf_cnpj.strip()}%"))
    if email:
        base = base.filter(Cliente.email.ilike(f"%{email.strip()}%"))
    if telefone:
        base = base.filter(Cliente.telefone.ilike(f"%{telefone.strip()}%"))
    if codigo_cliente:
        base = base.filter(Cliente.codigo_cliente.ilike(f"%{codigo_cliente.strip()}%"))

    total = base.with_entities(func.count(Cliente.id)).scalar() or 0

    # ordenação padrão
    query = (
        base.options(joinedload(Cliente.enderecos))
        .order_by(Cliente.nome.asc(), Cliente.id.asc())
        .offset(skip_val)
        .limit(lim_val)
    )

    clientes = query.all()

    # Cabeçalhos (0-based inclusivo)
    if total == 0:
        start = 0
        end = 0
    else:
        start = skip_val
        end = min(skip_val + lim_val, total) - 1

    response.headers["X-Total-Count"] = str(total)
    response.headers["Content-Range"] = f"items {start}-{end}/{total}"

    return clientes


@router.get("/clientes/{cliente_id}", response_model=ClienteOut)
def get_cliente(cliente_id: UUID, db: Session = Depends(get_db)) -> Cliente:
    """Obtém um cliente pelo seu identificador (com endereços)."""
    cliente = (
        db.query(Cliente)
        .options(joinedload(Cliente.enderecos))
        .filter(Cliente.id == cliente_id)
        .first()
    )
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente


@router.delete("/clientes/{cliente_id}", status_code=204)
def delete_cliente(cliente_id: UUID, db: Session = Depends(get_db)):
    """Exclui um cliente."""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    db.delete(cliente)
    db.commit()
    return {"message": "Cliente excluído com sucesso"}


@router.put("/clientes/{cliente_id}", response_model=ClienteOut)
def atualizar_cliente(cliente_id: UUID, cliente_update: ClienteUpdate, db: Session = Depends(get_db)) -> Cliente:
    """Atualiza parcialmente um cliente existente, incluindo endereços."""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    # Validar duplicidade de CPF/CNPJ se o valor for alterado
    if cliente_update.cpf_cnpj:
        existe = (
            db.query(Cliente)
            .filter(Cliente.cpf_cnpj == cliente_update.cpf_cnpj, Cliente.id != cliente.id)
            .first()
        )
        if existe:
            raise HTTPException(status_code=409, detail="CPF/CNPJ já cadastrado em outro cliente.")

    # Não permitir esvaziar codigo_cliente (NOT NULL)
    if cliente_update.codigo_cliente is not None:
        val = (cliente_update.codigo_cliente or "").strip()
        if val:
            cliente.codigo_cliente = val

    # aplica campos básicos
    if cliente_update.nome is not None:
        cliente.nome = cliente_update.nome
    if cliente_update.tipo_pessoa is not None:
        cliente.tipo_pessoa = cliente_update.tipo_pessoa
    if cliente_update.cpf_cnpj is not None:
        cliente.cpf_cnpj = cliente_update.cpf_cnpj
    if cliente_update.telefone is not None:
        cliente.telefone = cliente_update.telefone
    if cliente_update.email is not None:
        cliente.email = cliente_update.email

    # Atualiza endereços se enviados (lista vazia remove todos)
    if cliente_update.enderecos is not None:
        db.query(Endereco).filter(Endereco.cliente_id == cliente.id).delete()
        for end in cliente_update.enderecos:
            novo_endereco = Endereco(
                cliente_id=cliente.id,
                tipo_endereco=end.tipo_endereco,
                logradouro=end.logradouro,
                numero=end.numero,
                complemento=end.complemento,
                bairro=end.bairro,
                cidade=end.cidade,
                estado=end.estado,
                cep=end.cep,
                pais=end.pais,
            )
            db.add(novo_endereco)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Conflito de unicidade (código, CPF/CNPJ ou e-mail).")
        raise HTTPException(status_code=400, detail="Erro ao atualizar cliente.")

    db.refresh(cliente)
    _ = cliente.enderecos
    return cliente


# -------------------- endpoints auxiliares de total -------------------- #
@router.get("/clientes/count")
def total_clientes_count(
    # mesmos filtros da listagem para o total bater
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    cpf_cnpj: Optional[str] = None,
    email: Optional[str] = None,
    telefone: Optional[str] = None,
    codigo_cliente: Optional[str] = None,
    db: Session = Depends(get_db),
):
    termo = _termo_busca(q, search, term, nome)
    base = db.query(Cliente)
    if termo:
        like = f"%{termo}%"
        base = base.filter(
            or_(
                Cliente.nome.ilike(like),
                Cliente.codigo_cliente.ilike(like),
                Cliente.cpf_cnpj.ilike(like),
                Cliente.email.ilike(like),
                Cliente.telefone.ilike(like),
            )
        )
    if cpf_cnpj:
        base = base.filter(Cliente.cpf_cnpj.ilike(f"%{cpf_cnpj.strip()}%"))
    if email:
        base = base.filter(Cliente.email.ilike(f"%{email.strip()}%"))
    if telefone:
        base = base.filter(Cliente.telefone.ilike(f"%{telefone.strip()}%"))
    if codigo_cliente:
        base = base.filter(Cliente.codigo_cliente.ilike(f"%{codigo_cliente.strip()}%"))
    total = base.with_entities(func.count(Cliente.id)).scalar() or 0
    return {"total": total}


@router.get("/clientes/total")
def total_clientes_total(
    q: Optional[str] = None,
    search: Optional[str] = None,
    term: Optional[str] = None,
    nome: Optional[str] = None,
    cpf_cnpj: Optional[str] = None,
    email: Optional[str] = None,
    telefone: Optional[str] = None,
    codigo_cliente: Optional[str] = None,
    db: Session = Depends(get_db),
):
    # mesmo comportamento do /clientes/count
    return total_clientes_count(
        q=q,
        search=search,
        term=term,
        nome=nome,
        cpf_cnpj=cpf_cnpj,
        email=email,
        telefone=telefone,
        codigo_cliente=codigo_cliente,
        db=db,
    )
