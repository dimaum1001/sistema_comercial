"""
Versão modificada de app/models/models.py com campos de código legível
para clientes, produtos e fornecedores e inclusão do modelo ContaPagar.

Esta implementação foi elaborada a partir do esquema original da aplicação.
Caso você tenha campos adicionais no arquivo original, integre-os conforme necessário.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    String,
    Numeric,
    Integer,
    ForeignKey,
    Text,
    DateTime,
    Boolean,
    Date,
    CHAR,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.db.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    senha_hash = Column(Text, nullable=False)
    tipo = Column(String, nullable=False)  # admin, cliente, financeiro, estoque, vendas
    criado_em = Column(DateTime, default=datetime.utcnow)

    vendas = relationship("Venda", back_populates="usuario")
    reset_tokens = relationship("PasswordResetToken", back_populates="usuario", cascade="all, delete-orphan")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    usado = Column(Boolean, default=False, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow, nullable=False)
    usado_em = Column(DateTime, nullable=True)

    usuario = relationship("Usuario", back_populates="reset_tokens")


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String, unique=True, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)

    produtos = relationship("Produto", back_populates="categoria")


class PrecoProduto(Base):
    __tablename__ = "precos_produto"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    produto_id = Column(UUID(as_uuid=True), ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False)
    preco = Column(Numeric(10, 2), nullable=False)
    data_inicio = Column(DateTime, default=datetime.utcnow, nullable=False)
    data_fim = Column(DateTime, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)

    produto = relationship("Produto", back_populates="precos")


class UnidadeMedida(Base):
    __tablename__ = "unidades_medida"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), nullable=False)
    sigla = Column(String(20), nullable=False, unique=True)
    permite_decimal = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow, nullable=False)

    produtos = relationship("Produto", back_populates="unidade_medida")


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Código legível de produto (ex.: PROD-0001)
    codigo_produto = Column(String(20), unique=True, nullable=False)
    nome = Column(String, nullable=False)
    estoque = Column(Numeric(12, 3), default=0)
    criado_em = Column(DateTime, default=datetime.utcnow)
    categoria_id = Column(UUID(as_uuid=True), ForeignKey("categorias.id"), nullable=True)
    codigo_barras = Column(String(50), nullable=True)
    custo = Column(Numeric(10, 2), nullable=True)
    custo_medio = Column(Numeric(10, 2), nullable=True)
    preco_venda = Column(Numeric(10, 2), nullable=True)
    unidade_id = Column(UUID(as_uuid=True), ForeignKey("unidades_medida.id"), nullable=True)
    marca = Column(String(100), nullable=True)
    fornecedor = Column(String(100), nullable=True)  # nome textual opcional
    estoque_minimo = Column(Integer, nullable=True)
    localizacao = Column(String(100), nullable=True)
    data_validade = Column(Date, nullable=True)
    ativo = Column(Boolean, default=True)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    fornecedor_id = Column(UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True)

    # Relacionamentos
    categoria = relationship("Categoria", back_populates="produtos")
    fornecedor_obj = relationship("Fornecedor", back_populates="produtos")
    itens_venda = relationship("VendaItem", back_populates="produto")
    movimentos = relationship("MovimentoEstoque", back_populates="produto", cascade="all, delete-orphan")
    precos = relationship("PrecoProduto", back_populates="produto", cascade="all, delete-orphan")
    unidade_medida = relationship("UnidadeMedida", back_populates="produtos")


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Código legível de cliente (ex.: CLI-0001)
    codigo_cliente = Column(String(20), unique=True, nullable=False)
    nome = Column(String, nullable=False)
    cpf_cnpj = Column(String, unique=True, nullable=True)
    telefone = Column(String, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    nome_fantasia = Column(String, nullable=True)
    tipo_pessoa = Column(CHAR(1), default='F')  # 'F' ou 'J'
    cnpj = Column(String, nullable=True)
    rg_inscricao_estadual = Column(String, nullable=True)
    data_nascimento_abertura = Column(Date, nullable=True)
    telefone_secundario = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True)
    site = Column(String, nullable=True)
    contato_responsavel = Column(String, nullable=True)
    limite_credito = Column(Numeric, default=0)
    saldo_devedor = Column(Numeric, default=0)
    condicao_pagamento_preferida = Column(String, nullable=True)
    observacoes = Column(Text, nullable=True)
    categoria_cliente = Column(String, default='regular')
    data_ultima_compra = Column(DateTime, nullable=True)
    base_legal_tratamento = Column(String(30), nullable=False, default='execucao_contrato')
    consentimento_registrado_em = Column(DateTime, nullable=True)

    vendas = relationship("Venda", back_populates="cliente")
    enderecos = relationship("Endereco", back_populates="cliente", cascade="all, delete-orphan")


class Venda(Base):
    __tablename__ = "vendas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    data_venda = Column(DateTime, default=datetime.utcnow)
    total = Column(Numeric(10, 2), nullable=False, default=0)
    forma_pagamento = Column(String(50), default="dinheiro", nullable=False)
    status = Column(String(20), default="concluida", nullable=False)
    desconto = Column(Numeric(10, 2), default=0)
    acrescimo = Column(Numeric(10, 2), default=0)
    observacao = Column(Text, nullable=True)

    cliente = relationship("Cliente", back_populates="vendas")
    usuario = relationship("Usuario", back_populates="vendas")
    itens = relationship("VendaItem", back_populates="venda", cascade="all, delete-orphan")
    pagamentos = relationship("Pagamento", back_populates="venda", cascade="all, delete-orphan")


class VendaItem(Base):
    __tablename__ = "venda_itens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venda_id = Column(UUID(as_uuid=True), ForeignKey("vendas.id"), nullable=False)
    produto_id = Column(UUID(as_uuid=True), ForeignKey("produtos.id"), nullable=False)
    quantidade = Column(Numeric(12, 3), nullable=False)
    preco_unit = Column(Numeric(10, 2), nullable=False)

    venda = relationship("Venda", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_venda")


class Pagamento(Base):
    __tablename__ = "pagamentos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venda_id = Column(UUID(as_uuid=True), ForeignKey("vendas.id"), nullable=False)
    forma_pagamento = Column(String(50), nullable=False)  # dinheiro, cartão, pix, boleto
    valor = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), default="pendente")
    data_pagamento = Column(DateTime, nullable=True)
    data_vencimento = Column(Date, nullable=True)
    parcela_numero = Column(Integer, nullable=True)
    parcela_total = Column(Integer, nullable=True)
    observacao = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    venda = relationship("Venda", back_populates="pagamentos")


class MovimentoEstoque(Base):
    __tablename__ = "movimentos_estoque"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    produto_id = Column(UUID(as_uuid=True), ForeignKey("produtos.id"), nullable=True)
    tipo = Column(String, nullable=False)  # entrada, saida, ajuste
    quantidade = Column(Numeric(12, 3), nullable=False)
    data_movimento = Column(DateTime, default=datetime.utcnow)
    observacao = Column(Text, nullable=True)
    custo_unitario = Column(Numeric(10, 2), nullable=True)
    valor_total = Column(Numeric(12, 2), nullable=True)

    produto = relationship("Produto", back_populates="movimentos")


class Endereco(Base):
    __tablename__ = "enderecos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)
    tipo_endereco = Column(String, default="residencial")  # residencial, comercial, cobranca, entrega
    logradouro = Column(String, nullable=False)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=False)
    estado = Column(String(2), nullable=False)
    cep = Column(String, nullable=False)
    pais = Column(String, default="Brasil")
    criado_em = Column(DateTime, default=datetime.utcnow)

    cliente = relationship("Cliente", back_populates="enderecos")


class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # <-- default adicionado
    codigo_fornecedor = Column(String, nullable=False, unique=True)
    tipo_pessoa = Column(CHAR(1), nullable=False, default="J")  # 'F' ou 'J'
    razao_social = Column(String, nullable=False)
    nome = Column(String, nullable=False)  # fantasia/abreviado
    cnpj_cpf = Column(String)
    inscricao_estadual = Column(String)
    telefone = Column(String)
    email = Column(String)
    site = Column(String)
    contato_nome = Column(String)
    contato_cargo = Column(String)
    contato_email = Column(String)
    contato_telefone = Column(String)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    base_legal_tratamento = Column(String(30), nullable=False, default='execucao_contrato')
    consentimento_registrado_em = Column(DateTime, nullable=True)

    enderecos = relationship(
        "EnderecoFornecedor",
        back_populates="fornecedor",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    produtos = relationship(
        "Produto",
        back_populates="fornecedor_obj",
        lazy="selectin",
    )
    contas_pagar = relationship(
        "ContaPagar",
        back_populates="fornecedor",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("tipo_pessoa IN ('F','J')", name="ck_fornecedor_tipo_pessoa"),
    )

class EnderecoFornecedor(Base):
    __tablename__ = "enderecos_fornecedores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # <-- default adicionado
    fornecedor_id = Column(UUID(as_uuid=True), ForeignKey("fornecedores.id", ondelete="CASCADE"), nullable=False)
    tipo_endereco = Column(String)
    logradouro = Column(String)
    numero = Column(String)
    complemento = Column(String)
    bairro = Column(String)
    cidade = Column(String)
    estado = Column(CHAR(2))
    cep = Column(String)
    pais = Column(String)
    criado_em = Column(DateTime, default=datetime.utcnow)

    fornecedor = relationship("Fornecedor", back_populates="enderecos")


class ContaPagar(Base):
    __tablename__ = "contas_pagar"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fornecedor_id = Column(UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True)
    descricao = Column(String, nullable=True)
    valor = Column(Numeric(10, 2), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    status = Column(String(20), default="pendente")
    data_pagamento = Column(DateTime, nullable=True)

    fornecedor = relationship("Fornecedor", back_populates="contas_pagar")

# --- LOG DE ACESSO (LGPD) ---
class AcessoLog(Base):
    __tablename__ = "acessos_log"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(PGUUID(as_uuid=True), nullable=True)
    metodo = Column(String(8), nullable=False)
    rota = Column(String(255), nullable=False)
    status_code = Column(Integer, nullable=False)
    ip_hash = Column(String(128), nullable=True)
    user_agent = Column(String(300), nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow, nullable=False)    
