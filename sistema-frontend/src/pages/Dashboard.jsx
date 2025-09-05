import { useNavigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import api from '../services/api'

// Componentes carregados lazy para melhor performance
const StatsCard = lazy(() => import('../components/StatsCard'))
const FeatureCard = lazy(() => import('../components/FeatureCard'))

export default function Dashboard() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState({ total_vendas: 0, total_produtos: 0, total_clientes: 0 })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchUsuario = async () => {
      try {
        const response = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setUsuario(response.data)

        // busca os dados reais do dashboard
        const resumoResponse = await api.get('/dashboard/resumo', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setResumo(resumoResponse.data)

      } catch (error) {
        console.error('Erro ao buscar usuário ou resumo:', error)
        localStorage.removeItem('token')
        navigate('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUsuario()
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
              <div
                key={i}
                className="bg-white p-6 rounded-xl shadow-sm h-32 animate-pulse"
              ></div>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Total de Vendas"
            value={`R$ ${resumo.total_vendas.toLocaleString('pt-BR')},00`}
            change={resumo.txt_vendas}
            percent={resumo.perc_vendas}
            icon={
              <svg
                className="w-6 h-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 11V7a4 4 0 118 0v4m-2 4h-2m2 0a2 2 0 11-4 0m4 0v1a2 2 0 002 2h-2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2H9a2 2 0 002-2v-1m0 0H7a2 2 0 01-2-2V7a2 2 0 012-2h3"
                />
              </svg>
            }
          />
          <StatsCard
            title="Produtos em Estoque"
            value={resumo.total_produtos}
            change={resumo.txt_produtos}
            percent={resumo.perc_produtos}
            icon={
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20 13V7a2 2 0 00-2-2h-4V3a1 1 0 00-2 0v2H8a2 2 0 00-2 2v6m12 0a2 2 0 002 2h-2v4H6v-4H4a2 2 0 002-2m12 0H6"
                />
              </svg>
            }
          />
          <StatsCard
            title="Clientes Ativos"
            value={resumo.total_clientes}
            change={resumo.txt_clientes}
            percent={resumo.perc_clientes}
            icon={
              <svg
                className="w-6 h-6 text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7M17 20v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2a3 3 0 015.356-1.857M15 7a2 2 0 11-4 0 2 2 0 014 0zm-6 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
          />
        </div>
      </Suspense>

      {/* Features Grid */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-xl shadow-sm h-32 animate-pulse"
              ></div>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            title="Produtos"
            description="Gerencie seu catálogo de produtos"
            icon={
              <svg
                className="w-8 h-8 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
            onView={() => navigate('/produtos')}
          />
          <FeatureCard
            title="Clientes"
            description="Gerencie sua base de clientes"
            icon={
              <svg
                className="w-8 h-8 text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 0 018 0z"
                />
              </svg>
            }
            onView={() => navigate('/clientes')}
          />
          <FeatureCard
            title="Vendas"
            description="Registre e acompanhe suas vendas"
            icon={
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            onView={() => navigate('/vendas')}
          />
          <FeatureCard
            title="Movimentos"
            description="Registre entradas, saídas e ajustes de estoque"
            icon={
              <svg
                className="w-8 h-8 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20 13V7a2 2 0 00-2-2h-4V3a1 1 0 00-2 0v2H8a2 2 0 00-2 2v6m12 0a2 2 0 002 2h-2v4H6v-4H4a2 2 0 002-2m12 0H6"
                />
              </svg>
            }
            onView={() => navigate('/movimentos')}
          />
          <FeatureCard
            title="Fornecedores"
            description="Gerencie sua base de fornecedores"
            icon={
              <svg
                className="w-8 h-8 text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 7a2 2 0 11-4 0 2 2 0 014 0zm-6 2a2 2 0 11-4 0 2 2 0 014 0zM17 20H7m10 0v-2a3 3 0 00-5.356-1.857M7 20v-2a3 3 0 015.356-1.857"
                />
              </svg>
            }
            onView={() => navigate('/fornecedores')}
          />
        </div>
      </Suspense>
    </div>
  )
}
