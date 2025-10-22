import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { FiCheckCircle, FiTrash2, FiRefreshCw, FiCreditCard } from 'react-icons/fi';
import { Page, Card, EmptyState } from '../components/ui';
import { classNames } from '../utils/classNames';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default function ContasReceber() {
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const carregarPagamentos = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get('/pagamentos/pendentes');
      setPagamentos(Array.isArray(resp?.data) ? resp.data : []);
      setError('');
    } catch (err) {
      console.error('Erro ao carregar pagamentos:', err);
      setError('Nao foi possivel carregar as cobrancas pendentes.');
      setPagamentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarPagamentos();
  }, [carregarPagamentos]);

  const darBaixa = async (id) => {
    setProcessing(true);
    try {
      await api.put(`/pagamentos/${id}`, { status: 'pago' });
      await carregarPagamentos();
    } catch (err) {
      console.error('Erro ao dar baixa:', err);
      setError('Nao foi possivel marcar o pagamento como recebido.');
    } finally {
      setProcessing(false);
    }
  };

  const excluirPagamento = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este pagamento?')) return;
    setProcessing(true);
    try {
      await api.delete(`/pagamentos/${id}`);
      await carregarPagamentos();
    } catch (err) {
      console.error('Erro ao excluir pagamento:', err);
      setError('Nao foi possivel excluir o pagamento.');
    } finally {
      setProcessing(false);
    }
  };

  const headerActions = (
    <button
      type="button"
      onClick={carregarPagamentos}
      disabled={loading || processing}
      className="btn-secondary"
      title="Atualizar lista"
    >
      <FiRefreshCw className={loading ? 'animate-spin' : ''} />
      Atualizar
    </button>
  );

  if (loading) {
    return (
      <Page
        title="Contas a Receber"
        subtitle="Acompanhe pagamentos pendentes e registre baixas rapidamente."
        icon={<FiCreditCard className="h-5 w-5" />}
        actions={headerActions}
      >
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-blue-100 bg-white/80 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-blue-200" />
            <div className="h-4 w-32 animate-pulse rounded-full bg-blue-200" />
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Contas a Receber"
      subtitle="Acompanhe pagamentos pendentes e registre baixas rapidamente."
      icon={<FiCreditCard className="h-5 w-5" />}
      actions={headerActions}
    >
      {error && (
        <Card className="border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error}
        </Card>
      )}

      {pagamentos.length === 0 ? (
        <EmptyState
          title="Tudo certo por aqui"
          description="Nenhum pagamento pendente no momento. Volte mais tarde para novas atualizacoes."
        />
      ) : (
        <Card className="table-shell">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Forma
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Parcela
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pagamentos.map((pagamento) => {
                  const parcelaInfo =
                    pagamento.parcela_numero && pagamento.parcela_total
                      ? `${pagamento.parcela_numero}/${pagamento.parcela_total}`
                      : '-';

                  const vencimento = pagamento.data_vencimento
                    ? dateFormatter.format(new Date(pagamento.data_vencimento))
                    : '-';

                  return (
                    <tr key={pagamento.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {pagamento.venda?.cliente?.nome || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{pagamento.forma_pagamento || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {currency.format(Number(pagamento.valor || 0))}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{vencimento}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{parcelaInfo}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => darBaixa(pagamento.id)}
                            disabled={processing}
                            className="btn-primary bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          >
                            <FiCheckCircle />
                            Baixar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirPagamento(pagamento.id)}
                            disabled={processing}
                            className="btn-danger bg-rose-600 hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                          >
                            <FiTrash2 />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
