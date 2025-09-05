from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID


# ========================
# Base Produto
# ========================
class ProdutoBase(BaseModel):
    nome: Optional[str] = None
    codigo_barras: Optional[str] = None
    custo: Optional[float] = None
    estoque: Optional[int] = None
    estoque_minimo: Optional[int] = None
    unidade: Optional[str] = None
    marca: Optional[str] = None
    localizacao: Optional[str] = None
    data_validade: Optional[date] = None
    ativo: Optional[bool] = True
    categoria_id: Optional[UUID] = None
    fornecedor_id: Optional[UUID] = None


class ProdutoCreate(ProdutoBase):
    nome: str
    preco_venda: Optional[float] = None   # opcional, porque será gerenciado em PrecoProduto


class ProdutoUpdate(ProdutoBase):
    preco_venda: Optional[float] = None


# ========================
# Produto Resumido (uso em Preço)
# ========================
class ProdutoResumo(BaseModel):
    id: UUID
    nome: str

    class Config:
        from_attributes = True


# ========================
# Histórico de Preços
# ========================
class PrecoProdutoCreate(BaseModel):
    produto_id: UUID
    preco: float
    ativo: Optional[bool] = True


class PrecoProdutoOut(BaseModel):
    id: UUID
    produto_id: UUID
    preco: float
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    ativo: bool
    produto: Optional[ProdutoResumo]  # 🔹 inclui dados básicos do produto

    class Config:
        from_attributes = True


# ========================
# Fornecedor (uso em ProdutoOut)
# ========================
class FornecedorOut(BaseModel):
    id: UUID
    nome: str

    class Config:
        from_attributes = True


# ========================
# Produto com relacionamentos
# ========================
class ProdutoOut(ProdutoBase):
    id: UUID
    preco_venda: Optional[float]
    criado_em: datetime
    atualizado_em: datetime
    fornecedor: Optional[FornecedorOut]
    precos: List[PrecoProdutoOut] = []

    class Config:
        from_attributes = True
