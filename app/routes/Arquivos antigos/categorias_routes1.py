from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.models import Categoria
from app.schemas.categoria_schema import CategoriaCreate, CategoriaOut
from typing import List
from uuid import UUID

router = APIRouter()

# Dependência para obter sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Criar categoria
@router.post("/categorias", response_model=CategoriaOut)
def criar_categoria(categoria: CategoriaCreate, db: Session = Depends(get_db)):
    existe = db.query(Categoria).filter(Categoria.nome == categoria.nome).first()
    if existe:
        raise HTTPException(status_code=400, detail="Categoria já existe")

    nova_categoria = Categoria(nome=categoria.nome)
    db.add(nova_categoria)
    db.commit()
    db.refresh(nova_categoria)
    return nova_categoria


# Listar categorias
@router.get("/categorias", response_model=List[CategoriaOut])
def listar_categorias(db: Session = Depends(get_db)):
    return db.query(Categoria).all()


# Obter categoria por ID
@router.get("/categorias/{categoria_id}", response_model=CategoriaOut)
def obter_categoria(categoria_id: UUID, db: Session = Depends(get_db)):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return categoria


# Atualizar categoria
@router.put("/categorias/{categoria_id}", response_model=CategoriaOut)
def atualizar_categoria(categoria_id: UUID, categoria_data: CategoriaCreate, db: Session = Depends(get_db)):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Verifica se já existe outra categoria com o mesmo nome
    existe = db.query(Categoria).filter(
        Categoria.nome == categoria_data.nome,
        Categoria.id != categoria_id
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")

    categoria.nome = categoria_data.nome
    db.commit()
    db.refresh(categoria)
    return categoria


# Deletar categoria
@router.delete("/categorias/{categoria_id}", status_code=204)
def deletar_categoria(categoria_id: UUID, db: Session = Depends(get_db)):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    db.delete(categoria)
    db.commit()
    return {"detail": "Categoria excluída com sucesso"}
