from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import (
    get_current_user_optional,
    require_admin,
)
from app.core.config import settings
from app.db.database import SessionLocal
from app.models.models import DataSubjectRequest, DataSubjectRequestEvent, DpoContactMessage, Usuario
from app.schemas.direito_titular_schema import (
    DataSubjectEventCreate,
    DataSubjectEventOut,
    DataSubjectEventType,
    DataSubjectRequestBase,
    DataSubjectRequestCreate,
    DataSubjectRequestList,
    DataSubjectRequestOut,
    DataSubjectRequestStatus,
    DataSubjectRight,
    DataSubjectStatusUpdate,
    DpoContactAck,
    DpoContactCreate,
    DpoContactList,
    DpoContactOut,
    DpoContactStatus,
    DpoContactStatusUpdate,
    DpoInfo,
)
from app.services.email_service import send_dpo_contact_notification

router = APIRouter(prefix="/lgpd", tags=["lgpd"])

LEGAL_RESPONSE_DEADLINE_DAYS = 15
DEADLINE_EXCEEDED_NOTE = "Resposta enviada fora do prazo legal de 15 dias."


def _generate_protocol() -> str:
    stamp = datetime.utcnow().strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"DPO-{stamp}-{suffix}"


def _build_dpo_info() -> DpoInfo:
    canal_preferencial = f"Email: {settings.DPO_EMAIL}"
    return DpoInfo(
        nome=settings.DPO_NAME,
        email=settings.DPO_EMAIL,
        telefone=settings.DPO_PHONE,
        canal_preferencial=canal_preferencial,
        horario_atendimento=settings.DPO_WORKING_HOURS,
        canal_alternativo=settings.DPO_ADDITIONAL_CONTACT,
    )


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _compute_deadline(reference: Optional[datetime] = None) -> datetime:
    base = reference or datetime.utcnow()
    return base + timedelta(days=LEGAL_RESPONSE_DEADLINE_DAYS)


def _fora_do_prazo(solicitacao: DataSubjectRequest, reference: Optional[datetime] = None) -> bool:
    ref = reference or datetime.utcnow()
    if solicitacao.respondido_em:
        return solicitacao.respondido_em > solicitacao.prazo_resposta
    return ref > solicitacao.prazo_resposta


def _serialize_request(solicitacao: DataSubjectRequest) -> DataSubjectRequestOut:
    return DataSubjectRequestOut(
        id=solicitacao.id,
        direito=DataSubjectRight(solicitacao.direito),
        status=DataSubjectRequestStatus(solicitacao.status),
        titular_tipo=solicitacao.titular_tipo,
        titular_identificador=solicitacao.titular_identificador,
        titular_nome=solicitacao.titular_nome,
        titular_email=solicitacao.titular_email,
        justificativa=solicitacao.justificativa,
        prazo_resposta=solicitacao.prazo_resposta,
        respondido_em=solicitacao.respondido_em,
        criado_em=solicitacao.criado_em,
        atualizado_em=solicitacao.atualizado_em,
        fora_do_prazo=_fora_do_prazo(solicitacao),
    )


def _registrar_evento(
    db: Session,
    solicitacao_id: UUID,
    tipo: DataSubjectEventType,
    descricao: Optional[str],
    usuario: Optional[Usuario],
) -> DataSubjectRequestEvent:
    evento = DataSubjectRequestEvent(
        solicitacao_id=solicitacao_id,
        tipo_evento=tipo.value,
        descricao=descricao,
        responsavel_usuario_id=getattr(usuario, "id", None),
    )
    db.add(evento)
    return evento


def _registrar_solicitacao(
    direito: DataSubjectRight,
    dados: DataSubjectRequestBase,
    db: Session,
    usuario: Optional[Usuario],
) -> DataSubjectRequestOut:
    solicitacao = DataSubjectRequest(
        direito=direito.value,
        status=DataSubjectRequestStatus.PENDENTE.value,
        titular_tipo=dados.titular_tipo,
        titular_identificador=dados.titular_identificador,
        titular_nome=dados.titular_nome,
        titular_email=dados.titular_email,
        justificativa=dados.justificativa,
        prazo_resposta=_compute_deadline(),
        respondido_em=None,
        solicitante_usuario_id=getattr(usuario, "id", None),
        registrado_por_usuario_id=getattr(usuario, "id", None),
    )

    db.add(solicitacao)
    db.flush()
    _registrar_evento(
        db=db,
        solicitacao_id=solicitacao.id,
        tipo=DataSubjectEventType.REGISTRADO,
        descricao=dados.justificativa,
        usuario=usuario,
    )
    db.commit()
    db.refresh(solicitacao)
    return _serialize_request(solicitacao)


@router.get(
    "/dpo",
    response_model=DpoInfo,
    status_code=status.HTTP_200_OK,
)
def obter_informacoes_dpo() -> DpoInfo:
    """Retorna o encarregado de dados (DPO) e canais de atendimento divulgados."""
    return _build_dpo_info()


