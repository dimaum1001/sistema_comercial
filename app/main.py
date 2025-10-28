from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import text
import os

from app.auth import auth_routes
from app.core.config import settings
from app.db.database import ensure_schema_integrity, engine
from app.middleware.audit import AuditMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.models import models  # garante o import dos models
from app.routes import (
    auditoria_routes,
    categorias_routes,
    clientes_routes,
    contas_pagar_routes,
    direitos_titulares_routes,
    dashboard_routes,
    endereco_routes,
    fornecedores_routes,
    movimentos_routes,
    pagamentos_routes,
    precos_routes,
    produtos_routes,
    relatorios_routes,
    unidades_medida_routes,
    usuarios_routes,
    vendas_routes,
)

app = FastAPI()

# ──────────────────────────────────────────────────────────────────────────────
# Rotas
# ──────────────────────────────────────────────────────────────────────────────
app.include_router(auth_routes.router, prefix="/auth")
app.include_router(clientes_routes.router)
app.include_router(produtos_routes.router)
app.include_router(vendas_routes.router)
app.include_router(categorias_routes.router)
app.include_router(movimentos_routes.router)
app.include_router(endereco_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(fornecedores_routes.router)
app.include_router(usuarios_routes.router)
app.include_router(precos_routes.router)
app.include_router(pagamentos_routes.router)
app.include_router(relatorios_routes.router)
app.include_router(contas_pagar_routes.router)
app.include_router(auditoria_routes.router)
app.include_router(unidades_medida_routes.router)
app.include_router(direitos_titulares_routes.router)

# ──────────────────────────────────────────────────────────────────────────────
# Eventos / Healthcheck
# ──────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
def testar_conexao_supabase():
    try:
        ensure_schema_integrity()
        with engine.connect() as conn:
            resultado = conn.execute(text("SELECT now()"))
            print("OK. Conectado ao Supabase em", resultado.scalar())
    except Exception as exc:
        print("ERRO ao conectar ao Supabase:", exc)

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"mensagem": "Sistema funcionando!"}

# ──────────────────────────────────────────────────────────────────────────────
# Middlewares (ordem importa! O ÚLTIMO adicionado roda primeiro)
# 1) Middlewares customizados (internos)
# 2) CORS por ÚLTIMO (mais externo) para sempre anexar os headers,
#    mesmo quando houver exceção interna.
# ──────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    RateLimitMiddleware,
    limit=settings.RATE_LIMIT_REQUESTS,
    window=settings.RATE_LIMIT_WINDOW_SECONDS,
)
app.add_middleware(
    AuditMiddleware,
    salt=settings.SECRET_KEY,
    retention_days=settings.AUDIT_RETENTION_DAYS,
    cleanup_interval_seconds=settings.AUDIT_CLEANUP_INTERVAL_SECONDS,
)

# Preflight genérico (garante 204 para qualquer OPTIONS)
@app.options("/{full_path:path}")
def preflight_handler(full_path: str):
    return Response(status_code=204)

# >>> CORS por último <<<
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"https://.*\.vercel\.app",
)

allowed_list = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
print("CORS -> allow_origins:", allowed_list)
print("CORS -> allow_origin_regex:", ALLOWED_ORIGIN_REGEX)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_list,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "Content-Range"],
)
