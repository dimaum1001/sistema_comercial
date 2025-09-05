from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
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

# Criar fornecedor
@router.post("/fornecedores", response_model=FornecedorOut)
def criar_fornecedor(fornecedor: FornecedorCreate, db: Session = Depends(get_db)):
    # valida duplicidade de CNPJ/CPF
    if db.query(Fornecedor).filter(Fornecedor.cnpj_cpf == fornecedor.cnpj_cpf).first():
        raise HTTPException(status_code=400, detail="Fornecedor já cadastrado com este CNPJ/CPF")

    novo_forn = Fornecedor(**fornecedor.dict())
    db.add(novo_forn)
    db.commit()
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

# Atualizar fornecedor
@router.put("/fornecedores/{fornecedor_id}", response_model=FornecedorOut)
def atualizar_fornecedor(fornecedor_id: UUID, fornecedor_update: FornecedorUpdate, db: Session = Depends(get_db)):
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    for key, value in fornecedor_update.dict(exclude_unset=True).items():
        setattr(fornecedor, key, value)

    db.commit()
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
