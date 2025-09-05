from sqlalchemy import Column, String, Numeric, Integer, ForeignKey, Text, DateTime, Boolean, Date, CHAR, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

# ========================
# Usuários
# ========================
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    senha_hash = Column(Text, nullable=False)
    tipo = Column(String, nullable=False)  # admin, vendedor, etc.
    criado_em = Column(DateTime, default=datetime.utcnow)

    vendas = relationship("Venda", back_populates="usuario")


# ========================
# Categorias
# ========================
class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String, unique=True, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)

    produtos = relationship("Produto", back_populates="categoria")


# ========================
# Histórico de Preços
# ========================
class PrecoProduto(Base):
    __tablename__ = "precos_produto"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    produto_id = Column(UUID(as_uuid=True), ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False)

    preco = Column(Numeric(10, 2), nullable=False)
    data_inicio = Column(DateTime, default=datetime.utcnow, nullable=False)
    data_fim = Column(DateTime, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)

    produto = relationship("Produto", back_populates="precos")


# ========================
# Produtos
# ========================
class Produto(Base):
    __tablename__ = "produtos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String, nullable=False)
    codigo_barras = Column(String(50), nullable=True)

    custo = Column(Numeric(10, 2), nullable=True)
    preco_venda = Column(Numeric(10, 2), nullable=True)  # mantém o último preço ativo (cache para performance)

    estoque = Column(Integer, default=0)
    estoque_minimo = Column(Integer, nullable=True)

    unidade = Column(String(20), nullable=True)
    marca = Column(String(100), nullable=True)
    localizacao = Column(String(100), nullable=True)

    data_validade = Column(Date, nullable=True)
    ativo = Column(Boolean, default=True)

    categoria_id = Column(UUID(as_uuid=True), ForeignKey("categorias.id"), nullable=True)
    fornecedor_id = Column(UUID(as_uuid=True), ForeignKey("fornecedores.id"), nullable=True)

    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    categoria = relationship("Categoria", back_populates="produtos")
    fornecedor = relationship("Fornecedor")
    itens_venda = relationship("VendaItem", back_populates="produto")
    movimentos = relationship("MovimentoEstoque", back_populates="produto", cascade="all, delete-orphan")
    precos = relationship("PrecoProduto", back_populates="produto", cascade="all, delete-orphan")


# ========================
# Clientes
# ========================
class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String, nullable=False)
    tipo_pessoa = Column(CHAR(1), nullable=False)  # 'F' ou 'J'
    cpf_cnpj = Column(String, unique=True, nullable=False)
    telefone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)

    vendas = relationship("Venda", back_populates="cliente")
    enderecos = relationship("Endereco", back_populates="cliente", cascade="all, delete-orphan")


# ========================
# Vendas
# ========================
class Venda(Base):
    __tablename__ = "vendas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    data_venda = Column(DateTime, default=datetime.utcnow)
    total = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="concluida")
    desconto = Column(Numeric(10, 2), nullable=False, default=0)
    acrescimo = Column(Numeric(10, 2), nullable=False, default=0)
    observacao = Column(Text, nullable=True)

    cliente = relationship("Cliente", back_populates="vendas")
    usuario = relationship("Usuario", back_populates="vendas")
    itens = relationship("VendaItem", back_populates="venda", cascade="all, delete-orphan")
    pagamentos = relationship("Pagamento", back_populates="venda", cascade="all, delete-orphan")


# ========================
# Itens de Venda
# ========================
class VendaItem(Base):
    __tablename__ = "venda_itens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venda_id = Column(UUID(as_uuid=True), ForeignKey("vendas.id"), nullable=False)
    produto_id = Column(UUID(as_uuid=True), ForeignKey("produtos.id"), nullable=False)
    quantidade = Column(Integer, nullable=False)
    preco_unit = Column(Numeric(10, 2), nullable=False)

    venda = relationship("Venda", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_venda")


# ========================
# Pagamentos (Contas a Receber)
# ========================
class Pagamento(Base):
    __tablename__ = "pagamentos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venda_id = Column(UUID(as_uuid=True), ForeignKey("vendas.id"), nullable=False)

    forma_pagamento = Column(String(50), nullable=False)   # dinheiro, cartão, boleto, pix
    valor = Column(Numeric(10, 2), nullable=False)

    status = Column(String(20), default="pendente")  # pendente, pago, cancelado

    data_vencimento = Column(Date, nullable=True)    # 🔹 vencimento da parcela
    data_pagamento = Column(DateTime, nullable=True) # 🔹 só preenche quando pago

    parcela_numero = Column(Integer, nullable=True)  # 🔹 nº da parcela
    parcela_total = Column(Integer, nullable=True)   # 🔹 total de parcelas

    observacao = Column(Text, nullable=True)

    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    venda = relationship("Venda", back_populates="pagamentos")


# ========================
# Movimentos de Estoque
# ========================
class MovimentoEstoque(Base):
    __tablename__ = "movimentos_estoque"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    produto_id = Column(UUID(as_uuid=True), ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(20), nullable=False)  # entrada, saida, ajuste
    quantidade = Column(Integer, nullable=False)
    data_movimento = Column(DateTime, default=datetime.utcnow)
    observacao = Column(Text, nullable=True)

    produto = relationship("Produto", back_populates="movimentos")


# ========================
# Endereços
# ========================
class Endereco(Base):
    __tablename__ = "enderecos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)

    tipo_endereco = Column(String, nullable=False, default="residencial")
    logradouro = Column(Text, nullable=False)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=False)
    estado = Column(CHAR(2), nullable=False)
    cep = Column(String, nullable=False)
    pais = Column(String, default="Brasil")

    criado_em = Column(DateTime, default=datetime.utcnow)

    cliente = relationship("Cliente", back_populates="enderecos")


# ========================
# Fornecedores
# ========================
class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String, nullable=False)
    cnpj_cpf = Column(String, unique=True, nullable=False)
    inscricao_estadual = Column(String)

    telefone = Column(String)
    email = Column(String)
    site = Column(String)

    logradouro = Column(String)
    numero = Column(String)
    complemento = Column(String)
    bairro = Column(String)
    cidade = Column(String)
    estado = Column(String)
    cep = Column(String)
    pais = Column(String, default="Brasil")

    contato_nome = Column(String)
    contato_cargo = Column(String)
    contato_email = Column(String)
    contato_telefone = Column(String)

    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())
