from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from pydantic import ConfigDict

# ========================
# Base Produto
# ========================
class ProdutoBase(BaseModel):
    # 🔹 Incluímos codigo_produto para alinhar com NOT NULL/UNIQUE do banco
    codigo_produto: Optional[str] = None
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
    preco_venda: Optional[float] = None

class ProdutoUpdate(ProdutoBase):
    preco_venda: Optional[float] = None

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
    produto: Optional[ProdutoResumo]  # inclui dados básicos do produto
    model_config = ConfigDict(from_attributes=True)

# ========================
# Fornecedor (uso em ProdutoOut)
# ========================
class FornecedorOut(BaseModel):
    id: UUID
    nome: str
    model_config = ConfigDict(from_attributes=True)

# (Opcional) Categoria no output, se você quiser expor o objeto também
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
    preco_venda: Optional[float]
    criado_em: datetime
    atualizado_em: datetime

    # ✅ Pegamos a relação ORM `fornecedor_obj` e serializamos como "fornecedor"
    fornecedor_obj: Optional[FornecedorOut] = Field(
        default=None,
        serialization_alias="fornecedor"
    )

    # (Opcional) Se sua relação chama `categoria`, serialize como "categoria"
    # categoria: Optional[CategoriaOut] = None
    # Se no ORM o nome for `categoria` está ok; se for `categoria_obj`, use:
    # categoria_obj: Optional[CategoriaOut] = Field(default=None, serialization_alias="categoria")

    # Evitar lista mutável como default
    precos: List[PrecoProdutoOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
