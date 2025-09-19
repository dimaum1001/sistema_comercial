from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

class EnderecoFornecedorBase(BaseModel):
    fornecedor_id: UUID = Field(..., description="ID do fornecedor")
    tipo_endereco: Optional[str] = Field(default="comercial")
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = Field(None, min_length=2, max_length=2)
    cep: Optional[str] = None
    pais: Optional[str] = "Brasil"

class EnderecoFornecedorCreate(EnderecoFornecedorBase):
    pass

class EnderecoFornecedorUpdate(BaseModel):
    tipo_endereco: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = Field(None, min_length=2, max_length=2)
    cep: Optional[str] = None
    pais: Optional[str] = None

class EnderecoFornecedorOut(EnderecoFornecedorBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)
