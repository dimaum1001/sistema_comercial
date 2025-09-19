"""
Módulo responsável pela criação e validação de tokens JWT e pelo hash de senhas.

As funções aqui definidas utilizam a configuração centralizada em
``app.core.config.settings`` para obter a chave secreta, algoritmo de
assinatura e tempo de expiração. Dessa forma, nenhuma informação sensível
permanece codificada no código‑fonte.

* ``criar_token`` gera um token JWT contendo um dicionário de dados e uma
  data de expiração. É possível passar um ``timedelta`` customizado via
  ``expires_delta``; caso contrário, usa‑se o valor padrão definido em
  ``settings.ACCESS_TOKEN_EXPIRE_MINUTES``.
* ``verificar_token`` decodifica o token JWT e retorna o payload se válido;
  caso contrário retorna ``None``.
* ``hash_senha`` utiliza o ``passlib`` para gerar hashes seguros das
  senhas dos usuários.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def criar_token(dados: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Cria um JSON Web Token contendo os dados fornecidos.

    :param dados: dicionário com informações a serem codificadas no token;
                  recomenda‑se incluir um identificador único (ex.: ``sub``).
    :param expires_delta: opcional, define a validade do token; se não
        informado, utiliza ``settings.ACCESS_TOKEN_EXPIRE_MINUTES``.
    :return: string contendo o token JWT assinado.
    """
    to_encode = dados.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verificar_token(token: str) -> Optional[Dict[str, Any]]:
    """Valida um token JWT e retorna seu payload se for válido.

    Retorna ``None`` caso o token seja inválido ou expirado.

    :param token: token JWT assinado
    :return: dicionário com o payload ou ``None`` em caso de erro
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def hash_senha(senha: str) -> str:
    """Gera um hash seguro para a senha fornecida usando bcrypt."""
    return pwd_context.hash(senha)