# app/middleware/audit.py
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db.database import SessionLocal
from app.models.models import AcessoLog
from app.auth.auth_handler import verificar_token

import hashlib
from datetime import datetime, timedelta
from threading import Lock


def _hash_ip(ip: Optional[str], salt: str) -> Optional[str]:
    """
    Retorna hash SHA-256 do IP com salt (pseudonimização) ou None se não houver IP.
    Compatível com Python < 3.10 (usa Optional em vez de `|`).
    """
    if not ip:
        return None
    return hashlib.sha256((salt + ip).encode()).hexdigest()


class AuditMiddleware(BaseHTTPMiddleware):
    """Registra metadados de cada request e aplica retenção configurável."""

    def __init__(self, app, *, salt: str, retention_days: Optional[int] = None, cleanup_interval_seconds: int = 3600):
        super().__init__(app)
        self.salt = salt
        self.retention_days = retention_days if retention_days and retention_days > 0 else None
        self.cleanup_interval = max(60, int(cleanup_interval_seconds))
        self._cleanup_lock = Lock()
        self._last_cleanup = datetime.utcnow()

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        try:
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

            if self.retention_days:
                self._maybe_cleanup()
        except Exception:
            pass

        return response

    def _maybe_cleanup(self):
        now = datetime.utcnow()
        if (now - self._last_cleanup).total_seconds() < self.cleanup_interval:
            return
        if not self._cleanup_lock.acquire(blocking=False):
            return
        try:
            db = SessionLocal()
            try:
                cutoff = now - timedelta(days=self.retention_days)
                db.query(AcessoLog).filter(AcessoLog.criado_em < cutoff).delete(synchronize_session=False)
                db.commit()
            finally:
                db.close()
            self._last_cleanup = now
        finally:
            self._cleanup_lock.release()
