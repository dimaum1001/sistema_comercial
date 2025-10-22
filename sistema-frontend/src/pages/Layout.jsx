import { useEffect, useState, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import api from '../services/api';
import {
  FiHome,
  FiMenu,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiLogOut,
  FiLayers,
  FiShoppingCart,
  FiCreditCard,
  FiBarChart2,
  FiPackage,
  FiUsers,
  FiTruck,
  FiTag,
  FiTrendingUp,
  FiBox,
  FiPieChart,
  FiList,
  FiShield,
  FiGrid,
  FiFileText,
  FiUser,
} from 'react-icons/fi';
import { classNames } from '../utils/classNames';

const MENU_PERSIST_KEY = 'menuOpen';

const defaultOpenSections = {
  cadastros: true,
  vendas: true,
  financeiro: false,
  relatorios: false,
  admin: false,
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [usuario, setUsuario] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => {
    try {
      const saved = localStorage.getItem(MENU_PERSIST_KEY);
      return saved ? { ...defaultOpenSections, ...JSON.parse(saved) } : defaultOpenSections;
    } catch (_) {
      return defaultOpenSections;
    }
  });

  useEffect(() => {
    localStorage.setItem(MENU_PERSIST_KEY, JSON.stringify(openSections));
  }, [openSections]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const fetchUsuario = async () => {
      try {
        const response = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsuario(response.data);
        localStorage.setItem('usuario', JSON.stringify(response.data));
      } catch (error) {
        console.error('Erro ao buscar usuario:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        navigate('/login', { replace: true });
      }
    };

    fetchUsuario();
  }, [navigate]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login', { replace: true });
  };

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const relatoriosTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'vendas-resumo';
  }, [location.search]);

  const isAdmin = String(usuario?.tipo || '').toLowerCase() === 'admin';
  const cargo = usuario?.tipo ? usuario.tipo.toUpperCase() : 'USUARIO';

  const navSections = useMemo(() => {
    const sections = [
      {
        id: 'cadastros',
        title: 'Cadastros',
        icon: FiLayers,
        items: [
          { id: 'produtos', label: 'Produtos', to: '/produtos', icon: FiPackage },
          { id: 'clientes', label: 'Clientes', to: '/clientes', icon: FiUsers },
          { id: 'fornecedores', label: 'Fornecedores', to: '/fornecedores', icon: FiTruck },
        ],
      },
      {
        id: 'vendas',
        title: 'Vendas e Estoque',
        icon: FiShoppingCart,
        items: [
          { id: 'vendas', label: 'Vendas', to: '/vendas', icon: FiTrendingUp },
          { id: 'estoque', label: 'Movimentos de Estoque', to: '/movimentos', icon: FiBox },
          { id: 'tabela-precos', label: 'Tabela de Precos', to: '/produtos/precos', icon: FiList },
        ],
      },
      {
        id: 'financeiro',
        title: 'Financeiro',
        icon: FiCreditCard,
        items: [
          { id: 'contas-receber', label: 'Contas a Receber', to: '/contas-receber', icon: FiCreditCard },
          { id: 'contas-pagar', label: 'Contas a Pagar', to: '/contas-pagar', icon: FiTag },
        ],
      },
      {
        id: 'relatorios',
        title: 'Relatorios',
        icon: FiBarChart2,
        items: [
          {
            id: 'relatorio-vendas',
            label: 'Vendas por Periodo',
            to: '/relatorios?tab=vendas-resumo',
            icon: FiTrendingUp,
            match: () => location.pathname.startsWith('/relatorios') && relatoriosTab === 'vendas-resumo',
          },
          {
            id: 'relatorio-produtos',
            label: 'Produtos em Destaque',
            to: '/relatorios?tab=produtos',
            icon: FiPackage,
            match: () => location.pathname.startsWith('/relatorios') && relatoriosTab === 'produtos',
          },
          {
            id: 'relatorio-estoque',
            label: 'Estoque Atual',
            to: '/relatorios?tab=estoque',
            icon: FiPieChart,
            match: () => location.pathname.startsWith('/relatorios') && relatoriosTab === 'estoque',
          },
          {
            id: 'relatorio-ranking',
            label: 'Ranking de Clientes',
            to: '/relatorios?tab=ranking',
            icon: FiUsers,
            match: () => location.pathname.startsWith('/relatorios') && relatoriosTab === 'ranking',
          },
        ],
      },
    ];

    if (isAdmin) {
      sections.push({
        id: 'admin',
        title: 'Administrativo',
        icon: FiShield,
        items: [
          { id: 'admin-usuarios', label: 'Usuarios', to: '/usuarios', icon: FiUser },
          { id: 'admin-lgpd', label: 'Direitos LGPD', to: '/admin/lgpd', icon: FiShield },
          { id: 'admin-unidades', label: 'Unidades de Medida', to: '/admin/unidades', icon: FiGrid },
          { id: 'admin-auditoria', label: 'Auditoria', to: '/admin/auditoria', icon: FiFileText },
        ],
      });
    }

    return sections;
  }, [isAdmin, location.pathname, relatoriosTab]);

  const isItemActive = (item) => {
    if (typeof item.match === 'function') {
      return item.match();
    }

    if (!item.to) return false;

    if (item.to.includes('?')) {
      const [path, search] = item.to.split('?');
      if (!location.pathname.startsWith(path)) {
        return false;
      }
      if (!search) return true;
      const targetParams = new URLSearchParams(search);
      const currentParams = new URLSearchParams(location.search);
      return Array.from(targetParams.keys()).every(
        (key) => targetParams.get(key) === currentParams.get(key),
      );
    }

    return location.pathname.startsWith(item.to);
  };

  const handleNavigate = (to) => {
    navigate(to);
  };

  const renderNavButton = (item) => {
    const active = isItemActive(item);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavigate(item.to)}
        className={classNames(
          'flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium transition',
          active
            ? 'bg-blue-100 text-blue-700 shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <div
        className={classNames(
          'fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:border-none md:shadow-none',
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="px-6 pb-6 pt-8">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">
                Sistema Comercial
              </p>
              <h1 className="text-xl font-semibold text-slate-900">Painel de Gestao</h1>
            </div>
            <div className="mt-6 rounded-2xl border border-blue-50 bg-blue-50/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-blue-500">{cargo}</p>
              <p className="text-sm font-semibold text-blue-700">
                {usuario?.nome || 'Usuario'}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-8">
            <div>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  classNames(
                    'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition',
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <FiHome className="h-4 w-4 shrink-0" />
                <span>Dashboard</span>
              </NavLink>
            </div>

            {navSections.map((section) => {
              const SectionIcon = section.icon;
              const expanded = Boolean(openSections[section.id]);

              return (
                <div key={section.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    aria-expanded={expanded}
                    aria-controls={`section-${section.id}`}
                  >
                    <span className="flex items-center gap-3">
                      {SectionIcon && <SectionIcon className="h-4 w-4 shrink-0 text-slate-500" />}
                      {section.title}
                    </span>
                    {expanded ? (
                      <FiChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <FiChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                    <div
                      id={`section-${section.id}`}
                      className={classNames(
                        'space-y-1 pl-3',
                        expanded ? 'max-h-screen opacity-100' : 'max-h-0 overflow-hidden opacity-0',
                      )}
                    >
                      {section.items.map((item) => renderNavButton(item))}
                    </div>
                </div>
              );
            })}
          </nav>

          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={handleLogout}
              className="btn-danger w-full justify-center"
            >
              <FiLogOut className="h-4 w-4" />
              Sair
            </button>
            <div className="mt-4 space-y-1 text-center text-[11px] text-slate-400">
              <NavLink to="/politica-privacidade" className="hover:text-blue-600">
                Politica de Privacidade
              </NavLink>
              <NavLink to="/lgpd/dpo" className="hover:text-blue-600">
                Canal LGPD (Titulares)
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden"
        />
      )}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="btn-ghost md:hidden"
              aria-label="Alternar menu"
            >
              {sidebarOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Voce esta em</p>
              <p className="text-sm font-semibold text-slate-800">
                {location.pathname.replace('/', '') || 'dashboard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 md:flex">
              <FiUser className="h-4 w-4 text-blue-500" />
              <span>{usuario?.nome || 'Usuario'}</span>
            </div>
            <button type="button" className="btn-ghost md:hidden" onClick={handleLogout}>
              <FiLogOut className="h-5 w-5 text-red-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
