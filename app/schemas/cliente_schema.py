from typing import List, Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

# IMPORTANTE: use EnderecoBase aqui (sem cliente_id)
from app.schemas.endereco_schema import EnderecoBase, EnderecoOut


class ClienteBase(BaseModel):
    # 🔹 incluir o campo para alinhar com a coluna NOT NULL/UNIQUE do banco
    codigo_cliente: Optional[str] = None
    nome: str
    tipo_pessoa: str  # 'F' (Física) ou 'J' (Jurídica)
    cpf_cnpj: str
    telefone: Optional[str] = None
    email: Optional[EmailStr] = None


class ClienteCreate(ClienteBase):
    # Endereços aninhados não têm cliente_id ainda
    enderecos: List[EnderecoBase] = []


class ClienteUpdate(BaseModel):
    # atualização parcial (não obriga todos os campos)
    codigo_cliente: Optional[str] = None
    nome: Optional[str] = None
    tipo_pessoa: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[EmailStr] = None
    enderecos: Optional[List[EnderecoBase]] = None


class ClienteOut(ClienteBase):
    id: UUID
    # garantir retorno do código já normalizado
    codigo_cliente: str
    criado_em: datetime
    enderecos: List[EnderecoOut] = []

    class Config:
        from_attributes = True
