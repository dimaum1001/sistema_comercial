from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class EnderecoBase(BaseModel):
    tipo_endereco: Optional[str] = "residencial"
    cep: str
    logradouro: str
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: str
    estado: str
    pais: str

class EnderecoCreate(EnderecoBase):
    # Usado quando criamos endereço de forma independente da criação do cliente
    cliente_id: UUID

class EnderecoOut(EnderecoBase):
    id: UUID
    criado_em: datetime

    class Config:
        from_attributes = True
