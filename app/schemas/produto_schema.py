from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from pydantic import ConfigDict

# ========================
# Base Produto
# ========================
class ProdutoBase(BaseModel):
    # Mantemos opcional (o backend gera quando ausente)
    codigo_produto: Optional[str] = None
    nome: Optional[str] = None
    codigo_barras: Optional[str] = None
    custo: Optional[float] = None
    custo_medio: Optional[float] = None
    preco_venda: Optional[float] = None  # <- já aqui para evitar repetição
    estoque: Optional[int] = None
    estoque_minimo: Optional[int] = None
    unidade: Optional[str] = None
    marca: Optional[str] = None
    localizacao: Optional[str] = None
    data_validade: Optional[date] = None
    ativo: Optional[bool] = True

    # Relacionamentos/refs
    categoria_id: Optional[UUID] = None
    fornecedor_id: Optional[UUID] = None

    # 🔹 Campo texto que existe no Model (nome livre do fornecedor)
    fornecedor: Optional[str] = None

class ProdutoCreate(ProdutoBase):
    # nome obrigatório na criação
    nome: str

class ProdutoUpdate(ProdutoBase):
    # tudo opcional (atualização parcial via PUT/PATCH no backend)
    pass

# ========================
# Produto Resumido (uso em Preço)
# ========================
class ProdutoResumo(BaseModel):
    id: UUID
    nome: str
    model_config = ConfigDict(from_attributes=True)

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
    # Mantemos opcional: será carregado se o backend fizer joinedload ou via lazy
    produto: Optional[ProdutoResumo] = None
    model_config = ConfigDict(from_attributes=True)

# ========================
# Fornecedor (uso em ProdutoOut)
# ========================
class FornecedorOut(BaseModel):
    id: UUID
    nome: str
    model_config = ConfigDict(from_attributes=True)

class CategoriaOut(BaseModel):
    id: UUID
    nome: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# ========================
# Produto com relacionamentos
# ========================
class ProdutoOut(ProdutoBase):
    id: UUID
    codigo_produto: str
    criado_em: datetime
    atualizado_em: datetime

    # ✅ Relacionamentos completos (sem alias para não conflitar com `fornecedor` texto)
    fornecedor_obj: Optional[FornecedorOut] = None
    categoria: Optional[CategoriaOut] = None

    # Histórico de preços
    precos: List[PrecoProdutoOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
