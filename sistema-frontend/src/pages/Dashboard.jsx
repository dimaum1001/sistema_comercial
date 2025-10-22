import { useNavigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import api from '../services/api';
import {
  FiDollarSign,
  FiBox,
  FiUsers,
  FiShoppingCart,
  FiPackage,
  FiTruck,
  FiRefreshCw,
  FiPlus,
  FiCreditCard,
  FiHome,
} from 'react-icons/fi';
import { Page } from '../components/ui';

const StatsCard = lazy(() => import('../components/StatsCard'));
const FeatureCard = lazy(() => import('../components/FeatureCard'));

const fmtBRL = (value) =>
  Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const fmtInt = (value) => Intl.NumberFormat('pt-BR').format(Number(value || 0));

export default function Dashboard() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState('');

  const [resumo, setResumo] = useState({
    total_vendas: 0,
    total_produtos: 0,
    total_clientes: 0,
    total_contas_pagar: 0,
    txt_vendas: '',
    txt_produtos: '',
    txt_clientes: '',
    txt_contas_pagar: '',
    perc_vendas: 0,
    perc_produtos: 0,
    perc_clientes: 0,
    perc_contas_pagar: 0,
  });

  const fetchUsuarioEResumo = useCallback(
    async (signal) => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      if (!api.defaults.headers.common.Authorization) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
      }

      try {
        setErro('');
        const me = await api.get('/auth/me', { signal });
        setUsuario(me.data ?? null);

        const resumoResponse = await api.get('/dashboard/resumo', { signal });
        if (resumoResponse?.data && typeof resumoResponse.data === 'object') {
          setResumo((prev) => ({ ...prev, ...resumoResponse.data }));
        }
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401) {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }
        setErro('Nao foi possivel carregar o resumo agora. Tente novamente.');
        console.error('Dashboard erro:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchUsuarioEResumo(controller.signal);
    document.title = 'Dashboard - Sistema Comercial';
    return () => controller.abort();
  }, [fetchUsuarioEResumo]);

  const onRefresh = () => {
    setRefreshing(true);
    const controller = new AbortController();
    fetchUsuarioEResumo(controller.signal);
  };

  const headerActions = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className="btn-secondary"
      title="Atualizar resumo"
    >
      <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
      {refreshing ? 'Atualizando...' : 'Atualizar'}
    </button>
  );

  const headerContent = (
    <p className="text-sm text-slate-600">
      Bem-vindo, <span className="font-semibold text-slate-900">{usuario?.nome || 'Usuario'}</span>
    </p>
  );

  if (loading) {
    return (
      <Page
        title="Dashboard"
        subtitle="Visao geral do negocio"
        icon={<FiHome className="h-5 w-5" />}
        actions={headerActions}
        headerContent={headerContent}
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

  const features = [
    {
      key: 'produtos',
      title: 'Produtos',
      description: 'Gerencie o catalogo de produtos',
      icon: <FiPackage size={28} className="text-blue-500" />,
      onView: () => navigate('/produtos'),
      onAdd: () => navigate('/produtos/novo'),
      enabled: true,
    },
    {
      key: 'clientes',
      title: 'Clientes',
      description: 'Acompanhe e organize seus clientes',
      icon: <FiUsers size={28} className="text-purple-500" />,
      onView: () => navigate('/clientes'),
      onAdd: () => navigate('/clientes/novo'),
      enabled: true,
    },
    {
      key: 'vendas',
      title: 'Vendas',
      description: 'Registre novas vendas em poucos cliques',
      icon: <FiShoppingCart size={28} className="text-emerald-500" />,
      onView: () => navigate('/vendas'),
      onAdd: () => navigate('/vendas/novo'),
      enabled: true,
    },
    {
      key: 'estoque',
      title: 'Movimentos de Estoque',
      description: 'Controle entradas e saidas de estoque',
      icon: <FiBox size={28} className="text-orange-500" />,
      onView: () => navigate('/movimentos'),
      onAdd: () => navigate('/produtos'),
      enabled: true,
    },
    {
      key: 'financeiro',
      title: 'Financeiro',
      description: 'Gerencie contas a receber e a pagar',
      icon: <FiCreditCard size={28} className="text-rose-500" />,
      onView: () => navigate('/contas-receber'),
      onAdd: () => navigate('/contas-pagar'),
      enabled: true,
    },
    {
      key: 'fornecedores',
      title: 'Fornecedores',
      description: 'Organize parceiros e fornecedores',
      icon: <FiTruck size={28} className="text-slate-500" />,
      onView: () => navigate('/fornecedores'),
      onAdd: () => navigate('/fornecedores/cadastrar'),
      enabled: true,
    },
  ].filter((feature) => feature.enabled);

  return (
    <Page
      title="Dashboard"
      subtitle="Visao geral do negocio"
      icon={<FiHome className="h-5 w-5" />}
      actions={headerActions}
      headerContent={headerContent}
    >
      {erro && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 shadow-sm">
          {erro}
        </div>
      )}

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="card h-32 animate-pulse bg-white/60" />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Total de Vendas"
            value={fmtBRL(resumo.total_vendas)}
            percent={Number(resumo.perc_vendas) || 0}
            icon={<FiDollarSign size={24} className="text-green-500" />}
          />
          <StatsCard
            title="Produtos em Estoque"
            value={fmtInt(resumo.total_produtos)}
            percent={Number(resumo.perc_produtos) || 0}
            icon={<FiBox size={24} className="text-blue-500" />}
          />
          <StatsCard
            title="Clientes Ativos"
            value={fmtInt(resumo.total_clientes)}
            percent={Number(resumo.perc_clientes) || 0}
            icon={<FiUsers size={24} className="text-purple-500" />}
          />
          <StatsCard
            title="Contas a Pagar Pendentes"
            value={fmtBRL(resumo.total_contas_pagar)}
            percent={Number(resumo.perc_contas_pagar) || 0}
            icon={<FiCreditCard size={24} className="text-red-500" />}
          />
        </div>
      </Suspense>

      <div className="card flex flex-col gap-3 p-6">
        <div className="text-sm font-medium text-slate-600">Atalhos rapidos</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/vendas?nova=1')}
            className="btn-primary"
          >
            <FiPlus /> Nova venda
          </button>
          <button
            type="button"
            onClick={() => navigate('/produtos/novo')}
            className="btn-primary bg-blue-600 hover:bg-blue-700"
          >
            <FiPlus /> Novo produto
          </button>
          <button
            type="button"
            onClick={() => navigate('/clientes/novo')}
            className="btn-primary bg-purple-600 hover:bg-purple-700"
          >
            <FiPlus /> Novo cliente
          </button>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="card h-32 animate-pulse bg-white/60" />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.key}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              onView={feature.onView}
              onAdd={feature.onAdd}
            />
          ))}
        </div>
      </Suspense>
    </Page>
  );
}
