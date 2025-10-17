import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const DIREITOS = [
  { value: '', label: 'Todos os direitos' },
  { value: 'acesso', label: 'Acesso' },
  { value: 'correcao', label: 'Correcao' },
  { value: 'exclusao', label: 'Exclusao' },
  { value: 'portabilidade', label: 'Portabilidade' },
  { value: 'revogacao_consentimento', label: 'Revogacao de consentimento' },
]

const STATUS = [
  { value: '', label: 'Todos os status' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluido' },
  { value: 'indeferido', label: 'Indeferido' },
]

const CONTATO_STATUS = [
  { value: '', label: 'Todos os status' },
  { value: 'novo', label: 'Novo' },
  { value: 'em_atendimento', label: 'Em atendimento' },
  { value: 'concluido', label: 'Concluido' },
]

const STATUS_BADGE = {
  pendente: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  em_andamento: 'bg-blue-100 text-blue-800 border border-blue-200',
  concluido: 'bg-green-100 text-green-800 border border-green-200',
  indeferido: 'bg-red-100 text-red-800 border border-red-200',
}

const CONTATO_BADGE = {
  novo: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  em_atendimento: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  concluido: 'bg-green-100 text-green-800 border border-green-200',
}

const fetchDireitos = async ({ queryKey }) => {
  const [, params] = queryKey
  const { data } = await api.get('/lgpd/direitos', { params })
  return data
}

const fetchEventos = async ({ queryKey }) => {
  const [, solicitacaoId] = queryKey
  if (!solicitacaoId) return []
  const { data } = await api.get(`/lgpd/direitos/${solicitacaoId}/eventos`)
  return data
}

const fetchDpoInfo = async () => {
  const { data } = await api.get('/lgpd/dpo')
  return data
}

const fetchDpoContatos = async ({ queryKey }) => {
  const [, params] = queryKey
  const { data } = await api.get('/lgpd/dpo/contatos', { params })
  return data
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR')
}

const toInputDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function Badge({ text, tone }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tone || 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
      {text}
    </span>
  )
}

