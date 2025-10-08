import { Fragment, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

/* ===================== Helpers ===================== */

const toApiDate = (val) => (val && val.length === 16 ? `${val}:00` : val)

const Badge = ({ children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-800',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${tones[tone] || tones.gray}`}>
      {children}
    </span>
  )
}

/* ===================== API calls ===================== */

const fetchLogs = async ({ queryKey }) => {
  const [_key, params, _buscarKey] = queryKey
  const res = await api.get('/auditoria/acessos', { params })
  const total = Number(res.headers['x-total-count'] || 0)
  return { data: res.data, total }
}

const fetchResumoUsuarios = async ({ queryKey }) => {
  const [_key, inicio, fim, _buscarKey] = queryKey
  const params = {}
  if (inicio) params.inicio = toApiDate(inicio)
  if (fim) params.fim = toApiDate(fim)
  const res = await api.get('/auditoria/usuarios', { params })
  return res.data
}

const fetchRotasPorUsuario = async (usuario_id, inicio, fim) => {
  const params = {}
  if (usuario_id) params.usuario_id = usuario_id
  if (inicio) params.inicio = toApiDate(inicio)
  if (fim) params.fim = toApiDate(fim)
  const res = await api.get('/auditoria/rotas', { params })
  return res.data
}

/* ===================== Page ===================== */

export default function Auditoria() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token') || ''

  // período default: últimas 48h (melhor p/ resumo)
  const now = new Date()
  const initStart = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  const toLocalDT = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`

  // estados
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [f, setF] = useState({
    inicio: toLocalDT(initStart),
    fim: toLocalDT(now),
    usuario_id: '',
    rota: '',
    metodo: '',
    status_code: '',
  })
  const [errorMsg, setErrorMsg] = useState('')
  const [buscarKey, setBuscarKey] = useState(0)

  // expand de rotas por usuário
  const [openUser, setOpenUser] = useState(null)
  const [rotasUser, setRotasUser] = useState([])
  const [loadingRotas, setLoadingRotas] = useState(false)

  // params para /acessos (paginado)
  const params = useMemo(() => {
    const base = { page, per_page: perPage }
    const filtros = {
      inicio: toApiDate(f.inicio),
      fim: toApiDate(f.fim),
      usuario_id: f.usuario_id.trim(),
      rota: f.rota.trim(),
      metodo: f.metodo || '',
      status_code: f.status_code || '',
    }
    for (const k of Object.keys(filtros)) {
      if (!String(filtros[k] ?? '').trim()) delete filtros[k]
    }
    return { ...base, ...filtros }
  }, [page, perPage, f])

  // query: acessos detalhados (paginado)
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    isFetching: isFetchingLogs,
  } = useQuery({
    queryKey: ['auditoria', params, buscarKey],
    queryFn: fetchLogs,
    keepPreviousData: true,
    enabled: !!token,
    retry: false,
    onError: (err) => {
      const status = err?.response?.status
      if (status === 401) setErrorMsg('Não autorizado. Faça login novamente ou verifique seu token.')
      else if (status === 403) setErrorMsg('Acesso negado. Somente administradores podem visualizar os logs.')
      else setErrorMsg('Não foi possível carregar os logs. Tente novamente.')
    },
    onSuccess: () => setErrorMsg(''),
  })

  // query: resumo por usuário (NÃO paginado, independe de perPage)
  const {
    data: usuariosResumo = [],
    isLoading: isLoadingResumo,
    isFetching: isFetchingResumo,
  } = useQuery({
    queryKey: ['auditoria-usuarios', f.inicio, f.fim, buscarKey],
    queryFn: fetchResumoUsuarios,
    enabled: !!token,
    keepPreviousData: true,
    retry: false,
  })

  const rows = logsData?.data ?? []
  const total = logsData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // ações
  const handleBuscar = () => {
    if (!token) {
      setErrorMsg('Não autorizado. Faça login novamente.')
      return
    }
    setErrorMsg('')
    if (page !== 1) setPage(1)
    setOpenUser(null)
    setRotasUser([])
    setBuscarKey((k) => k + 1)
  }

  const handleVerRotas = async (usuario_id) => {
    if (openUser === usuario_id) {
      setOpenUser(null)
      setRotasUser([])
      return
    }
    setLoadingRotas(true)
    try {
      const data = await fetchRotasPorUsuario(usuario_id, f.inicio, f.fim)
      setRotasUser(data)
      setOpenUser(usuario_id)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRotas(false)
    }
  }

  // busca inicial
  useEffect(() => {
    setBuscarKey((k) => k + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ===================== UI ===================== */

  const busy = isLoadingLogs || isFetchingLogs || isLoadingResumo || isFetchingResumo

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria de Acessos</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="border rounded-lg px-3 py-1.5 hover:bg-gray-50"
            title="Voltar para o dashboard"
          >
            ← Voltar
          </button>
          <button
            type="button"
            onClick={handleBuscar}
            className="rounded-lg px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={busy}
            title="Buscar registros pelo período e filtros"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded-xl p-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input
            type="datetime-local"
            className="border rounded-lg px-2 py-1.5"
            value={f.inicio}
            onChange={(e) => setF((s) => ({ ...s, inicio: e.target.value }))}
            title="Início"
          />
          <input
            type="datetime-local"
            className="border rounded-lg px-2 py-1.5"
            value={f.fim}
            onChange={(e) => setF((s) => ({ ...s, fim: e.target.value }))}
            title="Fim"
          />
          <input
            placeholder="Usuário (UUID)"
            className="border rounded-lg px-2 py-1.5"
            value={f.usuario_id}
            onChange={(e) => setF((s) => ({ ...s, usuario_id: e.target.value }))}
          />
          <input
            placeholder="Rota ex: /clientes"
            className="border rounded-lg px-2 py-1.5"
            value={f.rota}
            onChange={(e) => setF((s) => ({ ...s, rota: e.target.value }))}
          />
          <select
            className="border rounded-lg px-2 py-1.5"
            value={f.metodo}
            onChange={(e) => setF((s) => ({ ...s, metodo: e.target.value }))}
          >
            <option value="">Método</option>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <input
            placeholder="Status (200/401/404...)"
            className="border rounded-lg px-2 py-1.5"
            value={f.status_code}
            onChange={(e) => setF((s) => ({ ...s, status_code: e.target.value }))}
          />
        </div>
      </div>

      {/* Avisos */}
      {busy && <div className="text-sm opacity-70">Carregando…</div>}
      {errorMsg && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Resumo por usuário (independente da paginação) */}
      <div className="bg-white border rounded-xl shadow-sm">
        <div className="px-3 py-2 border-b font-medium">Usuários que acessaram no período</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Usuário</th>
                <th className="px-3 py-2 text-center">Acessos</th>
                <th className="px-3 py-2 text-center">Rotas distintas</th>
                <th className="px-3 py-2 text-left">Último acesso</th>
                <th className="px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosResumo.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-600" colSpan={5}>
                    Nenhum usuário autenticado no período.
                  </td>
                </tr>
              ) : (
                usuariosResumo.map((u) => (
                  <Fragment key={u.usuario_id}>
                    <tr className="border-t hover:bg-gray-50/60">
                      <td className="px-3 py-2">{u.usuario_nome || u.usuario_id}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge tone="indigo">{u.acessos}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge tone="blue">{u.rotas_distintas}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          className="border rounded-lg px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => handleVerRotas(u.usuario_id)}
                        >
                          {openUser === u.usuario_id ? 'Fechar rotas' : 'Ver rotas'}
                        </button>
                      </td>
                    </tr>

                    {openUser === u.usuario_id && (
                      <tr className="bg-gray-50/40">
                        <td colSpan={5} className="px-3 py-2">
                          {loadingRotas ? (
                            <div className="text-sm opacity-70">Carregando rotas…</div>
                          ) : rotasUser.length === 0 ? (
                            <div className="text-sm text-gray-600">Nenhuma rota encontrada para o período.</div>
                          ) : (
                            <div className="overflow-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Rota</th>
                                    <th className="px-2 py-1">Acessos</th>
                                    <th className="px-2 py-1">GET</th>
                                    <th className="px-2 py-1">POST</th>
                                    <th className="px-2 py-1">PUT</th>
                                    <th className="px-2 py-1">DELETE</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rotasUser.map((r) => (
                                    <tr key={r.rota} className="border-t">
                                      <td className="px-2 py-1">{r.rota}</td>
                                      <td className="px-2 py-1 text-center">{r.acessos}</td>
                                      <td className="px-2 py-1 text-center">{r.get}</td>
                                      <td className="px-2 py-1 text-center">{r.post}</td>
                                      <td className="px-2 py-1 text-center">{r.put}</td>
                                      <td className="px-2 py-1 text-center">{r.delete}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhe (paginado) */}
      <div className="bg-white border rounded-xl shadow-sm">
        <div className="px-3 py-2 border-b font-medium">Registros detalhados</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Data (BR)</th>
                <th className="px-3 py-2">Mét.</th>
                <th className="px-3 py-2 text-left">Rota</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-left">Usuário</th>
                <th className="px-3 py-2 text-left">IP (hash)</th>
                <th className="px-3 py-2 text-left">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-600" colSpan={7}>
                    Sem registros
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-3 py-2">
                      {new Date(r.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge tone="blue">{r.metodo}</Badge>
                    </td>
                    <td className="px-3 py-2">{r.rota}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge tone={r.status_code >= 400 ? 'red' : 'green'}>{r.status_code}</Badge>
                    </td>
                    <td className="px-3 py-2">{r.usuario_nome || r.usuario_id || '-'}</td>
                    <td className="px-3 py-2">{r.ip_hash || '-'}</td>
                    <td className="px-3 py-2">{r.user_agent || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center gap-2 p-3">
          <button
            className="border rounded-lg px-3 py-1.5 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className="text-sm">
            página {page} / {Math.max(1, Math.ceil(total / perPage))}
          </span>
          <button
            className="border rounded-lg px-3 py-1.5 disabled:opacity-50"
            disabled={page >= Math.max(1, Math.ceil(total / perPage))}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm opacity-70">por página</span>
            <select
              className="border rounded-lg px-2 py-1.5"
              value={perPage}
              onChange={(e) => {
                setPage(1)
                setPerPage(Number(e.target.value))
                setBuscarKey((k) => k + 1)
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
