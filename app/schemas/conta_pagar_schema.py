"""
Esquema Pydantic para o modelo de ContaPagar.

Este arquivo define os modelos de entrada e saída utilizados pelas rotas
de contas a pagar. Ele segue a convenção dos demais esquemas da aplicação,
permitindo conversão fácil entre objetos ORM e respostas JSON.
"""

from datetime import date, datetime
from typing import Optional
import uuid

from pydantic import BaseModel, Field


class ContaPagarBase(BaseModel):
    """Campos compartilhados entre criações e atualizações de contas a pagar."""

    fornecedor_id: uuid.UUID = Field(..., description="UUID do fornecedor associado")
    descricao: Optional[str] = Field(None, description="Descrição opcional da dívida")
    valor: float = Field(..., gt=0, description="Valor da conta a pagar")
    data_vencimento: date = Field(..., description="Data de vencimento da conta")
    status: str = Field("pendente", description="Status da conta (pendente, paga, etc.)")
    data_pagamento: Optional[datetime] = Field(None, description="Data em que a conta foi paga")


class ContaPagarCreate(ContaPagarBase):
    """Modelo utilizado para criação de novas contas a pagar."""

    pass


class ContaPagarUpdate(BaseModel):
    """Modelo para atualização parcial de contas a pagar.

    Todos os campos são opcionais para permitir atualizações parciais.
    """

    fornecedor_id: Optional[uuid.UUID] = None
    descricao: Optional[str] = None
    valor: Optional[float] = Field(None, gt=0)
    data_vencimento: Optional[date] = None
    status: Optional[str] = None
    data_pagamento: Optional[datetime] = None


class ContaPagar(ContaPagarBase):
    """Modelo de saída para contas a pagar, incluindo o ID."""

    id: uuid.UUID

    class Config:
        from_attributes = True