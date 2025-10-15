from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


class FornecedorOut(BaseModel):
    id: UUID
    nome: str

    model_config = ConfigDict(from_attributes=True)


class ProdutoOutMovimento(BaseModel):
    id: UUID
    nome: str
    # O modelo ORM tem relationship "fornecedor_obj".
    # Vamos ler "fornecedor_obj" e SERIALIZAR como "fornecedor" no JSON.
    fornecedor_obj: Optional[FornecedorOut] = Field(default=None, serialization_alias="fornecedor")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class MovimentoCreate(BaseModel):
    produto_id: UUID
    tipo: str   # entrada, saida, ajuste
    quantidade: float
    observacao: Optional[str] = None
    custo_unitario: Optional[float] = Field(default=None, ge=0)


class MovimentoResponse(BaseModel):
    id: UUID
    tipo: str
    quantidade: float
    data_movimento: datetime
    observacao: Optional[str] = None
    custo_unitario: Optional[float] = None
    valor_total: Optional[float] = None
    produto: ProdutoOutMovimento  # produto já vem com fornecedor (serializado como "fornecedor")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

