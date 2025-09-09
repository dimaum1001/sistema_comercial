import { useNavigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import api from '../services/api'
import {
  FiDollarSign,
  FiBox,
  FiUsers,
  FiShoppingCart,
  FiPackage,
  FiTruck
} from 'react-icons/fi'

// Componentes carregados lazy para melhor performance
const StatsCard = lazy(() => import('../components/StatsCard'))
const FeatureCard = lazy(() => import('../components/FeatureCard'))

// Helpers de formatação
const fmtBRL = (n) =>
  Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))

const fmtInt = (n) => Intl.NumberFormat('pt-BR').format(Number(n || 0))

export default function Dashboard() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState({
    total_vendas: 0,
    total_produtos: 0,
    total_clientes: 0,
    txt_vendas: '',
    txt_produtos: '',
    txt_clientes: '',
    perc_vendas: 0,
    perc_produtos: 0,
    perc_clientes: 0
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    // garante Authorization nas próximas requisições
    api.defaults.headers.common.Authorization = `Bearer ${token}`

    const fetchUsuarioEResumo = async () => {
      try {
        const me = await api.get('/auth/me')
        setUsuario(me.data)

        const { data } = await api.get('/dashboard/resumo')
        setResumo((prev) => ({ ...prev, ...(data || {}) }))
      } catch (error) {
        console.error('Erro ao buscar usuário ou resumo:', error)
        localStorage.removeItem('token')
        navigate('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUsuarioEResumo()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-blue-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-blue-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Cabeçalho de boas-vindas */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">
          Bem-vindo, {usuario?.nome || 'Usuário'}
        </h2>
        <p className="text-gray-600">Aqui está o resumo do seu negócio</p>
      </div>

      {/* Stats Grid */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm h-32 animate-pulse" />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Total de Vendas"
            value={fmtBRL(resumo.total_vendas)}
            change={resumo.txt_vendas}
            percent={Number(resumo.perc_vendas) || 0}
            icon={<FiDollarSign size={24} className="text-green-500" />}
          />

          <StatsCard
            title="Produtos em Estoque"
            value={fmtInt(resumo.total_produtos)}
            change={resumo.txt_produtos}
            percent={Number(resumo.perc_produtos) || 0}
            icon={<FiBox size={24} className="text-blue-500" />}
          />

          <StatsCard
            title="Clientes Ativos"
            value={fmtInt(resumo.total_clientes)}
            change={resumo.txt_clientes}
            percent={Number(resumo.perc_clientes) || 0}
            icon={<FiUsers size={24} className="text-purple-500" />}
          />
        </div>
      </Suspense>

      {/* Features Grid */}
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
          <FeatureCard
            title="Produtos"
            description="Gerencie seu catálogo de produtos"
            icon={<FiPackage size={28} className="text-blue-500" />}
            onView={() => navigate('/produtos')}
          />

          <FeatureCard
            title="Clientes"
            description="Gerencie sua base de clientes"
            icon={<FiUsers size={28} className="text-purple-500" />}
            onView={() => navigate('/clientes')}
          />

          <FeatureCard
            title="Vendas"
            description="Registre e acompanhe suas vendas"
            icon={<FiShoppingCart size={28} className="text-green-500" />}
            onView={() => navigate('/vendas')}
          />

          <FeatureCard
            title="Movimentos"
            description="Registre entradas, saídas e ajustes de estoque"
            icon={<FiTruck size={28} className="text-orange-500" />}
            onView={() => navigate('/movimentos')}
          />

          <FeatureCard
            title="Fornecedores"
            description="Gerencie sua base de fornecedores"
            icon={<FiTruck size={28} className="text-indigo-500" />}
            onView={() => navigate('/fornecedores')}
          />
        </div>
      </Suspense>
    </div>
  )
}