export default function LgpdDireitos() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15)
  const [filters, setFilters] = useState({ direito: '', status: '' })
  const [selected, setSelected] = useState(null)

  const [contatosPage, setContatosPage] = useState(1)
  const [contatosLimit, setContatosLimit] = useState(10)
  const [contatosStatus, setContatosStatus] = useState('')
  const [contatoSelecionado, setContatoSelecionado] = useState(null)

  const direitosParams = useMemo(() => {
    const params = {
      skip: (page - 1) * limit,
      limit,
    }
    if (filters.direito) params.direito = filters.direito
    if (filters.status) params.status = filters.status
    return params
  }, [page, limit, filters])

  const contatosParams = useMemo(() => {
    const params = {
      skip: (contatosPage - 1) * contatosLimit,
      limit: contatosLimit,
    }
    if (contatosStatus) params.status = contatosStatus
    return params
  }, [contatosPage, contatosLimit, contatosStatus])

  const { data: direitosData, isLoading: loadingDireitos, isFetching: fetchingDireitos, error: direitosError } = useQuery({
    queryKey: ['lgpd-direitos', direitosParams],
    queryFn: fetchDireitos,
    keepPreviousData: true,
  })

  const { data: eventos = [], isLoading: loadingEventos } = useQuery({
    queryKey: ['lgpd-direitos-eventos', selected?.id || null],
    queryFn: fetchEventos,
    enabled: !!selected?.id,
  })

  const { data: dpoInfo, isLoading: loadingDpo } = useQuery({
    queryKey: ['lgpd-dpo-info'],
    queryFn: fetchDpoInfo,
  })

  const { data: contatosData, isLoading: loadingContatos, isFetching: fetchingContatos, error: contatosError } = useQuery({
    queryKey: ['lgpd-dpo-contatos', contatosParams],
    queryFn: fetchDpoContatos,
    keepPreviousData: true,
  })

  const alterarStatusMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch(`/lgpd/direitos/${id}/status`, payload)
      return data
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['lgpd-direitos'] })
      queryClient.invalidateQueries({ queryKey: ['lgpd-direitos-eventos', updated.id] })
      setSelected(updated)
    },
  })

  const registrarEventoMutation = useMutation({
    mutationFn: async ({ id, descricao }) => {
      const payload = { tipo_evento: 'anotacao', descricao }
      await api.post(`/lgpd/direitos/${id}/eventos`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lgpd-direitos-eventos', selected?.id || null] })
    },
  })

  const atualizarContatoMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch(`/lgpd/dpo/contatos/${id}`, payload)
      return data
    },
    onSuccess: (contato) => {
      queryClient.invalidateQueries({ queryKey: ['lgpd-dpo-contatos'] })
      setContatoSelecionado(contato)
    },
  })

  const solicitacoes = direitosData?.itens || []
  const totalSolicitacoes = direitosData?.total || 0
  const totalSolicitacoesPaginas = Math.max(1, Math.ceil(totalSolicitacoes / limit))

  const contatos = contatosData?.itens || []
  const totalContatos = contatosData?.total || 0
  const totalContatosPaginas = Math.max(1, Math.ceil(totalContatos / contatosLimit))

  const handleSelecionarSolicitacao = (item) => {
    setSelected(item)
  }

  const handleAtualizarSolicitacao = (event) => {
    event.preventDefault()
    if (!selected) return

    const formData = new FormData(event.currentTarget)
    const status = formData.get('status') || selected.status
    const descricao = formData.get('descricao')?.trim()
    const respondido = formData.get('respondido_em')

    const payload = { status }
    if (descricao) payload.descricao = descricao
    if (respondido) {
      const date = new Date(respondido)
      if (!Number.isNaN(date.getTime())) {
        payload.resposta_entregue_em = date.toISOString()
      }
    }

    alterarStatusMutation.mutate({ id: selected.id, payload })
  }

  const handleRegistrarNota = (event) => {
    event.preventDefault()
    if (!selected) return
    const formData = new FormData(event.currentTarget)
    const descricao = formData.get('anotacao')?.trim()
    if (!descricao) return
    registrarEventoMutation.mutate({ id: selected.id, descricao })
    event.currentTarget.reset()
  }

  const handleAtualizarContato = (event) => {
    event.preventDefault()
    if (!contatoSelecionado) return
    const formData = new FormData(event.currentTarget)
    const status = formData.get('contato_status')
    const resposta = formData.get('contato_resposta')?.trim()
    const respondidaEm = formData.get('contato_respondida_em')

    const payload = {}
    if (status) payload.status = status
    if (resposta !== undefined) payload.resposta = resposta
    if (respondidaEm) {
      const date = new Date(respondidaEm)
      if (!Number.isNaN(date.getTime())) {
        payload.respondida_em = date.toISOString()
      }
    }

    if (Object.keys(payload).length === 0) return
    atualizarContatoMutation.mutate({ id: contatoSelecionado.id, payload })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Direitos dos titulares (LGPD)</h1>
        <p className="text-sm text-gray-600">
          Acompanhe solicitações exercidas pelos titulares, atualize o status e registre o atendimento do DPO.
        </p>
      </header>

      <section className="bg-white border rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Encarregado de Dados (DPO)</h2>
        {loadingDpo ? (
          <p className="text-sm text-gray-500">Carregando informações...</p>
        ) : dpoInfo ? (
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Nome</p>
              <p className="font-medium text-gray-800">{dpoInfo.nome}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">E-mail</p>
              <p className="font-medium text-gray-800">{dpoInfo.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Telefone</p>
              <p className="font-medium text-gray-800">{dpoInfo.telefone || 'Nao informado'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Horário de atendimento</p>
              <p className="font-medium text-gray-800">{dpoInfo.horario_atendimento || 'Nao informado'}</p>
            </div>
            {dpoInfo.canal_alternativo ? (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Canal alternativo</p>
                <p className="font-medium text-gray-800">{dpoInfo.canal_alternativo}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-red-600">Nao foi possivel carregar as informacoes.</p>
        )}
      </section>

      <section className="bg-white border rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Direito</label>
            <select
              className="border rounded-lg px-2 py-1.5 text-sm"
              value={filters.direito}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, direito: event.target.value }))
              }}
            >
              {DIREITOS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              className="border rounded-lg px-2 py-1.5 text-sm"
              value={filters.status}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }}
            >
              {STATUS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-gray-600">por página</span>
            <select
              className="border rounded-lg px-2 py-1.5"
              value={limit}
              onChange={(event) => {
                setPage(1)
                setLimit(Number(event.target.value))
              }}
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-gray-500">
              total: <strong>{totalSolicitacoes}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-4 py-2">Titular</th>
                <th className="px-4 py-2">Identificador</th>
                <th className="px-4 py-2">Direito</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Prazo</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingDireitos ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregando solicitações...</td>
                </tr>
              ) : direitosError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-red-600">Nao foi possivel carregar as solicitacoes.</td>
                </tr>
              ) : solicitacoes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nenhuma solicitação encontrada.</td>
                </tr>
              ) : (
                solicitacoes.map((item) => {
                  const active = selected?.id === item.id
                  return (
                    <tr key={item.id} className={`border-t ${active ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.titular_nome || '-'}</div>
                        <div className="text-xs text-gray-500">{item.titular_email || 'Sem e-mail'}</div>
                      </td>
                      <td className="px-4 py-3">{item.titular_identificador}</td>
                      <td className="px-4 py-3">{DIREITOS.find((d) => d.value === item.direito)?.label || item.direito}</td>
                      <td className="px-4 py-3">
                        <Badge text={STATUS.find((s) => s.value === item.status)?.label || item.status} tone={STATUS_BADGE[item.status]} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span>{formatDate(item.prazo_resposta)}</span>
                          {item.fora_do_prazo ? <span className="text-xs text-red-600">Prazo excedido</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-sm px-3 py-1.5 border rounded-lg hover:bg-blue-50 transition"
                          onClick={() => handleSelecionarSolicitacao(item)}
                        >
                          {active ? 'Ocultar' : 'Detalhes'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 p-3 border-t text-sm">
          <button
            className="border rounded-lg px-3 py-1.5 disabled:opacity-50"
            disabled={page <= 1 || fetchingDireitos}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </button>
          <span>Página {page} de {totalSolicitacoesPaginas}</span>
          <button
            className="border rounded-lg px-3 py-1.5 disabled:opacity-50"
            disabled={page >= totalSolicitacoesPaginas || fetchingDireitos}
            onClick={() => setPage((current) => Math.min(totalSolicitacoesPaginas, current + 1))}
          >
            Próxima
          </button>
          {fetchingDireitos ? <span className="ml-auto text-xs text-gray-500">Atualizando...</span> : null}
        </div>
      </section>

      {selected ? (
        <section className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Solicitação selecionada</h2>
              <p className="text-sm text-gray-500">ID: {selected.id}</p>
            </div>
            <div className="text-sm text-gray-500">
              <p>Recebida em: {formatDate(selected.criado_em)}</p>
              <p>Última atualização: {formatDate(selected.atualizado_em)}</p>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Titular</p>
                <p className="font-medium text-gray-800">{selected.titular_nome || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Identificador</p>
                <p className="font-medium text-gray-800">{selected.titular_identificador}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">E-mail</p>
                <p className="font-medium text-gray-800">{selected.titular_email || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Direito solicitado</p>
                <p className="font-medium text-gray-800">{DIREITOS.find((d) => d.value === selected.direito)?.label || selected.direito}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Justificativa</p>
                <p className="font-medium text-gray-800 whitespace-pre-wrap bg-gray-50 border rounded-lg p-3">
                  {selected.justificativa || 'Sem justificativa registrada'}
                </p>
              </div>
            </div>

            <form onSubmit={handleAtualizarSolicitacao} className="space-y-3">
              <header className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Atualizar status</h3>
                {alterarStatusMutation.isPending ? <span className="text-xs text-gray-500">Enviando...</span> : null}
              </header>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                <select
                  name="status"
                  defaultValue={selected.status}
                  className="border rounded-lg px-2 py-1.5"
                >
                  {STATUS.filter((s) => s.value).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Resumo / resposta</span>
                <textarea
                  name="descricao"
                  className="border rounded-lg px-2 py-1.5 min-h-[120px]"
                  placeholder="Informe a resposta enviada ao titular ou observações internas."
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Respondido em</span>
                <input
                  name="respondido_em"
                  type="datetime-local"
                  defaultValue={toInputDateTime(selected.respondido_em)}
                  className="border rounded-lg px-2 py-1.5"
                />
              </label>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                disabled={alterarStatusMutation.isPending}
              >
                Salvar atualização
              </button>
              {alterarStatusMutation.isError ? (
                <p className="text-xs text-red-600">Nao foi possivel atualizar. Tente novamente.</p>
              ) : null}
            </form>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">Eventos registrados</h3>
            {loadingEventos ? (
              <p className="text-sm text-gray-500">Carregando eventos...</p>
            ) : eventos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum evento registrado para esta solicitação.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {eventos.map((ev) => (
                  <div key={ev.id} className="p-3 text-sm space-y-1">
                    <header className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                      <span>{ev.tipo_evento.replace(/_/g, ' ')}</span>
                      <span>{formatDate(ev.criado_em)}</span>
                    </header>
                    <p className="font-medium whitespace-pre-wrap">{ev.descricao || '-'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleRegistrarNota} className="space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Registrar anotação interna</span>
              <textarea
                name="anotacao"
                className="border rounded-lg px-2 py-1.5 min-h-[96px]"
                placeholder="Descreva as ações executadas ou próximos passos."
              />
            </label>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              disabled={registrarEventoMutation.isPending}
            >
              Salvar anotação
            </button>
            {registrarEventoMutation.isError ? (
              <p className="text-xs text-red-600">Nao foi possivel registrar a anotação.</p>
            ) : null}
          </form>
        </section>
      ) : null}

      <section className="bg-white border rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b flex flex-wrap gap-3 items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Mensagens do canal LGPD</h2>
            <p className="text-xs text-gray-500">Registros enviados ao DPO pelo formulário público.</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-gray-500">Status</span>
            <select
              className="border rounded-lg px-2 py-1.5"
              value={contatosStatus}
              onChange={(event) => {
                setContatosPage(1)
                setContatosStatus(event.target.value)
              }}
            >
              {CONTATO_STATUS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <span className="text-gray-500">por página</span>
            <select
              className="border rounded-lg px-2 py-1.5"
              value={contatosLimit}
              onChange={(event) => {
                setContatosPage(1)
                setContatosLimit(Number(event.target.value))
              }}
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-gray-500">
              total: <strong>{totalContatos}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-4 py-2">Protocolo</th>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Recebido em</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingContatos ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregando contatos...</td>
                </tr>
              ) : contatosError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-red-600">Nao foi possivel carregar as mensagens.</td>
                </tr>
              ) : contatos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nenhuma mensagem registrada.</td>
                </tr>
              ) : (
                contatos.map((item) => {
                  const ativo = contatoSelecionado?.id === item.id
                  return (
                    <tr key={item.id} className={`border-t ${ativo ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-medium">{item.protocolo}</td>
                      <td className="px-4 py-3">{item.nome}</td>
                      <td className="px-4 py-3">{item.email}</td>
                      <td className="px-4 py-3">{formatDate(item.recebida_em)}</td>
                      <td className="px-4 py-3">
                        <Badge text={item.status} tone={CONTATO_BADGE[item.status]} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-sm px-3 py-1.5 border rounded-lg hover:bg-blue-50 transition"
                          onClick={() => setContatoSelecionado(ativo ? null : item)}
                        >
                          {ativo ? 'Ocultar' : 'Ver detalhes'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 p-3 border-t text-sm">
          <button
            className="border rounded-lg px-3 py-1.5 disabled:opacity-50"
            disabled={contatosPage <= 1 || fetchingContatos}
            onClick={() => setContatosPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </button>
          <span>Página {contatosPage} de {totalContatosPaginas}</span>
          <button
            className="border rounded-lg px-3 py-1.5 disabled:opacity-50"
            disabled={contatosPage >= totalContatosPaginas || fetchingContatos}
            onClick={() => setContatosPage((current) => Math.min(totalContatosPaginas, current + 1))}
          >
            Próxima
          </button>
          {fetchingContatos ? <span className="ml-auto text-xs text-gray-500">Atualizando...</span> : null}
        </div>
      </section>

      {contatoSelecionado ? (
        <section className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
          <header className="flex items-start justify-between gap-4 border-b pb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Contato selecionado</h3>
              <p className="text-sm text-gray-500">Protocolo: {contatoSelecionado.protocolo}</p>
              <p className="text-xs text-gray-500">Recebido em {formatDate(contatoSelecionado.recebida_em)}</p>
            </div>
            <Badge text={contatoSelecionado.status} tone={CONTATO_BADGE[contatoSelecionado.status]} />
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nome</p>
                <p className="font-medium text-gray-800">{contatoSelecionado.nome}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">E-mail</p>
                <p className="font-medium text-gray-800">{contatoSelecionado.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Assunto</p>
                <p className="font-medium text-gray-800">{contatoSelecionado.assunto || 'Nao informado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Mensagem</p>
                <p className="font-medium text-gray-800 whitespace-pre-wrap bg-gray-50 border rounded-lg p-3">
                  {contatoSelecionado.mensagem}
                </p>
              </div>
            </div>

            <form onSubmit={handleAtualizarContato} className="space-y-3">
              <header className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Atualizar atendimento</h4>
                {atualizarContatoMutation.isPending ? <span className="text-xs text-gray-500">Enviando...</span> : null}
              </header>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                <select
                  name="contato_status"
                  defaultValue={contatoSelecionado.status}
                  className="border rounded-lg px-2 py-1.5"
                >
                  {CONTATO_STATUS.filter((c) => c.value).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Resposta</span>
                <textarea
                  name="contato_resposta"
                  defaultValue={contatoSelecionado.resposta || ''}
                  className="border rounded-lg px-2 py-1.5 min-h-[120px]"
                  placeholder="Responda ao titular ou registre um resumo interno."
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Respondida em</span>
                <input
                  name="contato_respondida_em"
                  type="datetime-local"
                  defaultValue={toInputDateTime(contatoSelecionado.respondida_em)}
                  className="border rounded-lg px-2 py-1.5"
                />
              </label>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                disabled={atualizarContatoMutation.isPending}
              >
                Salvar atualização
              </button>
              {atualizarContatoMutation.isError ? (
                <p className="text-xs text-red-600">Nao foi possivel atualizar o contato.</p>
              ) : null}
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}
