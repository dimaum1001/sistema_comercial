from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, status, Header
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from app.schemas.usuario_schema import UsuarioCreate, UsuarioLogin, UsuarioOut
from app.models.models import Produto, Usuario, Venda, VendaItem
from app.db.database import SessionLocal
from app.auth.auth_handler import criar_token, verificar_token
from app.schemas.venda_schema import VendaCreate, VendaResponse


router = APIRouter()

# Dependência para obter uma sessão do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_usuario_autenticado(
    db: Session = Depends(get_db),
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    
    token = authorization[7:]
    payload = verificar_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    usuario_id = payload.get("sub")
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario


@router.post("/login")
def login(usuario: UsuarioLogin, db: Session = Depends(get_db)):
    db_usuario = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if not db_usuario or not bcrypt.verify(usuario.senha, db_usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    token = criar_token({"sub": str(db_usuario.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register", response_model=UsuarioOut, status_code=201)
def criar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == usuario.email).first():
        raise HTTPException(status_code=400, detail="Email já registrado")
    
    tipo_normalizado = usuario.tipo.strip().lower()  # 🔥 sempre minúsculo
    if tipo_normalizado not in ["cliente", "admin"]:
        raise HTTPException(status_code=400, detail="Tipo de usuário inválido")
    
    novo_usuario = Usuario(
        nome=usuario.nome,
        email=usuario.email,
        senha_hash=bcrypt.hash(usuario.senha),
        tipo=tipo_normalizado,
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    return UsuarioOut.model_validate(novo_usuario)




@router.get("/me", response_model=UsuarioOut)
def get_me(usuario: Usuario = Depends(get_usuario_autenticado)):
    return usuario


