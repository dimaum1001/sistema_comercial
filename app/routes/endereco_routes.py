from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.auth.deps import get_current_user
from app.models.models import Endereco, Cliente
from app.schemas.endereco_schema import EnderecoCreate, EnderecoOut

router = APIRouter(prefix="/enderecos", tags=["EndereÃ§os"], dependencies=[Depends(get_current_user)])


# DependÃªncia de sessÃ£o
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=EnderecoOut, status_code=201)
def criar_endereco(endereco: EnderecoCreate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == endereco.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nÃ£o encontrado")

    novo_endereco = Endereco(**endereco.dict())
    db.add(novo_endereco)
    db.commit()
    db.refresh(novo_endereco)
    return novo_endereco


@router.get("/cliente/{cliente_id}", response_model=list[EnderecoOut])
def listar_enderecos(cliente_id: str, db: Session = Depends(get_db)):
    enderecos = db.query(Endereco).filter(Endereco.cliente_id == cliente_id).all()
    return enderecos


@router.delete("/{endereco_id}", status_code=204)
def deletar_endereco(endereco_id: str, db: Session = Depends(get_db)):
    endereco = db.query(Endereco).filter(Endereco.id == endereco_id).first()
    if not endereco:
        raise HTTPException(status_code=404, detail="EndereÃ§o nÃ£o encontrado")

    db.delete(endereco)
    db.commit()
    return None

