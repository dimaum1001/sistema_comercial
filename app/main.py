from fastapi import FastAPI
from sqlalchemy import text
from app.db.database import engine
from app.models import models  # Isso garante que os models sejam importados
from fastapi import FastAPI
from app.auth import auth_routes
from fastapi.middleware.cors import CORSMiddleware
from app.routes import categorias_routes, clientes_routes, produtos_routes, vendas_routes, movimentos_routes, endereco_routes, dashboard_routes, fornecedores_routes, usuarios_routes, precos_routes, pagamentos_routes


app = FastAPI()


origins = [
    "http://localhost:5173",  # frontend
    "http://127.0.0.1:5173"   # alternativa
    
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.on_event("startup")
def testar_conexao_supabase():
    try:
        with engine.connect() as conn:
            resultado = conn.execute(text("SELECT now()"))
            print("✅ Conectado ao Supabase com sucesso em", resultado.scalar())
    except Exception as e:
        print("❌ Erro ao conectar ao Supabase:", e)

@app.get("/")
def read_root():
    return {"mensagem": "Sistema funcionando!"}
