from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, AliasChoices, field_validator

class FornecedorBase(BaseModel):
    # código interno numérico zero-padded (opcional na entrada)
    codigo_fornecedor: Optional[str] = Field(default=None, alias="codigoFornecedor")

    # nome pode vir como "nome" ou "razao_social"
    nome: str = Field(validation_alias=AliasChoices("nome", "razao_social"))

    # cnpj pode vir como "cnpj_cpf", "cnpjCpf" ou "cnpj"
    cnpj_cpf: str = Field(validation_alias=AliasChoices("cnpj_cpf", "cnpjCpf", "cnpj"))

    # inscrição pode vir como "inscricao_estadual" ou "inscricaoEstadual"
    inscricao_estadual: Optional[str] = Field(default=None, alias="inscricaoEstadual")

    telefone: Optional[str] = None
    email: Optional[EmailStr] = None
    site: Optional[str] = None

    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    pais: Optional[str] = "Brasil"

    # contatos (camelCase aceito)
    contato_nome: Optional[str] = Field(default=None, alias="contatoNome")
    contato_cargo: Optional[str] = Field(default=None, alias="contatoCargo")
    contato_email: Optional[EmailStr] = Field(default=None, alias="contatoEmail")
    contato_telefone: Optional[str] = Field(default=None, alias="contatoTelefone")

    # aceitar aliases e ignorar campos extras (ex.: nome_fantasia, enderecos, etc.)
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @field_validator("cnpj_cpf", "telefone", "contato_telefone", mode="before")
    @classmethod
    def _digits_only(cls, v):
        if v is None:
            return v
        s = str(v)
        return "".join(ch for ch in s if ch.isdigit())


class FornecedorCreate(FornecedorBase):
    pass


class FornecedorUpdate(BaseModel):
    codigo_fornecedor: Optional[str] = Field(default=None, alias="codigoFornecedor")
    nome: Optional[str] = Field(default=None, validation_alias=AliasChoices("nome", "razao_social"))
    cnpj_cpf: Optional[str] = Field(default=None, validation_alias=AliasChoices("cnpj_cpf", "cnpjCpf", "cnpj"))
    inscricao_estadual: Optional[str] = Field(default=None, alias="inscricaoEstadual")

    telefone: Optional[str] = None
    email: Optional[EmailStr] = None
    site: Optional[str] = None

    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    pais: Optional[str] = None

    contato_nome: Optional[str] = Field(default=None, alias="contatoNome")
    contato_cargo: Optional[str] = Field(default=None, alias="contatoCargo")
    contato_email: Optional[EmailStr] = Field(default=None, alias="contatoEmail")
    contato_telefone: Optional[str] = Field(default=None, alias="contatoTelefone")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @field_validator("cnpj_cpf", "telefone", "contato_telefone", mode="before")
    @classmethod
    def _digits_only_update(cls, v):
        if v is None:
            return v
        s = str(v)
        return "".join(ch for ch in s if ch.isdigit())


class FornecedorOut(FornecedorBase):
    id: UUID
    codigo_fornecedor: str
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
