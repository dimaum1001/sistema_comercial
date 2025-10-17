import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../services/api'

const fetchDpoInfo = async () => {
  const res = await api.get('/lgpd/dpo')
  return res.data
}

const DPO_STATEMENT = `Em conformidade com a Lei Geral de Protecao de Dados (LGPD), este canal permite que titulares tirem duvidas
e encaminhem solicitacoes diretamente ao Encarregado de Dados (DPO). As mensagens sao registradas e respondidas em ate 15 dias.`

export default function DpoContato() {
  const { data: dpoInfo, isLoading } = useQuery({
    queryKey: ['dpo-info-public'],
    queryFn: fetchDpoInfo,
  })

  const [form, setForm] = useState({
    nome: '',
    email: '',
    assunto: '',
    mensagem: '',
  })
  const [ack, setAck] = useState(null)

  const contatoMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/lgpd/dpo/contatos', payload)
      return res.data
    },
    onSuccess: (data) => {
      setAck(data)
      setForm({
        nome: '',
        email: '',
        assunto: '',
        mensagem: '',
      })
    },
  })

  const prazoFormatado = useMemo(() => {
    if (!ack) return ''
    try {
      return new Date(ack.prazo_resposta).toLocaleString('pt-BR')
    } catch (err) {
      return ack.prazo_resposta
    }
  }, [ack])

  const handleSubmit = (event) => {
    event.preventDefault()
    contatoMutation.mutate({
      nome: form.nome.trim(),
      email: form.email.trim(),
      assunto: form.assunto.trim(),
      mensagem: form.mensagem.trim(),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white border rounded-2xl shadow-sm p-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-800">Encarregado de Dados (DPO)</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            {DPO_STATEMENT}
          </p>
        </header>

        {isLoading ? (
          <div className="text-sm text-gray-500">Carregando informacoes do DPO...</div>
        ) : dpoInfo ? (
          <section className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-2">
            <h2 className="text-lg font-medium text-blue-900">Contato oficial</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-blue-700 uppercase text-xs tracking-wide">Nome</dt>
                <dd className="font-medium text-blue-900">{dpoInfo.nome}</dd>
              </div>
              <div>
                <dt className="text-blue-700 uppercase text-xs tracking-wide">Horario de atendimento</dt>
                <dd className="font-medium text-blue-900">{dpoInfo.horario_atendimento || 'Nao informado'}</dd>
              </div>
              <div>
                <dt className="text-blue-700 uppercase text-xs tracking-wide">Canal preferencial</dt>
                <dd className="font-medium text-blue-900">{dpoInfo.canal_preferencial}</dd>
              </div>
              <div>
                <dt className="text-blue-700 uppercase text-xs tracking-wide">E-mail dedicado</dt>
                <dd className="font-medium text-blue-900">{dpoInfo.email}</dd>
              </div>
              <div>
                <dt className="text-blue-700 uppercase text-xs tracking-wide">Telefone</dt>
                <dd className="font-medium text-blue-900">{dpoInfo.telefone || 'Nao informado'}</dd>
              </div>
              {dpoInfo.canal_alternativo ? (
                <div className="sm:col-span-2">
                  <dt className="text-blue-700 uppercase text-xs tracking-wide">Canal alternativo</dt>
                  <dd className="font-medium text-blue-900">{dpoInfo.canal_alternativo}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : (
          <div className="text-sm text-red-600">
            Nao foi possivel carregar as informacoes do DPO. Tente novamente mais tarde.
          </div>
        )}

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Envie sua mensagem</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Nome completo</span>
                <input
                  required
                  type="text"
                  className="border rounded-lg px-3 py-2"
                  value={form.nome}
                  maxLength={150}
                  onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">E-mail para resposta</span>
                <input
                  required
                  type="email"
                  className="border rounded-lg px-3 py-2"
                  value={form.email}
                  maxLength={150}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Assunto (opcional)</span>
              <input
                type="text"
                className="border rounded-lg px-3 py-2"
                value={form.assunto}
                maxLength={120}
                onChange={(event) => setForm((prev) => ({ ...prev, assunto: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Mensagem detalhada</span>
              <textarea
                required
                className="border rounded-lg px-3 py-2 min-h-[160px]"
                value={form.mensagem}
                maxLength={4000}
                onChange={(event) => setForm((prev) => ({ ...prev, mensagem: event.target.value }))}
                placeholder="Informe o maximo de detalhes possiveis para que possamos responder em ate 15 dias."
              />
            </label>

            <p className="text-xs text-gray-500">
              Ao enviar, voce autoriza o tratamento dos dados informados exclusivamente para atendimento da sua solicitacao LGPD.
            </p>

            <button
              type="submit"
              className="inline-flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              disabled={contatoMutation.isPending}
            >
              {contatoMutation.isPending ? 'Enviando...' : 'Enviar mensagem'}
            </button>
            {contatoMutation.isError ? (
              <p className="text-xs text-red-600">
                Nao foi possivel registrar a mensagem. Verifique os campos e tente novamente.
              </p>
            ) : null}
          </form>
        </section>

        {ack ? (
          <section className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-800 space-y-1">
            <p className="font-medium">Mensagem registrada com sucesso.</p>
            <p>
              Protocolo: <span className="font-semibold">{ack.protocolo}</span>
            </p>
            <p>
              Prazo maximo de resposta: <span className="font-semibold">{prazoFormatado}</span>
            </p>
            <p>
              Guarde o protocolo para futuras consultas com o nosso DPO.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}

