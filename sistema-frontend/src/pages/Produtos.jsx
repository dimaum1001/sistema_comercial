import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiArrowLeft, FiBox } from "react-icons/fi";

export default function Produtos() {
  const navigate = useNavigate();

  // dados da tabela (somente da página atual)
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ texto: "", tipo: "" });

  // busca server-side
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // paginação server-side (máx 200)
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];
  const [pageSize, _setPageSize] = useState(25);
  const setPageSize = (n) => _setPageSize(Math.min(200, Math.max(10, Number(n) || 25)));
  const [page, setPage] = useState(1);

  // total de registros no banco (para a busca atual)
  const [total, setTotal] = useState(0);

  const fmtBRL = (v) =>
    typeof v === "number" && !Number.isNaN(v)
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "-";

  // --------- helpers ---------
  const parseTotalFromHeaders = (headers) => {
    if (!headers) return null;
    for (const k of ["x-total-count", "x-total", "x-count", "x-total-items", "x-items-count"]) {
      const v = headers[k];
      if (v != null && !Number.isNaN(Number(v))) return Number(v);
    }
    const cr = headers["content-range"]; // ex: items 1-200/2000
    if (cr && typeof cr === "string" && cr.includes("/")) {
      const n = Number(cr.split("/").pop().trim());
      if (!Number.isNaN(n)) return n;
    }
    return null;
  };

  const buildQuery = (pg, ps, term) => {
    const _ps = Math.min(200, Math.max(1, Number(ps) || 25));
    const offset = (pg - 1) * _ps;
    const q = term || "";
    return {
      // prioriza page/per_page (nosso backend já entende), mas envia outros formatos também
      page: pg,
      per_page: _ps,
      limit: _ps,
      offset,
      start: offset,
      size: _ps,
      // chaves de busca comuns
      q,
      search: q,
      term: q,
      nome: q,
    };
  };

  const fetchTotalFallback = async (term) => {
    const qs = { q: term, search: term, term, nome: term };
    try {
      const r = await api.get("/produtos/count", { params: qs });
      const d = r?.data;
      const n =
        typeof d === "number"
          ? d
          : typeof d?.total === "number"
          ? d.total
          : typeof d?.count === "number"
          ? d.count
          : null;
      if (n != null) return n;
    } catch (_) {}
    try {
      const r = await api.get("/produtos/total", { params: qs });
      const d = r?.data;
      const n =
        typeof d === "number"
          ? d
          : typeof d?.total === "number"
          ? d.total
          : typeof d?.count === "number"
          ? d.count
          : null;
      if (n != null) return n;
    } catch (_) {}
    return null;
  };

  const fetchPage = async (pg, ps, term) => {
    setLoading(true);
    try {
      const res = await api.get("/produtos", { params: buildQuery(pg, ps, term) });
      const data = res?.data ?? [];
      const list = Array.isArray(data) ? data : data.items ?? [];

      setItems(list);

      // resolve o total (headers > body > fallback)
      let t =
        parseTotalFromHeaders(res?.headers || {}) ??
        (typeof data.total === "number"
          ? data.total
          : typeof data.count === "number"
          ? data.count
          : null);

      if (t == null) t = await fetchTotalFallback(term);
      if (t == null) t = (pg - 1) * ps + list.length; // último recurso

      setTotal(t);
    } catch (e) {
      console.error(e);
      setMsg({ texto: "Erro ao carregar produtos", tipo: "erro" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  // ---------------------------

  // carregar sempre que mudar page/pageSize/busca
  useEffect(() => {
    fetchPage(page, pageSize, debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debounced]);

  // ao trocar busca ou pageSize, volta para a página 1
  useEffect(() => {
    setPage(1);
  }, [debounced, pageSize]);

  // paginação visual baseada no total do banco
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total || 0);

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      await api.delete(`/produtos/${id}`);
      setMsg({ texto: "Produto excluído com sucesso", tipo: "sucesso" });
      // recarrega a mesma página
      fetchPage(currentPage, pageSize, debounced);
    } catch (e) {
      console.error(e);
      setMsg({ texto: "Erro ao excluir produto", tipo: "erro" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-blue-200 rounded-full mb-4" />
          <div className="h-4 w-32 bg-blue-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FiBox /> Produtos Cadastrados
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Itens por página (máx 200):</span>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
          >
            <FiArrowLeft className="mr-2" />
            Voltar
          </button>
          <button
            onClick={() => navigate("/produtos/novo")}
            className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <FiPlus className="mr-2" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Mensagens */}
      {msg.texto ? (
        <div
          className={`mb-4 p-3 rounded border ${
            msg.tipo === "erro"
              ? "bg-red-100 border-red-300 text-red-700"
              : "bg-green-100 border-green-300 text-green-700"
          }`}
        >
          {msg.texto}
        </div>
      ) : null}

      {/* Busca */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Pesquisar por nome, categoria, fornecedor, marca, código..."
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      {items.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm text-center">
          <p className="text-gray-600 mb-4">
            {debounced ? "Nenhum produto encontrado para a pesquisa." : "Nenhum produto cadastrado ainda."}
          </p>
          <button
            onClick={() => navigate("/produtos/novo")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Cadastrar Primeiro Produto
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-[1200px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[130px]">Código Barras</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[240px]">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">Fornecedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[120px]">Custo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[120px]">Preço Venda</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[110px]">Estoque</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[100px]">Unidade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[160px]">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[140px]">Marca</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[160px]">Localização</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[130px]">Cadastrado em</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[130px]">Atualizado em</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-[90px]">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm text-gray-600 truncate" title={p.codigo_barras || "-"}>{p.codigo_barras || "-"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate" title={p.nome || "-"}>{p.nome || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate" title={p?.fornecedor?.nome || p?.fornecedor_obj?.nome || p?.fornecedor || "-"}>
                    {p?.fornecedor?.nome || p?.fornecedor_obj?.nome || p?.fornecedor || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtBRL(Number(p.custo))}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtBRL(Number(p.preco_venda))}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        (p.estoque ?? 0) <= 0
                          ? "bg-red-100 text-red-800"
                          : (p.estoque ?? 0) < 10
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {p.estoque ?? 0} un.
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate">{p.unidade || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate">{p?.categoria?.nome || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate">{p.marca || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate">{p.localizacao || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {p.criado_em ? new Date(p.criado_em).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {p.atualizado_em ? new Date(p.atualizado_em).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/produtos/editar/${p.id}`)}
                        className="text-blue-600 hover:text-blue-900 p-1.5 rounded-full hover:bg-blue-50 transition shrink-0"
                        title="Editar"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-600 hover:text-red-900 p-1.5 rounded-full hover:bg-red-50 transition shrink-0"
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
      )}

      {/* Paginação (sempre pelo total do banco) */}
      {total > 0 && (
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-between md:items-center bg-white px-6 py-3 rounded-b-xl shadow-sm">
          <div className="text-sm text-gray-500">
            Mostrando{" "}
            <span className="font-medium">
              {total === 0 ? 0 : `${start}–${end}`}
            </span>{" "}
            de <span className="font-medium">{total}</span> produtos
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página <span className="font-medium">{currentPage}</span> de{" "}
              <span className="font-medium">{totalPages}</span>
            </span>
            <select
              className="px-2 py-1 rounded-md border border-gray-300 text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              title="Itens por página (máx 200)"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
