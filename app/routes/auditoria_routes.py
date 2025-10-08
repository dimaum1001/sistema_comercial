from fastapi import APIRouter, Depends, Query, Response, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.models.models import AcessoLog, Usuario
from app.auth.auth_handler import verificar_token

router = APIRouter(prefix="/auditoria", tags=["Auditoria"])

# --- auth helpers ---
def get_current_user(request: Request, db: Session = Depends(get_db)) -> Usuario:
    auth = request.headers.get("Authorization", "") or request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    payload = verificar_token(auth[7:])
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.query(Usuario).filter(Usuario.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    return user

def somente_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    if str(getattr(user, "tipo", "")).lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito")
    return user

# --- 1) Lista detalhada de acessos (com nome do usuário) ---
@router.get("/acessos")
def listar_acessos(
    response: Response,
    inicio: Optional[datetime] = Query(None),
    fim: Optional[datetime] = Query(None),
    usuario_id: Optional[UUID] = Query(None),
    rota: Optional[str] = Query(None),
    metodo: Optional[str] = Query(None),
    status_code: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    _admin: Usuario = Depends(somente_admin),
    db: Session = Depends(get_db),
):
    # base com JOIN p/ trazer nome
    q = (
        db.query(
            AcessoLog,
            Usuario.nome.label("usuario_nome"),
        )
        .outerjoin(Usuario, AcessoLog.usuario_id == Usuario.id)
    )

    def aplicar_filtros(query):
        if inicio:
            query = query.filter(AcessoLog.criado_em >= inicio)
        if fim:
            query = query.filter(AcessoLog.criado_em < fim)
        if usuario_id:
            query = query.filter(AcessoLog.usuario_id == usuario_id)
        if rota:
            query = query.filter(AcessoLog.rota.ilike(f"%{rota}%"))
        if metodo:
            query = query.filter(AcessoLog.metodo == metodo.upper())
        if status_code:
            query = query.filter(AcessoLog.status_code == status_code)
        return query

    q = aplicar_filtros(q)

    # total sem join
    q_total = aplicar_filtros(db.query(func.count(AcessoLog.id)))
    total = q_total.scalar() or 0

    skip = (page - 1) * per_page
    rows = (
        q.order_by(AcessoLog.criado_em.desc())
         .offset(skip).limit(per_page)
         .all()
    )

    response.headers["X-Total-Count"] = str(total)
    response.headers["Content-Range"] = f"items {skip+1 if total else 0}-{min(skip+per_page, total)}/{total}"

    itens = []
    for log, usuario_nome in rows:
        itens.append({
            "id": str(log.id),
            "usuario_id": str(log.usuario_id) if log.usuario_id else None,
            "usuario_nome": usuario_nome,
            "metodo": log.metodo,
            "rota": log.rota,
            "status_code": log.status_code,
            "ip_hash": log.ip_hash,
            "user_agent": log.user_agent,
            "criado_em": log.criado_em.isoformat() + "Z",
        })
    return itens

# --- 2) Resumo por usuário no período ---
@router.get("/usuarios")
def resumo_usuarios(
    inicio: Optional[datetime] = Query(None),
    fim: Optional[datetime] = Query(None),
    _admin: Usuario = Depends(somente_admin),
    db: Session = Depends(get_db),
):
    q = (
        db.query(
            AcessoLog.usuario_id,
            Usuario.nome.label("usuario_nome"),
            func.count(AcessoLog.id).label("acessos"),
            func.max(AcessoLog.criado_em).label("ultimo_acesso"),
            func.count(func.distinct(AcessoLog.rota)).label("rotas_distintas"),
        )
        .outerjoin(Usuario, AcessoLog.usuario_id == Usuario.id)
        .filter(AcessoLog.usuario_id.isnot(None))
    )

    if inicio:
        q = q.filter(AcessoLog.criado_em >= inicio)
    if fim:
        q = q.filter(AcessoLog.criado_em < fim)

    q = q.group_by(AcessoLog.usuario_id, Usuario.nome).order_by(func.count(AcessoLog.id).desc())
    rows = q.all()

    return [
        {
            "usuario_id": str(u.usuario_id),
            "usuario_nome": u.usuario_nome,
            "acessos": int(u.acessos),
            "ultimo_acesso": (u.ultimo_acesso.isoformat() + "Z") if u.ultimo_acesso else None,
            "rotas_distintas": int(u.rotas_distintas),
        }
        for u in rows
    ]

# --- 3) Rotas usadas (agregado) — opcionalmente por usuário ---
@router.get("/rotas")
def rotas_usadas(
    inicio: Optional[datetime] = Query(None),
    fim: Optional[datetime] = Query(None),
    usuario_id: Optional[UUID] = Query(None),
    _admin: Usuario = Depends(somente_admin),
    db: Session = Depends(get_db),
):
    get_cnt = func.sum(case((AcessoLog.metodo == "GET", 1), else_=0)).label("get")
    post_cnt = func.sum(case((AcessoLog.metodo == "POST", 1), else_=0)).label("post")
    put_cnt = func.sum(case((AcessoLog.metodo == "PUT", 1), else_=0)).label("put")
    del_cnt = func.sum(case((AcessoLog.metodo == "DELETE", 1), else_=0)).label("delete")

    q = db.query(
        AcessoLog.rota.label("rota"),
        func.count(AcessoLog.id).label("acessos"),
        get_cnt, post_cnt, put_cnt, del_cnt,
    )

    if inicio:
        q = q.filter(AcessoLog.criado_em >= inicio)
    if fim:
        q = q.filter(AcessoLog.criado_em < fim)
    if usuario_id:
        q = q.filter(AcessoLog.usuario_id == usuario_id)

    q = q.group_by(AcessoLog.rota).order_by(func.count(AcessoLog.id).desc())

    rows = q.all()
    return [
        {
            "rota": r.rota,
            "acessos": int(r.acessos),
            "get": int(r.get or 0),
            "post": int(r.post or 0),
            "put": int(r.put or 0),
            "delete": int(r.delete or 0),
        }
        for r in rows
    ]
