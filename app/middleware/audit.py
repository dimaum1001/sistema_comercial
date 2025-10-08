# app/middleware/audit.py
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db.database import SessionLocal
from app.models.models import AcessoLog
from app.auth.auth_handler import verificar_token

import hashlib


def _hash_ip(ip: Optional[str], salt: str) -> Optional[str]:
    """
    Retorna hash SHA-256 do IP com salt (pseudonimização) ou None se não houver IP.
    Compatível com Python < 3.10 (usa Optional em vez de `|`).
    """
    if not ip:
        return None
    return hashlib.sha256((salt + ip).encode()).hexdigest()


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware de auditoria: registra metadados de cada request após a resposta.
    - usuario_id (se houver Bearer token válido)
    - método, rota, status_code
    - ip_hash (pseudonimizado com SECRET_KEY)
    - user_agent
    """

    def __init__(self, app, salt: str):
        super().__init__(app)
        self.salt = salt

    async def dispatch(self, request: Request, call_next):
        # Deixe a request seguir para capturar o status_code da resposta
        response: Response = await call_next(request)

        try:
            # Extrai user_id do JWT (se houver)
            auth = request.headers.get("authorization", "") or request.headers.get("Authorization", "")
            user_id = None
            if auth.startswith("Bearer "):
                payload = verificar_token(auth[7:])
                if payload:
                    user_id = payload.get("sub")

            ip = request.client.host if request.client else None
            ua = request.headers.get("user-agent")

            db = SessionLocal()
            try:
                db.add(AcessoLog(
                    usuario_id=user_id,
                    metodo=request.method,
                    rota=request.url.path,
                    status_code=response.status_code,
                    ip_hash=_hash_ip(ip, self.salt),
                    user_agent=(ua or "")[:300],
                ))
                db.commit()
            finally:
                db.close()

        except Exception:
            # Falhas de log nunca devem derrubar a aplicação
            pass

        return response
