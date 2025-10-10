from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

# IMPORTANTE: use EnderecoBase aqui (sem cliente_id)
from app.schemas.endereco_schema import EnderecoBase, EnderecoOut


BASES_LEGAIS = Literal["execucao_contrato", "obrigacao_legal", "legitimo_interesse", "consentimento"]


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
    base_legal_tratamento: BASES_LEGAIS = "execucao_contrato"
    consentimento_registrado_em: Optional[datetime] = None


class ClienteUpdate(BaseModel):
    # atualizaçao parcial (não obriga todos os campos)
    base_legal_tratamento: Optional[BASES_LEGAIS] = None
    consentimento_registrado_em: Optional[datetime] = None
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
    base_legal_tratamento: str
    consentimento_registrado_em: Optional[datetime] = None
    enderecos: List[EnderecoOut] = []

    class Config:
        from_attributes = True
