from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from uuid import UUID
from datetime import datetime

# Schema base (campos comuns)
class FornecedorBase(BaseModel):
    nome: str
    cnpj_cpf: str  # obrigatório
    inscricao_estadual: Optional[str] = None

    telefone: Optional[str] = None
    email: Optional[EmailStr] = None
    site: Optional[str] = None

    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    pais: Optional[str] = "Brasil"

    contato_nome: Optional[str] = None
    contato_cargo: Optional[str] = None
    contato_email: Optional[EmailStr] = None
    contato_telefone: Optional[str] = None

    # 🔹 Limpa máscara de CNPJ/CPF e telefone automaticamente
    @validator("cnpj_cpf", "telefone", "contato_telefone", pre=True)
    def clean_numbers(cls, v):
        if v:
            return "".join(filter(str.isdigit, str(v)))
        return v

# Criar fornecedor
class FornecedorCreate(FornecedorBase):
    pass

# Atualizar fornecedor
class FornecedorUpdate(FornecedorBase):
    pass

# Saída (response)
class FornecedorOut(FornecedorBase):
    id: UUID
    criado_em: Optional[datetime]
    atualizado_em: Optional[datetime]

    class Config:
        from_attributes = True
