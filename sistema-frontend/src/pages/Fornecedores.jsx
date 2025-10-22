import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiUserPlus, FiArrowLeft, FiEdit, FiTrash2, FiSearch, FiTruck } from 'react-icons/fi';
import { Page, EmptyState, Card } from '../components/ui';

function useDebounced(value, delay = 300) {
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setCurrentValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return currentValue;
}

function formatarDocumento(valor) {
  if (!valor) return 'Nao informado';
  const digits = String(valor).replace(/[^0-9]/g, '');
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  if (digits.length > 4) {
    const masked = '*'.repeat(digits.length - 4);
    return `${masked}${digits.slice(-4)}`;
  }
  return '*'.repeat(Math.max(0, digits.length - 1)) + digits.slice(-1);
}

function formatarTelefone(valor) {
  if (!valor) return 'Nao informado';
  const n = String(valor).replace(/\D/g, '');
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (n.length === 8) return n.replace(/(\d{4})(\d{4})/, '$1-$2');
  return n;
}

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [message, setMessage] = useState('');
  const debouncedSearch = useDebounced(searchTerm, 400);

  const navigate = useNavigate();

  const fetchFornecedores = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const limitPlusOne = pageSize + 1;
      const params = {
        offset,
        limit: limitPlusOne,
      };
      const term = debouncedSearch.trim();
      if (term) {
        params.q = term;
        params.search = term;
        params.term = term;
        params.nome = term;
      }

      const response = await api.get('/fornecedores', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.items)
        ? response.data.items
        : [];

      if (data.length > pageSize) {
        setHasMore(true);
        setFornecedores(data.slice(0, pageSize));
      } else {
        setHasMore(false);
        setFornecedores(data);
      }

      const total =
        Number(response?.headers?.['x-total-count']) ??
        Number(response?.headers?.['x-items-count']) ??
        Number(response?.headers?.['x-total']) ??
        (typeof response?.data?.total === 'number' ? response.data.total : null);

      setTotalCount(typeof total === 'number' ? total : null);
      setMessage('');
    } catch (err) {
      console.error('Erro ao buscar fornecedores:', err);
      setMessage('Nao foi possivel carregar os fornecedores.');
      setHasMore(false);
      setFornecedores([]);
      setTotalCount(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, navigate, page, pageSize]);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  useEffect(() => {
    setPage((prev) => (prev === 1 ? prev : 1));
  }, [debouncedSearch]);

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/fornecedores/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchFornecedores();
    } catch (err) {
      console.error('Erro ao excluir fornecedor:', err);
      setMessage('Nao foi possivel excluir o fornecedor.');
    }
  };

  const handlePrev = () => {
    if (page > 1) setPage((prev) => prev - 1);
  };

  const handleNext = () => {
    if (hasMore) setPage((prev) => prev + 1);
  };

  const handlePageSizeChange = (event) => {
    const newSize = Number(event.target.value) || 10;
    setPageSize(newSize);
    setPage(1);
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <span>Mostrar</span>
        <select value={pageSize} onChange={handlePageSizeChange} className="select h-9 w-24">
          {[10, 25, 50, 100].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span>por pagina</span>
      </div>
      <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
        <FiArrowLeft className="h-4 w-4" />
        Voltar
      </button>
      <button type="button" onClick={() => navigate('/fornecedores/cadastrar')} className="btn-primary">
        <FiUserPlus className="h-4 w-4" />
        Novo fornecedor
      </button>
    </div>
  );

  const filteredFornecedores = useMemo(() => {
    if (!debouncedSearch) return fornecedores;
    const term = debouncedSearch.toLowerCase();
    return fornecedores.filter((fornecedor) => {
      const nome = (fornecedor.nome || fornecedor.razao_social || '').toLowerCase();
      const documento = (fornecedor.cnpj_cpf || '').toLowerCase();
      const email = (fornecedor.email || '').toLowerCase();
      const telefone = (fornecedor.telefone || '').toLowerCase();
      return (
        nome.includes(term) ||
        documento.includes(term) ||
        email.includes(term) ||
        telefone.includes(term)
      );
    });
  }, [debouncedSearch, fornecedores]);

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = rangeStart + filteredFornecedores.length - 1;
  const totalDisplay = typeof totalCount === 'number' ? totalCount : fornecedores.length;

  if (loading) {
    return (
      <Page
        title="Fornecedores"
        subtitle="Gerencie fornecedores e mantenha os dados atualizados."
        icon={<FiTruck className="h-5 w-5" />}
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
      title="Fornecedores"
      subtitle="Gerencie fornecedores e mantenha os dados atualizados."
      icon={<FiTruck className="h-5 w-5" />}
      actions={headerActions}
    >
      {message && (
        <Card className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</Card>
      )}

      <Card className="p-4 sm:p-6">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquise por nome, CNPJ/CPF, e-mail ou telefone"
            className="input pl-12"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </Card>

      {filteredFornecedores.length === 0 ? (
        <EmptyState
          title={debouncedSearch ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
          description={
            debouncedSearch
              ? 'Ajuste os filtros ou tente outro termo de busca.'
              : 'Cadastre o primeiro fornecedor para organizar sua base de parceiros.'
          }
          actions={
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/fornecedores/cadastrar')}
            >
              <FiUserPlus className="h-4 w-4" />
              Cadastrar fornecedor
            </button>
          }
        />
      ) : (
        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nome / Razao social
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    CNPJ/CPF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Data cadastro
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredFornecedores.map((fornecedor) => {
                  const nome = fornecedor.nome || fornecedor.razao_social || '-';
                  return (
                    <tr key={fornecedor.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                            {(nome.charAt(0) || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{nome}</div>
                            <div className="text-sm text-slate-500">{fornecedor.email || 'Sem email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatarDocumento(fornecedor.cnpj_cpf)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatarTelefone(fornecedor.telefone)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {fornecedor.criado_em
                          ? new Date(fornecedor.criado_em).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/fornecedores/editar/${fornecedor.id}`)}
                            className="btn-ghost h-9 w-9 rounded-full p-0 text-blue-600 hover:text-blue-700"
                            title="Editar"
                          >
                            <FiEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(fornecedor.id)}
                            className="btn-ghost h-9 w-9 rounded-full p-0 text-rose-600 hover:text-rose-700"
                            title="Excluir"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Card className="flex flex-col gap-3 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Pagina <span className="font-semibold text-slate-900">{page}</span>{' '}
          {filteredFornecedores.length > 0 ? (
            <>
              mostrando{' '}
              <span className="font-semibold text-slate-900">
                {rangeStart}-{rangeEnd}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{totalDisplay || '--'}</span> registros
            </>
          ) : (
            'sem registros na pagina atual'
          )}{' '}
          ({pageSize} por pagina){' '}
          <span className="font-semibold text-slate-900">
            Total geral: {typeof totalCount === 'number' ? totalCount : '--'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={page === 1}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!hasMore}
            className="btn-primary disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            Proxima
          </button>
        </div>
      </Card>
    </Page>
  );
}
