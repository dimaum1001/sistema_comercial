from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from typing import List
from uuid import UUID
from datetime import datetime

from app.db.database import get_db, SessionLocal
from app.models.models import Cliente, Endereco
from app.schemas.cliente_schema import ClienteCreate, ClienteOut, ClienteUpdate

router = APIRouter()


# ---------------------------------------------------------
# Utilitário: gerar próximo código (numérico, zero-padded)
# ---------------------------------------------------------
def gerar_proximo_codigo_cliente(db: Session, largura: int = 6) -> str:
    """
    Gera um codigo_cliente sequencial numérico com zero-padding (sem prefixo).
    Ex.: 000001, 000002, ...

    Observação:
    - Em volume alto/concorrência, considere usar sequence/trigger no Postgres.
    """
    sql = text("""
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_cliente, '\\D', '', 'g') AS INTEGER)), 0)
        FROM clientes
    """)
    atual = db.execute(sql).scalar() or 0
    proximo = atual + 1
    return f"{proximo:0{largura}d}"


# Dependência local (se precisar em algum lugar)
def get_db_local():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------
# Criar cliente
# ---------------------------------------------------------
@router.post("/clientes", response_model=ClienteOut)
def criar_cliente(cliente: ClienteCreate, db: Session = Depends(get_db)):
    # validação de duplicidade (cpf_cnpj)
    if db.query(Cliente).filter(Cliente.cpf_cnpj == cliente.cpf_cnpj).first():
        raise HTTPException(status_code=400, detail="CPF/CNPJ já cadastrado")

    # Garante codigo_cliente (NOT NULL/UNIQUE)
    codigo = (cliente.codigo_cliente or "").strip() if hasattr(cliente, "codigo_cliente") else ""
    if not codigo:
        codigo = gerar_proximo_codigo_cliente(db)

    novo_cliente = Cliente(
        codigo_cliente=codigo,
        nome=cliente.nome,
        tipo_pessoa=cliente.tipo_pessoa,  # 'F' ou 'J'
        cpf_cnpj=cliente.cpf_cnpj,
        telefone=cliente.telefone,
        email=cliente.email,
    )

    db.add(novo_cliente)

    try:
        db.flush()  # garante ID para endereços
    except IntegrityError as e:
        db.rollback()
        # trata colisão de unique (codigo_cliente, cpf_cnpj, email)
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Registro duplicado (código, CPF/CNPJ ou e-mail).")
        raise HTTPException(status_code=400, detail="Erro ao criar cliente.")

    # 🔧 AQUI ESTÁ A CORREÇÃO:
    # Use os OBJETOS Pydantic (cliente.enderecos), não dicts vindos de .dict()
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
    # pré-carrega endereços
    _ = novo_cliente.enderecos
    return novo_cliente


# ---------------------------------------------------------
# Listar clientes
# ---------------------------------------------------------
@router.get("/clientes", response_model=List[ClienteOut])
def listar_clientes(db: Session = Depends(get_db)):
    clientes = db.query(Cliente).all()
    # pré-carrega endereços
    for c in clientes:
        _ = c.enderecos
    return clientes


# ---------------------------------------------------------
# Buscar cliente por ID
# ---------------------------------------------------------
@router.get("/clientes/{cliente_id}", response_model=ClienteOut)
def get_cliente(cliente_id: UUID, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    _ = cliente.enderecos
    return cliente


# ---------------------------------------------------------
# Excluir cliente
# ---------------------------------------------------------
@router.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: UUID, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    db.delete(cliente)
    db.commit()
    return {"message": "Cliente excluído com sucesso"}


# ---------------------------------------------------------
# Atualizar cliente (parcial)
# ---------------------------------------------------------
@router.put("/clientes/{cliente_id}", response_model=ClienteOut)
def atualizar_cliente(cliente_id: UUID, cliente_update: ClienteUpdate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    # Validar duplicidade de CPF/CNPJ, se trocar
    if cliente_update.cpf_cnpj:
        existe = db.query(Cliente).filter(
            Cliente.cpf_cnpj == cliente_update.cpf_cnpj,
            Cliente.id != cliente.id
        ).first()
        if existe:
            raise HTTPException(status_code=409, detail="CPF/CNPJ já cadastrado em outro cliente.")

    # Não permitir esvaziar codigo_cliente (NOT NULL)
    if cliente_update.codigo_cliente is not None:
        val = (cliente_update.codigo_cliente or "").strip()
        if not val:
            # ignora tentativa de limpar
            pass
        else:
            cliente.codigo_cliente = val

    # Aplica campos simples, se vieram
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

    # 🔧 ATENÇÃO AQUI:
    # Atualiza endereços somente se a lista for enviada (pode ser vazia para limpar)
    if cliente_update.enderecos is not None:
        # remove todos
        db.query(Endereco).filter(Endereco.cliente_id == cliente.id).delete()
        # recria a partir dos OBJETOS pydantic
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
