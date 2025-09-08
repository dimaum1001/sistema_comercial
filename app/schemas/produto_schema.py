from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID

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
    # nome é obrigatório para criação
    nome: str
    # opcional, pois há histórico em PrecoProduto; também é salvo em cache em Produto
    preco_venda: Optional[float] = None


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
    produto: Optional[ProdutoResumo]  # inclui dados básicos do produto

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
    # garantir que aparece no output
    codigo_produto: str
    preco_venda: Optional[float]
    criado_em: datetime
    atualizado_em: datetime
    # OBS: no seu modelo SQLAlchemy a relação chama-se fornecedor_obj.
    # Se quiser que aqui seja "fornecedor", mantenha assim e ajuste o modelo
    # para expor um @property fornecedor ou um relationship com esse nome.
    fornecedor: Optional[FornecedorOut] = None
    precos: List[PrecoProdutoOut] = []

    class Config:
        from_attributes = True
