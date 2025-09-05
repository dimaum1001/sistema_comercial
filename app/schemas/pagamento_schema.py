from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class ClienteOut(BaseModel):
    id: UUID
    nome: str

    class Config:
        from_attributes = True


class VendaResumo(BaseModel):
    id: UUID
    cliente: Optional[ClienteOut] = None

    class Config:
        from_attributes = True


class PagamentoBase(BaseModel):
    forma_pagamento: str
    valor: float
    data_vencimento: Optional[date] = None
    parcela_numero: Optional[int] = None
    parcela_total: Optional[int] = None
    observacao: Optional[str] = None


class PagamentoCreate(PagamentoBase):
    venda_id: UUID
    status: Optional[str] = "pendente"  # padrão


class PagamentoUpdate(BaseModel):
    status: Optional[str] = None  # pendente, pago, cancelado
    data_pagamento: Optional[datetime] = None
    observacao: Optional[str] = None


class PagamentoOut(PagamentoBase):
    id: UUID
    venda_id: UUID
    status: str
    data_pagamento: Optional[datetime] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None
    venda: Optional[VendaResumo] = None  # 🔹 inclui cliente no retorno

    class Config:
        from_attributes = True
