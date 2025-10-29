# Sistema Comercial – Backend + Frontend

Aplicação completa para gestão comercial (clientes, fornecedores, produtos, preços, vendas, contas a pagar/receber, relatórios e auditoria).  
O projeto é dividido em dois módulos:

- **Backend (`app/`)** – API REST construída com **FastAPI**, banco de dados **PostgreSQL** (Supabase compatível) e autenticação JWT.
- **Frontend (`sistema-frontend/`)** – Single Page Application com **React + Vite**, Tailwind e Axios para consumir a API.

O repositório abriga os dois projetos para facilitar desenvolvimento local e deploy (Render + Vercel).

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Principais Funcionalidades](#principais-funcionalidades)
3. [Arquitetura & Tecnologias](#arquitetura--tecnologias)
4. [Pré-requisitos](#pré-requisitos)
5. [Configuração de variáveis de ambiente](#configuração-de-variáveis-de-ambiente)
6. [Executando localmente](#executando-localmente)
   - [Backend (FastAPI)](#backend-fastapi)
   - [Frontend (React)](#frontend-react)
7. [Fluxo de deploy (Render + Vercel)](#fluxo-de-deploy-render--vercel)
8. [Estrutura de pastas](#estrutura-de-pastas)
9. [Testes rápidos](#testes-rápidos)
10. [Dicas e problemas comuns](#dicas-e-problemas-comuns)

---

## Visão Geral

O **Sistema Comercial** é voltado para equipes que precisam administrar cadastros (clientes, fornecedores, produtos), controlar vendas e estoque, acompanhar contas a pagar e receber, e gerar relatórios em tempo real. Foi pensado para uso em multi-plataforma: a API fica em um serviço (Render) e o frontend em outro (Vercel), mas ambos podem ser executados localmente para desenvolvimento.

---

## Principais Funcionalidades

- Autenticação com JWT (login, registro, reset de senha com e-mail).
- Gestão de usuários (com perfis como `admin`, `cliente`, `financeiro`, etc.).
- Cadastros completos de clientes, fornecedores, produtos e seus endereços.
- Controle de preços, estoque, movimentações e vendas.
- Contas a pagar e receber.
- Relatórios diversos (ranking de clientes, produtos mais vendidos, estoque, etc.).
- Dashboard com métricas resumidas (vendas, lucro, contas a pagar).
- Middleware de auditoria (log de acessos) e rate limiting configurável.
- Integração com Supabase/PostgreSQL.

---

## Arquitetura & Tecnologias

| Camada     | Tecnologias principais                                                        |
|------------|-------------------------------------------------------------------------------|
| Backend    | FastAPI, SQLAlchemy, Pydantic v2, Passlib (bcrypt), python-jose, PostgreSQL   |
| Frontend   | React (Vite), Axios, React Router, Tailwind, HeroIcons/Feather                |
| Deploy     | Render (API), Vercel (SPA), Supabase/PostgreSQL                               |
| Utilidades | python-dotenv, pydantic-settings, email via SMTP, auditoria e rate limiting   |

---

## Pré-requisitos

- Python **3.9+** (recomendado usar virtualenv ou Conda).
- Node.js **18+** (com npm ou pnpm/yarn).
- Banco PostgreSQL acessível (local, Docker ou Supabase).
- Conta no Render (para o backend) e Vercel (para o frontend), se quiser reproduzir o deploy.

---

## Configuração de variáveis de ambiente

### Backend (`app/core/config.py`)

Crie um arquivo `.env` na raiz com os itens abaixo (o projeto usa `pydantic-settings`):

```ini
DATABASE_URL=postgresql://usuario:senha@host:porta/nome_banco
SECRET_KEY=sua_chave_segura

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=90

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_ALLOWED_ORIGIN_REGEX=https://.*\.vercel\.app
# Opcional: FRONTEND_URL / FRONTEND_URLS (um ou vários domínios)

# SMTP (opcional, para envio de e-mails de reset de senha)
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_USERNAME=usuario
SMTP_PASSWORD=senha
SMTP_USE_TLS=true
EMAIL_FROM=suporte@suaempresa.com
EMAIL_FROM_NAME=Sistema Comercial

# Outros campos relacionados a DPO / LGPD (ver app/core/config.py)
```

> ⚠️ Se `SECRET_KEY` não estiver definido, o backend gera uma chave temporária em cada execução – conveniente para desenvolvimento, mas não recomendado em produção.

### Frontend (`sistema-frontend/.env`)

Crie `.env` (ou `.env.local`):

```bash
VITE_API_URL=http://127.0.0.1:8000
```

Quando for publicar, altere esse valor para o domínio público do backend (ex.: `https://sistema-comercial-2.onrender.com`).

---

## Executando localmente

### Backend (FastAPI)

1. **Instale as dependências Python**:

   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure o banco**:
   - Ajuste `DATABASE_URL` no `.env`.
   - No primeiro run, o backend cria tabelas automaticamente (há uma função `ensure_schema_integrity` que aplica ajustes básicos).

3. **Inicie o servidor**:

   ```bash
   uvicorn app.main:app --reload
   ```

4. **Acesse**:
   - Swagger / documentação: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - Health-check simples: [http://127.0.0.1:8000/healthz](http://127.0.0.1:8000/healthz)

### Frontend (React)

1. **Instale dependências**:

   ```bash
   cd sistema-frontend
   npm install
   ```

2. **Configure o `.env`** com `VITE_API_URL`.

3. **Execute**:

   ```bash
   npm run dev
   ```

   A SPA roda por padrão em [http://127.0.0.1:5173](http://127.0.0.1:5173).

4. **Login**:
   - Crie um usuário pela API (`/auth/register`) ou diretamente no banco. O primeiro usuário cadastrado recebe automaticamente o perfil `admin`.

---

## Fluxo de deploy (Render + Vercel)

### Render (backend)

1. Conecte o repositório ao Render (serviço Web).
2. Configure:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
3. Defina as variáveis de ambiente (igual ao `.env` local). Exemplos necessários:
   - `DATABASE_URL`, `SECRET_KEY`
   - `CORS_ALLOWED_ORIGINS=https://seu-frontend.vercel.app`
   - `CORS_ALLOWED_ORIGIN_REGEX=https://.*\.vercel\.app`
   - Qualquer configuração de SMTP, DPO etc.
4. Verifique nos logs se o backend está respondendo (`GET /healthz`).

> 💡 O código adiciona automaticamente `RENDER_EXTERNAL_URL` à lista de origens válidas, então o próprio domínio do Render pode consumir a API (útil para testes).

### Vercel (frontend)

1. Importe o projeto `sistema-frontend`.
2. Configure a `Environment Variable`:
   - `VITE_API_URL=https://sistema-comercial-2.onrender.com`
3. Rode o deploy. A SPA passará a buscar dados diretamente no backend do Render.

Se for usar outro provedor, basta manter a mesma variável `VITE_API_URL`.

---

## Estrutura de pastas

```
.
├── app/                      # Backend FastAPI
│   ├── auth/                 # Rotas e helpers de autenticação
│   ├── core/                 # Configurações globais
│   ├── db/                   # Configuração de engine, SessionLocal
│   ├── middleware/           # Auditoria, rate limiting
│   ├── models/               # Modelos SQLAlchemy
│   ├── routes/               # Endpoints (clientes, vendas, etc.)
│   ├── schemas/              # Schemas Pydantic (request/response)
│   ├── services/             # Serviços auxiliares (e-mail, etc.)
│   └── main.py               # Criação da app FastAPI e CORS
├── sistema-frontend/         # SPA React
│   ├── src/components/       # Componentes compartilhados
│   ├── src/pages/            # Páginas principais
│   ├── src/services/api.js   # Cliente Axios configurado
│   └── src/app.jsx           # Rotas React Router
├── requirements.txt          # Dependências Python (backend)
├── package.json              # Dependências JS (frontend)
├── .env.example              # Referência de variáveis (backend)
└── README.md                 # Este arquivo
```

---

## Testes rápidos

O projeto não possui suíte automatizada pronta, mas alguns testes manuais ajudam a validar:

- `GET /healthz` → Deve retornar `{"status": "ok"}`.
- `GET /auth/me` com token válido → Retorna os dados do usuário autenticado.
- `POST /auth/login` com usuário existente → Retorna `access_token`.
- Dashboard (`/dashboard/resumo`) → Requer token de admin e deve trazer métricas.
- Frontend: realizar login, cadastrar cliente/fornecedor, registrar venda e ver atualização nos relatórios.

---

## Dicas e problemas comuns

- **SECRET_KEY variando**: defina no `.env`/Render para evitar invalidar tokens a cada restart.
- **Erro bcrypt no Render**: fixado com `bcrypt==4.0.1` no `requirements.txt`. Sempre redeploy após mudanças em dependencies.
- **CORS bloqueando requisições**: garanta que `CORS_ALLOWED_ORIGINS` ou `FRONTEND_URL(S)` contenham o domínio do frontend.
- **Banco vazio**: o primeiro usuário cadastrado vira admin; use-o para criar demais cadastros.
- **E-mail/Senha de reset**: sem SMTP configurado, o serviço loga o token nos logs (modo dev). Ajuste `PASSWORD_RESET_DEV_ECHO_TOKEN=true` se quiser ver o token nos logs.
- **Ambiente local**: use dois terminais (uvicorn + npm run dev) e mantenha ambos apontando para o mesmo banco.

---

## Contribuições

Sinta-se à vontade para abrir issues e PRs. Antes de enviar, rode o backend e o frontend localmente para validar a mudança e, se possível, inclua testes ou narre manualmente como validar.

---

**Autor:** time Sistema Comercial  
**Licença:** verifique as condições do repositório (adicione uma licença se necessário).

Boas vendas e bons commits! 🚀
