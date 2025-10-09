"""
Rotas para gerenciamento de categorias.

Fornece endpoints para criar, listar, obter, atualizar e deletar categorias de
produtos. Implementa paginaÃ§Ã£o na listagem para melhorar a escalabilidade em
bases grandes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.auth.deps import get_current_user
from app.models.models import Categoria
from app.schemas.categoria_schema import CategoriaCreate, CategoriaOut


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/categorias", response_model=CategoriaOut)
def criar_categoria(categoria: CategoriaCreate, db: Session = Depends(get_db)) -> Categoria:
    """Cria uma nova categoria se ainda nÃ£o existir outra com o mesmo nome."""
    existe = db.query(Categoria).filter(Categoria.nome == categoria.nome).first()
    if existe:
        raise HTTPException(status_code=400, detail="Categoria jÃ¡ existe")
    nova_categoria = Categoria(nome=categoria.nome)
    db.add(nova_categoria)
    db.commit()
    db.refresh(nova_categoria)
    return nova_categoria


@router.get("/categorias", response_model=List[CategoriaOut])
def listar_categorias(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[Categoria]:
    """Lista categorias com suporte a paginaÃ§Ã£o."""
    return db.query(Categoria).offset(skip).limit(limit).all()


@router.get("/categorias/{categoria_id}", response_model=CategoriaOut)
def obter_categoria(categoria_id: UUID, db: Session = Depends(get_db)) -> Categoria:
    """ObtÃ©m uma categoria pelo seu ID."""
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nÃ£o encontrada")
    return categoria


@router.put("/categorias/{categoria_id}", response_model=CategoriaOut)
def atualizar_categoria(categoria_id: UUID, categoria_data: CategoriaCreate, db: Session = Depends(get_db)) -> Categoria:
    """Atualiza o nome de uma categoria, garantindo unicidade."""
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nÃ£o encontrada")

    # Verifica se jÃ¡ existe outra categoria com o mesmo nome
    existe = db.query(Categoria).filter(Categoria.nome == categoria_data.nome, Categoria.id != categoria_id).first()
    if existe:
        raise HTTPException(status_code=400, detail="JÃ¡ existe uma categoria com esse nome")

    categoria.nome = categoria_data.nome
    db.commit()
    db.refresh(categoria)
    return categoria


@router.delete("/categorias/{categoria_id}", status_code=204)
def deletar_categoria(categoria_id: UUID, db: Session = Depends(get_db)):
    """Remove uma categoria do banco de dados."""
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nÃ£o encontrada")
    db.delete(categoria)
    db.commit()
    return {"detail": "Categoria excluÃ­da com sucesso"}
