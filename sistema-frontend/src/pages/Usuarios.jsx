import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiUserPlus, FiArrowLeft, FiEdit, FiTrash2, FiSearch, FiUsers } from 'react-icons/fi';
import { PageHeader, EmptyState } from '../components/ui';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    const fetchUsuarios = async () => {
      try {
        const response = await api.get('/usuarios', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUsuarios(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Erro ao buscar usuarios:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, [navigate]);

  const filteredUsuarios = useMemo(() => {
    const termo = searchTerm.toLowerCase();
    return usuarios.filter((usuario) => {
      const nome = (usuario.nome || '').toLowerCase();
      const email = (usuario.email || '').toLowerCase();
      return nome.includes(termo) || email.includes(termo);
    });
  }, [usuarios, searchTerm]);

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuario?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await api.delete(`/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuarios((prev) => prev.filter((usuario) => usuario.id !== id));
    } catch (error) {
      console.error('Erro ao excluir usuario:', error);
    }
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
        <FiArrowLeft className="h-4 w-4" />
        Voltar
      </button>
      <button type="button" className="btn-primary" onClick={() => navigate('/usuarios/novo')}>
        <FiUserPlus className="h-4 w-4" />
        Novo usuario
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader
          title="Usuarios"
          subtitle="Controle de acesso e perfis do sistema."
          icon={<FiUsers className="h-5 w-5" />}
          actions={headerActions}
        />
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-blue-100 bg-white/80 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-blue-200" />
            <div className="h-4 w-32 animate-pulse rounded-full bg-blue-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Usuarios"
        subtitle="Controle de acesso e perfis do sistema."
        icon={<FiUsers className="h-5 w-5" />}
        actions={headerActions}
      />

      <div className="space-y-6">
        <div className="card p-4 sm:p-6">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquise por nome ou email"
              className="input pl-12"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {filteredUsuarios.length === 0 ? (
          <EmptyState
            title={searchTerm ? 'Nenhum usuario encontrado' : 'Nenhum usuario cadastrado'}
            description={
              searchTerm
                ? 'Ajuste os filtros ou verifique se o usuario esta ativo.'
                : 'Cadastre o primeiro usuario para liberar acessos.'
            }
            actions={
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate('/usuarios/novo')}
              >
                <FiUserPlus className="h-4 w-4" />
                Cadastrar usuario
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
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tipo
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
                  {filteredUsuarios.map((usuario) => (
                    <tr key={usuario.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-600">
                            {(usuario.nome || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{usuario.nome}</div>
                            <div className="text-sm text-slate-500">{usuario.email || 'Sem email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{usuario.email || 'Sem email'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {(usuario.tipo || 'desconhecido').toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {usuario.criado_em
                          ? new Date(usuario.criado_em).toLocaleDateString('pt-BR')
                          : '--'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/usuarios/editar/${usuario.id}`)}
                            className="btn-ghost h-9 w-9 rounded-full p-0 text-blue-600 hover:text-blue-700"
                            title="Editar"
                          >
                            <FiEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(usuario.id)}
                            className="btn-ghost h-9 w-9 rounded-full p-0 text-rose-600 hover:text-rose-700"
                            title="Excluir"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
