# app/schemas/cliente_schema.py
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

# IMPORTANTE: use EnderecoBase aqui (sem cliente_id)
from app.schemas.endereco_schema import EnderecoBase, EnderecoOut

class ClienteBase(BaseModel):
    nome: str
    tipo_pessoa: str  # 'F' (Física) ou 'J' (Jurídica)
    cpf_cnpj: str
    telefone: Optional[str] = None
    email: Optional[EmailStr] = None

class ClienteCreate(ClienteBase):
    # Endereços aninhados não têm cliente_id ainda
    enderecos: List[EnderecoBase] = []

class ClienteOut(ClienteBase):
    id: UUID
    criado_em: datetime
    enderecos: List[EnderecoOut] = []

    class Config:
        from_attributes = True
