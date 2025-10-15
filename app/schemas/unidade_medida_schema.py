from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UnidadeMedidaBase(BaseModel):
    nome: str
    sigla: str
    permite_decimal: bool = True


class UnidadeMedidaCreate(UnidadeMedidaBase):
    pass


class UnidadeMedidaUpdate(BaseModel):
    nome: Optional[str] = None
    sigla: Optional[str] = None
    permite_decimal: Optional[bool] = None


class UnidadeMedidaOut(UnidadeMedidaBase):
    id: UUID
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)
