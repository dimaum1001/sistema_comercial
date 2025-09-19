import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { FiUserPlus, FiArrowLeft, FiEdit, FiTrash2, FiSearch } from "react-icons/fi";

// debounce simples
function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// máscaras
function formatarCnpjCpf(valor) {
  if (!valor) return "Não informado";
  const n = String(valor).replace(/\D/g, "");
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return valor;
}
function formatarTelefone(valor) {
  if (!valor) return "Não informado";
  const n = String(valor).replace(/\D/g, "");
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  return valor;
}

export default function Fornecedores() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // busca
  const [searchTerm, setSearchTerm] = useState("");
  const debounced = useDebounced(searchTerm, 400);

  // paginação
  const [pageSize, setPageSize] = useState(25); // 10, 25, 50, 100
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(null);

  const navigate = useNavigate();

  const fetchFornecedores = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    try {
      const { data, headers } = await api.get("/fornecedores", {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, per_page: pageSize, q: debounced || undefined },
      });

      const items = Array.isArray(data) ? data : [];
      setRows(items);

      // total pelos headers
      let total = null;
      const xTotal = headers?.["x-total-count"];
      if (xTotal && !isNaN(parseInt(xTotal))) {
        total = parseInt(xTotal);
      } else if (headers?.["content-range"]) {
        const parts = String(headers["content-range"]).split("/");
        const n = parts?.[1] ? parseInt(parts[1]) : null;
        if (!isNaN(n)) total = n;
      }
      if (typeof total === "number") {
        setTotalCount(total);
        setHasMore(page * pageSize < total);
      } else {
        // fallback: se não houver header, estima com comprimento
        setTotalCount(items.length);
        setHasMore(items.length === pageSize);
      }
    } catch (err) {
      console.error("Erro ao buscar fornecedores:", err);
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [navigate, page, pageSize, debounced]);

  useEffect(() => {
    // sempre que mudar busca, volta para página 1
    setPage(1);
  }, [debounced]);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este fornecedor?")) {
      try {
        const token = localStorage.getItem("token");
        await api.delete(`/fornecedores/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchFornecedores();
      } catch (err) {
        console.error("Erro ao excluir fornecedor:", err);
      }
    }
  };

  const handlePrev = () => page > 1 && setPage((p) => p - 1);
  const handleNext = () => hasMore && setPage((p) => p + 1);
  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-green-200 rounded-full mb-4" />
          <div className="h-4 w-32 bg-green-200 rounded" />
        </div>
      </div>
    );
  }

  const paginaInfo = (
    <span className="text-sm text-gray-600">
      Página <span className="font-medium">{page}</span>
      {" — mostrando "}
      <span className="font-medium">{rows.length}</span>
      {typeof totalCount === "number" && (
        <> {" de "} <span className="font-medium">{totalCount}</span> registros</>
      )}
      {" ("}{pageSize} por página{")"}
    </span>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-2xl font-bold text-gray-800">Fornecedores Cadastrados</h2>

          {/* Controles de paginação (TOPO) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Mostrar</label>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">por página</span>
            </div>

            <div className="hidden md:inline-block h-5 w-px bg-gray-200" />

            {paginaInfo}

            <div className="hidden md:inline-block h-5 w-px bg-gray-200" />

            <div className="flex space-x-2">
              <button
                onClick={handlePrev}
                disabled={page === 1}
                className={`px-3 py-1 rounded-md ${
                  page === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                }`}
              >
                Anterior
              </button>
              <button
                onClick={handleNext}
                disabled={!hasMore}
                className={`px-3 py-1 rounded-md ${
                  !hasMore
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700 transition"
                }`}
              >
                Próxima
              </button>
            </div>

            <div className="hidden md:inline-block h-5 w-px bg-gray-200" />

            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              <FiArrowLeft className="mr-2" />
              Voltar
            </button>
            <button
              onClick={() => navigate("/fornecedores/cadastrar")}
              className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              <FiUserPlus className="mr-2" />
              Novo Fornecedor
            </button>
          </div>
        </div>

        {/* busca */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por nome/razão, código, CNPJ/CPF, e-mail ou telefone…"
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* tabela */}
      {rows.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm text-center mt-4">
          <p className="text-gray-600 mb-4">
            {debounced ? "Nenhum fornecedor encontrado para a pesquisa." : "Nenhum fornecedor nesta página."}
          </p>
          <button
            onClick={() => navigate("/fornecedores/cadastrar")}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Cadastrar Primeiro Fornecedor
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nome / Razão</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CNPJ/CPF</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Telefone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Data Cadastro</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((f) => {
                  const nomeOuRazao = f.nome || f.razao_social || "—";
                  return (
                    <tr key={f.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 font-medium">{(nomeOuRazao.charAt(0) || "?").toUpperCase()}</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{nomeOuRazao}</div>
                            <div className="text-sm text-gray-500">{f.email || "Sem e-mail"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatarCnpjCpf(f.cnpj_cpf)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatarTelefone(f.telefone)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {f.criado_em ? new Date(f.criado_em).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/fornecedores/editar/${f.id}`)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition"
                            title="Editar"
                          >
                            <FiEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(f.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition"
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
    </div>
  );
}
