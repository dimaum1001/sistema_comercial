from pydantic import BaseModel, EmailStr
from pydantic.types import StringConstraints
from typing import Annotated, Literal
from datetime import datetime
from uuid import UUID

class UsuarioCreate(BaseModel):
    nome: Annotated[str, StringConstraints(min_length=3, strip_whitespace=True)]
    email: EmailStr
    senha: Annotated[str, StringConstraints(min_length=6)]   # mínimo 6 caracteres
    tipo: Literal["admin", "cliente", "financeiro", "estoque", "vendas"]


class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str


class UsuarioOut(BaseModel):
    id: UUID
    nome: str
    email: str
    tipo: str
    criado_em: datetime

    class Config:
        from_attributes = True
