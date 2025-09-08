from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from typing import List
from uuid import UUID

from app.db.database import SessionLocal
from app.models.models import Fornecedor
from app.schemas.fornecedor_schema import FornecedorCreate, FornecedorUpdate, FornecedorOut

router = APIRouter()

# Dependência de sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------------------------
# Utilitário: gerar código numérico (6 dígitos)
# -----------------------------------------------
def gerar_proximo_codigo_fornecedor(db: Session, largura: int = 6) -> str:
    """
    Gera um codigo_fornecedor sequencial numérico com zero-padding (sem prefixo).
    Ex.: 000001, 000002, ...
    """
    sql = text("""
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(codigo_fornecedor, '\\D', '', 'g') AS INTEGER)), 0)
        FROM fornecedores
    """)
    atual = db.execute(sql).scalar() or 0
    proximo = atual + 1
    return f"{proximo:0{largura}d}"


# Criar fornecedor
@router.post("/fornecedores", response_model=FornecedorOut)
def criar_fornecedor(fornecedor: FornecedorCreate, db: Session = Depends(get_db)):
    # valida duplicidade de CNPJ/CPF
    if db.query(Fornecedor).filter(Fornecedor.cnpj_cpf == fornecedor.cnpj_cpf).first():
        raise HTTPException(status_code=400, detail="Fornecedor já cadastrado com este CNPJ/CPF")

    # model_dump (Pydantic v2) preserva snake_case; aliases aceitos na entrada
    dados = fornecedor.model_dump(by_alias=False, exclude_unset=True)

    # Garante codigo_fornecedor (NOT NULL/UNIQUE)
    codigo = (dados.get("codigo_fornecedor") or "").strip()
    if not codigo:
        dados["codigo_fornecedor"] = gerar_proximo_codigo_fornecedor(db)

    novo_forn = Fornecedor(**dados)
    db.add(novo_forn)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Conflito de unicidade (código ou CNPJ/CPF).")
        raise HTTPException(status_code=400, detail="Erro ao criar fornecedor.")

    db.refresh(novo_forn)
    return novo_forn


# Listar fornecedores
@router.get("/fornecedores", response_model=List[FornecedorOut])
def listar_fornecedores(db: Session = Depends(get_db)):
    return db.query(Fornecedor).all()


# Buscar fornecedor por ID
@router.get("/fornecedores/{fornecedor_id}", response_model=FornecedorOut)
def obter_fornecedor(fornecedor_id: UUID, db: Session = Depends(get_db)):
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return fornecedor


# Atualizar fornecedor (parcial)
@router.put("/fornecedores/{fornecedor_id}", response_model=FornecedorOut)
def atualizar_fornecedor(fornecedor_id: UUID, fornecedor_update: FornecedorUpdate, db: Session = Depends(get_db)):
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    dados_update = fornecedor_update.model_dump(by_alias=False, exclude_unset=True)

    # Não permitir limpar codigo_fornecedor (NOT NULL)
    if "codigo_fornecedor" in dados_update:
        val = (dados_update["codigo_fornecedor"] or "").strip()
        if not val:
            dados_update.pop("codigo_fornecedor", None)

    # Validar duplicidade de CNPJ/CPF, se trocar
    if "cnpj_cpf" in dados_update and dados_update["cnpj_cpf"]:
        existe = db.query(Fornecedor).filter(
            Fornecedor.cnpj_cpf == dados_update["cnpj_cpf"],
            Fornecedor.id != fornecedor.id
        ).first()
        if existe:
            raise HTTPException(status_code=409, detail="CNPJ/CPF já cadastrado para outro fornecedor.")

    for key, value in dados_update.items():
        setattr(fornecedor, key, value)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Conflito de unicidade (código ou CNPJ/CPF).")
        raise HTTPException(status_code=400, detail="Erro ao atualizar fornecedor.")

    db.refresh(fornecedor)
    return fornecedor


# Deletar fornecedor
@router.delete("/fornecedores/{fornecedor_id}")
def deletar_fornecedor(fornecedor_id: UUID, db: Session = Depends(get_db)):
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    db.delete(fornecedor)
    db.commit()
    return {"message": "Fornecedor excluído com sucesso"}
