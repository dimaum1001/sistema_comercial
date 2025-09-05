from pydantic import BaseModel
from uuid import UUID

class CategoriaBase(BaseModel):
    nome: str

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaOut(CategoriaBase):
    id: UUID

    class Config:
        from_attributes = True