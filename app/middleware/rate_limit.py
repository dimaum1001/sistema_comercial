from collections import defaultdict, deque
import time
from threading import Lock
from typing import Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token bucket simples em memória por IP."""

    def __init__(self, app, limit: int = 100, window: int = 60):
        super().__init__(app)
        self.limit = max(1, int(limit))
        self.window = max(1, int(window))
        self._data = defaultdict(deque)
        self._lock = Lock()

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "anonymous"
        now = time.monotonic()
        window_start = now - self.window

        with self._lock:
            q = self._data[client_ip]
            while q and q[0] <= window_start:
                q.popleft()
            if len(q) >= self.limit:
                retry_after = max(0, int(q[0] + self.window - now))
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please slow down."},
                    headers={"Retry-After": str(retry_after)},
                )
            q.append(now)

        response = await call_next(request)
        return response
