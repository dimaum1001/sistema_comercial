from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models import models
from app.models.models import Cliente, Endereco
from app.schemas.cliente_schema import ClienteCreate, ClienteOut
from typing import List
from uuid import UUID

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/clientes", response_model=ClienteOut)
def criar_cliente(cliente: ClienteCreate, db: Session = Depends(get_db)):
    # validação de duplicidade
    if db.query(Cliente).filter(Cliente.cpf_cnpj == cliente.cpf_cnpj).first():
        raise HTTPException(status_code=400, detail="CPF/CNPJ já cadastrado")

    novo_cliente = Cliente(
        nome=cliente.nome,
        tipo_pessoa=cliente.tipo_pessoa,  # 'F' ou 'J'
        cpf_cnpj=cliente.cpf_cnpj,
        telefone=cliente.telefone,
        email=cliente.email,
    )
    db.add(novo_cliente)
    db.commit()
    db.refresh(novo_cliente)

    # cria endereços vinculados ao cliente recém-criado
    for end in cliente.enderecos:
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
    db.refresh(novo_cliente)  # garante o relacionamento atualizado no retorno

    return novo_cliente

@router.get("/clientes", response_model=List[ClienteOut])
def listar_clientes(db: Session = Depends(get_db)):
    clientes = db.query(Cliente).all()
    return clientes

# Buscar cliente por ID → GET /clientes/{id}
@router.get("/clientes/{cliente_id}", response_model=ClienteOut)
def get_cliente(cliente_id: UUID, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente

# Excluir cliente → DELETE /clientes/{id}
@router.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: UUID, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    db.delete(cliente)
    db.commit()
    return {"message": "Cliente excluído com sucesso"}

# Atualizar cliente → PUT /clientes/{id}
@router.put("/clientes/{cliente_id}", response_model=ClienteOut)
def atualizar_cliente(cliente_id: UUID, cliente_update: ClienteCreate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    # Atualiza dados principais
    cliente.nome = cliente_update.nome
    cliente.tipo_pessoa = cliente_update.tipo_pessoa
    cliente.cpf_cnpj = cliente_update.cpf_cnpj
    cliente.telefone = cliente_update.telefone
    cliente.email = cliente_update.email

    # Atualiza endereços → simplificado: remove antigos e recria
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

    db.commit()
    db.refresh(cliente)
    return cliente
