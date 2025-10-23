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
  FiTrendingUp,
  FiPieChart,
  FiAlertTriangle,
  FiAward,
  FiBarChart2,
} from 'react-icons/fi';
import { Page, Card } from '../components/ui';

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
    lucro_mes: 0,
    ticket_medio: 0,
  });
  const [topProdutosLucro, setTopProdutosLucro] = useState([]);
  const [topClientes, setTopClientes] = useState([]);
  const [estoqueCritico, setEstoqueCritico] = useState([]);

  const fmtQuantidade = (value) =>
    Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(
      Number(value || 0),
    );

  const fmtPercent = (value) => {
    const num = Number(value || 0);
    return `${num.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })}%`;
  };

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
          const {
            top_produtos_lucro: produtos = [],
            top_clientes: clientes = [],
            estoque_critico: estoque = []
          } = resumoResponse.data;

          const numeros = { ...resumoResponse.data };
          delete numeros.top_produtos_lucro;
          delete numeros.top_clientes;
          delete numeros.estoque_critico;

          setResumo((prev) => ({ ...prev, ...numeros }));
          setTopProdutosLucro(Array.isArray(produtos) ? produtos : []);
          setTopClientes(Array.isArray(clientes) ? clientes : []);
          setEstoqueCritico(Array.isArray(estoque) ? estoque : []);
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
        setTopProdutosLucro([]);
        setTopClientes([]);
        setEstoqueCritico([]);
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
      key: 'relatorios',
      title: 'Relatorios',
      description: 'Visualize indicadores e dados consolidados',
      icon: <FiBarChart2 size={28} className="text-indigo-500" />,
      onView: () => navigate('/relatorios'),
      onAdd: () => navigate('/relatorios'),
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
      <div className="space-y-6">
        {erro && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 shadow-sm">
            {erro}
          </div>
        )}

        <Suspense
          fallback={
            <Card padding="p-0" bodyClassName="space-y-0">
              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            </Card>
          }
        >
          <Card
            title="Indicadores rápidos"
            description="Visao consolidada do desempenho no mes atual."
            padding="p-0"
            bodyClassName="space-y-0"
          >
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
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
              <StatsCard
                title="Lucro do Mes"
                value={fmtBRL(resumo.lucro_mes)}
                percent={undefined}
                icon={<FiTrendingUp size={24} className="text-amber-500" />}
              />
              <StatsCard
                title="Ticket Medio (mes)"
                value={fmtBRL(resumo.ticket_medio)}
                percent={undefined}
                icon={<FiPieChart size={24} className="text-indigo-500" />}
              />
            </div>
          </Card>
        </Suspense>

        <Card
          title="Atalhos rapidos"
          description="Crie novos registros sem sair do dashboard."
          bodyClassName="space-y-0"
        >
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
            <button
              type="button"
              onClick={() => navigate('/relatorios')}
              className="btn-primary bg-indigo-600 hover:bg-indigo-700"
            >
              <FiBarChart2 /> Relatorios
            </button>
          </div>
        </Card>

        <Suspense
          fallback={
            <Card padding="p-0" bodyClassName="space-y-0">
              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            </Card>
          }
        >
          <Card
            title="Outras areas do sistema"
            description="Explore funcoes complementares conforme a necessidade."
            padding="p-0"
            bodyClassName="space-y-0"
          >
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
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
          </Card>
        </Suspense>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card
            title="Produtos com maior lucro"
            description="Ultimos 90 dias com base no custo medio cadastrado."
            bodyClassName="space-y-0"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Produto</th>
                    <th className="px-3 py-2 font-semibold text-right">Qtd.</th>
                    <th className="px-3 py-2 font-semibold text-right">Faturamento</th>
                    <th className="px-3 py-2 font-semibold text-right">Custo</th>
                    <th className="px-3 py-2 font-semibold text-right">Lucro</th>
                    <th className="px-3 py-2 font-semibold text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {topProdutosLucro.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                        Ainda nao ha dados suficientes para calcular os produtos mais lucrativos.
                      </td>
                    </tr>
                  ) : (
                    topProdutosLucro.map((produto) => (
                      <tr key={produto.produto_id} className="border-b last:border-0">
                        <td className="px-3 py-3 font-medium text-slate-700">{produto.nome}</td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          {fmtQuantidade(produto.quantidade)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {fmtBRL(produto.faturamento)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          {fmtBRL(produto.custo_estimado)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                          {fmtBRL(produto.lucro)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          {fmtPercent(produto.margem)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card
              title="Clientes com maior faturamento"
              description="Volume acumulado nos ultimos 90 dias."
              bodyClassName="space-y-0"
            >
              {topClientes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Sem dados suficientes para ranquear clientes no periodo.
                </div>
              ) : (
                <ul className="space-y-3">
                  {topClientes.map((cliente) => (
                    <li
                      key={cliente.cliente_id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{cliente.nome}</p>
                        <p className="text-xs text-slate-500">
                          {cliente.vendas} {cliente.vendas === 1 ? 'venda' : 'vendas'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600">
                          {fmtBRL(cliente.faturamento)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Estoque em alerta"
              description="Produtos abaixo do minimo cadastrado."
              bodyClassName="space-y-3"
            >
              {estoqueCritico.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Nenhum produto abaixo do estoque minimo no momento.
                </div>
              ) : (
                estoqueCritico.map((item) => (
                  <div
                    key={item.produto_id}
                    className="flex flex-col rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-700"
                  >
                    <div className="font-semibold text-rose-800">{item.nome}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      <span>
                        Estoque atual:{' '}
                        <strong>
                          {fmtQuantidade(item.estoque)} {item.unidade || ''}
                        </strong>
                      </span>
                      <span>
                        Minimo:{' '}
                        <strong>
                          {fmtQuantidade(item.estoque_minimo)} {item.unidade || ''}
                        </strong>
                      </span>
                      <span>
                        Faltam:{' '}
                        <strong>
                          {fmtQuantidade(
                            Math.max(Number(item.estoque_minimo || 0) - Number(item.estoque || 0), 0),
                          )}{' '}
                          {item.unidade || ''}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      </div>
    </Page>
  );
}
