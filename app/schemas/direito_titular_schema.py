from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class DataSubjectRight(str, Enum):
    ACESSO = "acesso"
    CORRECAO = "correcao"
    EXCLUSAO = "exclusao"
    PORTABILIDADE = "portabilidade"
    REVOGACAO_CONSENTIMENTO = "revogacao_consentimento"


class DataSubjectRequestStatus(str, Enum):
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    CONCLUIDO = "concluido"
    INDEFERIDO = "indeferido"


class DataSubjectEventType(str, Enum):
    REGISTRADO = "registrado"
    STATUS_ATUALIZADO = "status_atualizado"
    RESPOSTA_ENVIADA = "resposta_enviada"
    ANOTACAO = "anotacao"


class DpoContactStatus(str, Enum):
    NOVO = "novo"
    EM_ATENDIMENTO = "em_atendimento"
    CONCLUIDO = "concluido"


ALLOWED_RIGHTS: List[str] = [right.value for right in DataSubjectRight]


class DataSubjectRequestBase(BaseModel):
    titular_tipo: str = Field(..., min_length=2, max_length=50)
    titular_identificador: str = Field(..., min_length=1, max_length=120)
    titular_nome: Optional[str] = Field(None, max_length=150)
    titular_email: Optional[EmailStr] = None
    justificativa: Optional[str] = None


class DataSubjectRequestCreate(DataSubjectRequestBase):
    direito: DataSubjectRight


class DataSubjectRequestOut(DataSubjectRequestBase):
    id: UUID
    direito: DataSubjectRight
    status: DataSubjectRequestStatus
    prazo_resposta: datetime
    respondido_em: Optional[datetime] = None
    criado_em: datetime
    atualizado_em: datetime
    fora_do_prazo: bool

    class Config:
        from_attributes = True


class DataSubjectRequestList(BaseModel):
    total: int
    itens: List[DataSubjectRequestOut]


class DataSubjectStatusUpdate(BaseModel):
    status: DataSubjectRequestStatus
    descricao: Optional[str] = None
    resposta_entregue_em: Optional[datetime] = None


class DataSubjectEventCreate(BaseModel):
    tipo_evento: DataSubjectEventType
    descricao: Optional[str] = None


class DataSubjectEventOut(BaseModel):
    id: UUID
    solicitacao_id: UUID
    tipo_evento: DataSubjectEventType
    descricao: Optional[str] = None
    responsavel_usuario_id: Optional[UUID] = None
    criado_em: datetime

    class Config:
        from_attributes = True


class DpoInfo(BaseModel):
    nome: str
    email: EmailStr
    telefone: Optional[str] = None
    canal_preferencial: str
    horario_atendimento: Optional[str] = None
    canal_alternativo: Optional[str] = None


class DpoContactCreate(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    assunto: Optional[str] = Field(None, max_length=120)
    mensagem: str = Field(..., min_length=10, max_length=4000)


class DpoContactAck(BaseModel):
    protocolo: str
    recebida_em: datetime
    prazo_resposta: datetime


class DpoContactOut(BaseModel):
    id: UUID
    protocolo: str
    nome: str
    email: EmailStr
    assunto: Optional[str] = None
    mensagem: str
    canal: str
    status: DpoContactStatus
    resposta: Optional[str] = None
    recebida_em: datetime
    atualizada_em: datetime
    respondida_em: Optional[datetime] = None
    responsavel_usuario_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class DpoContactStatusUpdate(BaseModel):
    status: Optional[DpoContactStatus] = None
    resposta: Optional[str] = None
    respondida_em: Optional[datetime] = None


class DpoContactList(BaseModel):
    total: int
    itens: List[DpoContactOut]
