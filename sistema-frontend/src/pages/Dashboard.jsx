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
} from 'react-icons/fi';

// Componentes lazy (melhor TTFR)
const StatsCard = lazy(() => import('../components/StatsCard'));
const FeatureCard = lazy(() => import('../components/FeatureCard'));

// Helpers
const fmtBRL = (n) =>
  Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0));
const fmtInt = (n) => Intl.NumberFormat('pt-BR').format(Number(n || 0));

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

  // carrega /auth/me e /dashboard/resumo
  const fetchUsuarioEResumo = useCallback(async (signal) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // injeta Authorization apenas uma vez
    if (!api.defaults.headers.common.Authorization) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }

    try {
      setErro('');
      const me = await api.get('/auth/me', { signal });
      setUsuario(me.data ?? null);

      const r = await api.get('/dashboard/resumo', { signal });
      if (r?.data && typeof r.data === 'object') {
        setResumo((prev) => ({ ...prev, ...r.data }));
      }
    } catch (error) {
      // 401 → volta pro login
      const status = error?.response?.status;
      if (status === 401) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }
      // Mantém usuário logado e mostra um aviso no topo
      setErro('Não foi possível carregar o resumo agora. Tente novamente.');
      console.error('Dashboard erro:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  // efeito inicial + cleanup (evita setState após unmount)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-blue-200 rounded-full mb-4" />
          <div className="h-4 w-32 bg-blue-200 rounded" />
        </div>
      </div>
    );
  }

  // cards de features (somente rotas que existem)
  const features = [
    {
      key: 'produtos',
      title: 'Produtos',
      description: 'Gerencie seu catálogo de produtos',
      icon: <FiPackage size={28} className="text-blue-500" />,
      onView: () => navigate('/produtos'),
      onAdd: () => navigate('/produtos/novo'),
      enabled: true,
    },
    {
      key: 'clientes',
      title: 'Clientes',
      description: 'Gerencie sua base de clientes',
      icon: <FiUsers size={28} className="text-purple-500" />,
      onView: () => navigate('/clientes'),
      onAdd: () => navigate('/clientes/novo'),
      enabled: true,
    },
    {
      key: 'vendas',
      title: 'Vendas',
      description: 'Registre e acompanhe suas vendas',
      icon: <FiShoppingCart size={28} className="text-green-500" />,
      onView: () => navigate('/vendas'),
      onAdd: () => navigate('/vendas?nova=1'),
      enabled: true,
    },
    {
      key: 'movimentos',
      title: 'Movimentos',
      description: 'Entradas, saídas e ajustes de estoque',
      icon: <FiBox size={28} className="text-orange-500" />,
      onView: () => navigate('/movimentos'),
      onAdd: () => navigate('/movimentos?registrar=1'),
      enabled: true,
    },
    {
      key: 'fornecedores',
      title: 'Fornecedores',
      description: 'Cadastro e gestão de fornecedores',
      icon: <FiTruck size={28} className="text-indigo-500" />,
      onView: () => navigate('/fornecedores'),
      onAdd: () => navigate('/fornecedores/cadastrar'),
      enabled: true,
    },
  ].filter((f) => f.enabled);

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Bem-vindo, {usuario?.nome || 'Usuário'}
          </h2>
          <p className="text-gray-600">Aqui está o resumo do seu negócio</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
            title="Atualizar"
          >
            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-4 text-sm px-3 py-2 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">
          {erro}
        </div>
      )}

      {/* Cards de métricas */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm h-32 animate-pulse" />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
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

      {/* Atalhos rápidos (aparecem só se as rotas existirem) */}
      <div className="mb-8">
        <div className="text-sm text-gray-600 mb-2">Atalhos rápidos</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/vendas?nova=1')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700"
            title="Nova Venda"
          >
            <FiPlus /> Nova venda
          </button>
          <button
            onClick={() => navigate('/produtos/novo')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            title="Novo Produto"
          >
            <FiPlus /> Novo produto
          </button>
          <button
            onClick={() => navigate('/clientes/novo')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700"
            title="Novo Cliente"
          >
            <FiPlus /> Novo cliente
          </button>
        </div>
      </div>

      {/* Funcionalidades */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm h-32 animate-pulse" />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <FeatureCard
              key={f.key}
              title={f.title}
              description={f.description}
              icon={f.icon}
              onView={f.onView}
              onAdd={f.onAdd}
            />
          ))}
        </div>
      </Suspense>
    </div>
  );
}
