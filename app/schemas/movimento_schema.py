from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class FornecedorOut(BaseModel):
    id: UUID
    nome: str

    class Config:
        from_attributes = True


class ProdutoOutMovimento(BaseModel):
    id: UUID
    nome: str
    fornecedor: Optional[FornecedorOut]  # 🔹 incluir fornecedor

    class Config:
        from_attributes = True


class MovimentoCreate(BaseModel):
    produto_id: UUID
    tipo: str   # entrada, saida, ajuste
    quantidade: int
    observacao: Optional[str] = None


class MovimentoResponse(BaseModel):
    id: UUID
    tipo: str
    quantidade: int
    data_movimento: datetime
    observacao: Optional[str] = None
    produto: ProdutoOutMovimento  # 🔹 produto já vem com fornecedor

    class Config:
        from_attributes = True
