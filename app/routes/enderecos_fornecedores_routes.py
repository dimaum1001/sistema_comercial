from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import Fornecedor, EnderecoFornecedor
from app.schemas.endereco_fornecedores_schema import (
    EnderecoFornecedorCreate,
    EnderecoFornecedorUpdate,
    EnderecoFornecedorOut,
)

router = APIRouter(prefix="/enderecos-fornecedores", tags=["EndereÃ§os de Fornecedores"], dependencies=[Depends(get_current_user)])

@router.post("/", response_model=EnderecoFornecedorOut, status_code=status.HTTP_201_CREATED)
def criar_endereco(payload: EnderecoFornecedorCreate, db: Session = Depends(get_db)):
    forn = db.query(Fornecedor).filter(Fornecedor.id == payload.fornecedor_id).first()
    if not forn:
        raise HTTPException(status_code=404, detail="Fornecedor nÃ£o encontrado")

    end = EnderecoFornecedor(**payload.model_dump())
    db.add(end)
    db.commit()
    db.refresh(end)
    return end

@router.get("/fornecedor/{fornecedor_id}", response_model=List[EnderecoFornecedorOut])
def listar_por_fornecedor(fornecedor_id: UUID, db: Session = Depends(get_db)):
    if not db.query(Fornecedor.id).filter(Fornecedor.id == fornecedor_id).first():
        raise HTTPException(status_code=404, detail="Fornecedor nÃ£o encontrado")
    return db.query(EnderecoFornecedor).filter(EnderecoFornecedor.fornecedor_id == fornecedor_id).all()

@router.get("/{endereco_id}", response_model=EnderecoFornecedorOut)
def obter(endereco_id: UUID, db: Session = Depends(get_db)):
    end = db.query(EnderecoFornecedor).filter(EnderecoFornecedor.id == endereco_id).first()
    if not end:
        raise HTTPException(status_code=404, detail="EndereÃ§o nÃ£o encontrado")
    return end

@router.put("/{endereco_id}", response_model=EnderecoFornecedorOut)
def atualizar(endereco_id: UUID, payload: EnderecoFornecedorUpdate, db: Session = Depends(get_db)):
    end = db.query(EnderecoFornecedor).filter(EnderecoFornecedor.id == endereco_id).first()
    if not end:
        raise HTTPException(status_code=404, detail="EndereÃ§o nÃ£o encontrado")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(end, k, v)
    db.commit()
    db.refresh(end)
    return end

@router.delete("/{endereco_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar(endereco_id: UUID, db: Session = Depends(get_db)):
    end = db.query(EnderecoFornecedor).filter(EnderecoFornecedor.id == endereco_id).first()
    if not end:
        raise HTTPException(status_code=404, detail="EndereÃ§o nÃ£o encontrado")
    db.delete(end)
    db.commit()
    return None

