from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, AliasChoices, field_validator

BASES_LEGAIS_FORNECEDOR = Literal["execucao_contrato", "obrigacao_legal", "legitimo_interesse", "consentimento"]

# Entrada de endereço vinda do formulário (NÃO exige fornecedor_id)
class EnderecoFornecedorIn(BaseModel):
    tipo_endereco: Optional[str] = "comercial"
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    pais: Optional[str] = "Brasil"

class FornecedorBase(BaseModel):
    # código interno zero-padded (opcional na entrada)
    codigo_fornecedor: Optional[str] = Field(default=None, alias="codigoFornecedor")

    # tipo de pessoa: F/J (default J)
    tipo_pessoa: str = Field(default="J", pattern="^[FJ]$")

    # razão social obrigatória (aceita snake/camel)
    razao_social: str = Field(validation_alias=AliasChoices("razao_social", "razaoSocial"))

    # nome fantasia (opcional). Aceita 'nome', 'nome_fantasia', 'nomeFantasia'
    nome: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("nome", "nome_fantasia", "nomeFantasia"),
    )

    # cnpj/cpf (aceita variações de nome do front)
    cnpj_cpf: str = Field(
        validation_alias=AliasChoices("cnpj_cpf", "cnpjCpf", "cnpj", "cpf")
    )

    inscricao_estadual: Optional[str] = Field(default=None, alias="inscricaoEstadual")

    telefone: Optional[str] = None
    email: Optional[EmailStr] = None
    site: Optional[str] = None

    # contatos (camelCase aceito)
    contato_nome: Optional[str] = Field(default=None, alias="contatoNome")
    contato_cargo: Optional[str] = Field(default=None, alias="contatoCargo")
    contato_email: Optional[EmailStr] = Field(default=None, alias="contatoEmail")
    contato_telefone: Optional[str] = Field(default=None, alias="contatoTelefone")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @field_validator("cnpj_cpf", "telefone", "contato_telefone", mode="before")
    @classmethod
    def _digits_only(cls, v):
        if v is None:
            return v
        return "".join(ch for ch in str(v) if ch.isdigit())

class FornecedorCreate(FornecedorBase):
    # permite criação com endereços já no payload (sem fornecedor_id)
    enderecos: Optional[List[EnderecoFornecedorIn]] = None
    base_legal_tratamento: BASES_LEGAIS_FORNECEDOR = "execucao_contrato"
    consentimento_registrado_em: Optional[datetime] = None

class FornecedorUpdate(BaseModel):
    base_legal_tratamento: Optional[BASES_LEGAIS_FORNECEDOR] = None
    consentimento_registrado_em: Optional[datetime] = None
    codigo_fornecedor: Optional[str] = Field(default=None, alias="codigoFornecedor")
    tipo_pessoa: Optional[str] = Field(default=None, pattern="^[FJ]$")
    razao_social: Optional[str] = Field(default=None, validation_alias=AliasChoices("razao_social", "razaoSocial"))
    nome: Optional[str] = Field(default=None, validation_alias=AliasChoices("nome", "nome_fantasia", "nomeFantasia"))
    cnpj_cpf: Optional[str] = Field(default=None, validation_alias=AliasChoices("cnpj_cpf", "cnpjCpf", "cnpj", "cpf"))
    inscricao_estadual: Optional[str] = Field(default=None, alias="inscricaoEstadual")

    telefone: Optional[str] = None
    email: Optional[EmailStr] = None
    site: Optional[str] = None

    contato_nome: Optional[str] = Field(default=None, alias="contatoNome")
    contato_cargo: Optional[str] = Field(default=None, alias="contatoCargo")
    contato_email: Optional[EmailStr] = Field(default=None, alias="contatoEmail")
    contato_telefone: Optional[str] = Field(default=None, alias="contatoTelefone")

    # substituição opcional de todos os endereços
    enderecos: Optional[List[EnderecoFornecedorIn]] = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @field_validator("cnpj_cpf", "telefone", "contato_telefone", mode="before")
    @classmethod
    def _digits_only_update(cls, v):
        if v is None:
            return v
        return "".join(ch for ch in str(v) if ch.isdigit())

class FornecedorOut(FornecedorBase):
    id: UUID
    codigo_fornecedor: str
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    base_legal_tratamento: str
    consentimento_registrado_em: Optional[datetime] = None

    # devolvemos endereços quando consultado/listado
    enderecos: Optional[list[EnderecoFornecedorIn]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
