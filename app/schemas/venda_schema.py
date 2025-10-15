from pydantic import BaseModel, confloat
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID

# ---------- Entrada ----------

class VendaItemCreate(BaseModel):
    produto_id: UUID
    quantidade: confloat(gt=0)  # type: ignore
    preco_unit: Optional[float] = None


class PagamentoCreate(BaseModel):
    forma_pagamento: str
    valor: float
    status: Optional[str] = "pendente"
    data_vencimento: Optional[date] = None
    parcela_numero: Optional[int] = None
    parcela_total: Optional[int] = None
    observacao: Optional[str] = None


class VendaCreate(BaseModel):
    cliente_id: Optional[UUID] = None
    desconto: float = 0
    acrescimo: float = 0
    observacao: Optional[str] = None
    itens: List[VendaItemCreate]
    pagamentos: Optional[List[PagamentoCreate]] = []


# ---------- Saída ----------

class ClienteOut(BaseModel):
    id: UUID
    nome: str

    class Config:
        from_attributes = True


class VendaItemOut(BaseModel):
    id: UUID
    produto_id: UUID
    quantidade: float
    preco_unit: float

    class Config:
        from_attributes = True


class PagamentoOut(BaseModel):
    id: UUID
    forma_pagamento: str
    valor: float
    status: str
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[datetime] = None
    parcela_numero: Optional[int] = None
    parcela_total: Optional[int] = None
    observacao: Optional[str] = None

    # 🔹 adiciona cliente no retorno
    venda: Optional["VendaClienteOut"] = None

    class Config:
        from_attributes = True


class VendaClienteOut(BaseModel):
    id: UUID
    cliente: Optional[ClienteOut] = None

    class Config:
        from_attributes = True


class VendaResponse(BaseModel):
    id: UUID
    cliente_id: Optional[UUID] = None
    cliente: Optional[ClienteOut] = None
    usuario_id: Optional[UUID] = None
    data_venda: datetime
    total: float
    desconto: float
    acrescimo: float
    observacao: Optional[str] = None
    itens: List[VendaItemOut] = []
    pagamentos: List[PagamentoOut] = []

    class Config:
        from_attributes = True