@router.post(
    "/dpo/contatos",
    response_model=DpoContactAck,
    status_code=status.HTTP_201_CREATED,
)
def registrar_contato_dpo(
    payload: DpoContactCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario: Optional[Usuario] = Depends(get_current_user_optional),
) -> DpoContactAck:
    canal = "formulario_autenticado" if usuario else "formulario_publico"
    protocolo = _generate_protocol()
    contato = DpoContactMessage(
        protocolo=protocolo,
        nome=payload.nome.strip(),
        email=payload.email,
        assunto=(payload.assunto or "").strip() or None,
        mensagem=payload.mensagem.strip(),
        canal=canal,
        status=DpoContactStatus.NOVO.value,
    )
    db.add(contato)
    db.commit()
    db.refresh(contato)

    background_tasks.add_task(
        send_dpo_contact_notification,
        contato.protocolo,
        contato.nome,
        contato.email,
        contato.assunto,
        contato.mensagem,
    )

    return DpoContactAck(
        protocolo=contato.protocolo,
        recebida_em=contato.recebida_em,
        prazo_resposta=_compute_deadline(contato.recebida_em),
    )


@router.get(
    "/dpo/contatos",
    response_model=DpoContactList,
)
def listar_contatos_dpo(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    status_filtro: Optional[DpoContactStatus] = Query(None, alias="status"),
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DpoContactList:
    consulta = db.query(DpoContactMessage)
    if status_filtro:
        consulta = consulta.filter(DpoContactMessage.status == status_filtro.value)

    total = consulta.count()
    itens = (
        consulta.order_by(DpoContactMessage.recebida_em.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return DpoContactList(
        total=total,
        itens=[DpoContactOut.model_validate(item, from_attributes=True) for item in itens],
    )


@router.get(
    "/dpo/contatos/{contato_id}",
    response_model=DpoContactOut,
)
def obter_contato_dpo(
    contato_id: UUID,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DpoContactOut:
    contato = (
        db.query(DpoContactMessage)
        .filter(DpoContactMessage.id == contato_id)
        .first()
    )
    if not contato:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contato nao encontrado")
    return DpoContactOut.model_validate(contato, from_attributes=True)


@router.patch(
    "/dpo/contatos/{contato_id}",
    response_model=DpoContactOut,
)
def atualizar_contato_dpo(
    contato_id: UUID,
    payload: DpoContactStatusUpdate,
    usuario: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DpoContactOut:
    contato = (
        db.query(DpoContactMessage)
        .filter(DpoContactMessage.id == contato_id)
        .first()
    )
    if not contato:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contato nao encontrado")

    if payload.status is None and payload.resposta is None and payload.respondida_em is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhuma alteracao informada")

    if payload.status is not None:
        contato.status = payload.status.value
    if payload.resposta is not None:
        contato.resposta = payload.resposta.strip() or None
    if payload.respondida_em is not None:
        contato.respondida_em = payload.respondida_em
    elif payload.status == DpoContactStatus.CONCLUIDO and contato.respondida_em is None:
        contato.respondida_em = datetime.utcnow()
    contato.atualizada_em = datetime.utcnow()
    contato.responsavel_usuario_id = usuario.id

    db.commit()
    db.refresh(contato)
    return DpoContactOut.model_validate(contato, from_attributes=True)


@router.post(
    "/direitos",
    response_model=DataSubjectRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def registrar_direito_generico(
    payload: DataSubjectRequestCreate,
    db: Session = Depends(get_db),
    usuario: Optional[Usuario] = Depends(get_current_user_optional),
) -> DataSubjectRequestOut:
    """Permite registrar qualquer solicitação de direito informando o tipo no corpo."""
    return _registrar_solicitacao(
        direito=payload.direito,
        dados=payload,
        db=db,
        usuario=usuario,
    )


def _build_right_endpoint(direito: DataSubjectRight):
    async def _endpoint(
        payload: DataSubjectRequestBase,
        db: Session = Depends(get_db),
        usuario: Optional[Usuario] = Depends(get_current_user_optional),
    ) -> DataSubjectRequestOut:
        return _registrar_solicitacao(direito=direito, dados=payload, db=db, usuario=usuario)

    _endpoint.__name__ = f"registrar_{direito.value}"
    _endpoint.__doc__ = f"Registra uma solicitação do direito de {direito.value.replace('_', ' ')}."
    return _endpoint


router.add_api_route(
    "/direitos/acesso",
    _build_right_endpoint(DataSubjectRight.ACESSO),
    methods=["POST"],
    response_model=DataSubjectRequestOut,
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/direitos/correcao",
    _build_right_endpoint(DataSubjectRight.CORRECAO),
    methods=["POST"],
    response_model=DataSubjectRequestOut,
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/direitos/exclusao",
    _build_right_endpoint(DataSubjectRight.EXCLUSAO),
    methods=["POST"],
    response_model=DataSubjectRequestOut,
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/direitos/portabilidade",
    _build_right_endpoint(DataSubjectRight.PORTABILIDADE),
    methods=["POST"],
    response_model=DataSubjectRequestOut,
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/direitos/revogacao-consentimento",
    _build_right_endpoint(DataSubjectRight.REVOGACAO_CONSENTIMENTO),
    methods=["POST"],
    response_model=DataSubjectRequestOut,
    status_code=status.HTTP_201_CREATED,
)


@router.get(
    "/direitos",
    response_model=DataSubjectRequestList,
)
def listar_solicitacoes(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    direito: Optional[DataSubjectRight] = Query(None),
    status_filtro: Optional[DataSubjectRequestStatus] = Query(None, alias="status"),
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DataSubjectRequestList:
    consulta = db.query(DataSubjectRequest)

    if direito:
        consulta = consulta.filter(DataSubjectRequest.direito == direito.value)
    if status_filtro:
        consulta = consulta.filter(DataSubjectRequest.status == status_filtro.value)

    total = consulta.count()
    itens = (
        consulta.order_by(DataSubjectRequest.criado_em.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return DataSubjectRequestList(
        total=total,
        itens=[_serialize_request(item) for item in itens],
    )


@router.get(
    "/direitos/{solicitacao_id}",
    response_model=DataSubjectRequestOut,
)
def obter_solicitacao(
    solicitacao_id: UUID,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DataSubjectRequestOut:
    solicitacao = (
        db.query(DataSubjectRequest)
        .filter(DataSubjectRequest.id == solicitacao_id)
        .first()
    )
    if not solicitacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitação não encontrada")
    return _serialize_request(solicitacao)


@router.patch(
    "/direitos/{solicitacao_id}/status",
    response_model=DataSubjectRequestOut,
)
def atualizar_status_solicitacao(
    solicitacao_id: UUID,
    payload: DataSubjectStatusUpdate,
    usuario: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DataSubjectRequestOut:
    solicitacao = (
        db.query(DataSubjectRequest)
        .filter(DataSubjectRequest.id == solicitacao_id)
        .first()
    )
    if not solicitacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitação não encontrada")

    solicitacao.status = payload.status.value
    if payload.resposta_entregue_em:
        solicitacao.respondido_em = payload.resposta_entregue_em
    elif payload.status == DataSubjectRequestStatus.CONCLUIDO and not solicitacao.respondido_em:
        solicitacao.respondido_em = datetime.utcnow()
    solicitacao.atualizado_em = datetime.utcnow()

    evento_tipo = DataSubjectEventType.STATUS_ATUALIZADO
    if payload.status == DataSubjectRequestStatus.CONCLUIDO:
        evento_tipo = DataSubjectEventType.RESPOSTA_ENVIADA

    _registrar_evento(
        db=db,
        solicitacao_id=solicitacao.id,
        tipo=evento_tipo,
        descricao=payload.descricao,
        usuario=usuario,
    )

    if (
        payload.status == DataSubjectRequestStatus.CONCLUIDO
        and _fora_do_prazo(solicitacao)
    ):
        existe_anotacao = (
            db.query(DataSubjectRequestEvent)
            .filter(
                DataSubjectRequestEvent.solicitacao_id == solicitacao.id,
                DataSubjectRequestEvent.tipo_evento == DataSubjectEventType.ANOTACAO.value,
                DataSubjectRequestEvent.descricao == DEADLINE_EXCEEDED_NOTE,
            )
            .first()
        )
        if not existe_anotacao:
            _registrar_evento(
                db=db,
                solicitacao_id=solicitacao.id,
                tipo=DataSubjectEventType.ANOTACAO,
                descricao=DEADLINE_EXCEEDED_NOTE,
                usuario=usuario,
            )

    db.commit()
    db.refresh(solicitacao)
    return _serialize_request(solicitacao)


@router.post(
    "/direitos/{solicitacao_id}/eventos",
    response_model=DataSubjectEventOut,
    status_code=status.HTTP_201_CREATED,
)
def registrar_evento_extra(
    solicitacao_id: UUID,
    payload: DataSubjectEventCreate,
    usuario: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DataSubjectEventOut:
    solicitacao = (
        db.query(DataSubjectRequest)
        .filter(DataSubjectRequest.id == solicitacao_id)
        .first()
    )
    if not solicitacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitação não encontrada")

    evento = _registrar_evento(
        db=db,
        solicitacao_id=solicitacao.id,
        tipo=payload.tipo_evento,
        descricao=payload.descricao,
        usuario=usuario,
    )
    db.commit()
    db.refresh(evento)
    return DataSubjectEventOut.model_validate(evento, from_attributes=True)


@router.get(
    "/direitos/{solicitacao_id}/eventos",
    response_model=List[DataSubjectEventOut],
)
def listar_eventos(
    solicitacao_id: UUID,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> List[DataSubjectEventOut]:
    eventos = (
        db.query(DataSubjectRequestEvent)
        .filter(DataSubjectRequestEvent.solicitacao_id == solicitacao_id)
        .order_by(DataSubjectRequestEvent.criado_em.asc())
        .all()
    )
    return [
        DataSubjectEventOut.model_validate(evento, from_attributes=True)
        for evento in eventos
    ]
