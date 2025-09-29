import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";
import { FiDollarSign, FiSave, FiTrash2, FiX, FiSearch } from "react-icons/fi";

/* ========== Utils ========== */
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ========== Typeahead assíncrono (clientes/produtos/etc.) ========== */
function AsyncSearchBox({
  entity,
  placeholder,
  formatOption,
  onSelect,
  extraParams = {},
  minLen = 2,
  clearOnSelect = true,
  rightSlot = null,
  initialValue = "",
}) {
  const [term, setTerm] = useState(initialValue);
  const debounced = useDebouncedValue(term, 300);

  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef(null);
  const blurTimer = useRef(null);

  const fetchResults = useCallback(
    async (reset = false) => {
      const q = (debounced || "").trim();
      if (q.length < minLen) {
        setResults([]);
        setHasMore(false);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const params = {
          q,
          page: reset ? 1 : page,
          per_page: 10,
          ...extraParams,
        };
        const r = await api.get(`/${entity}`, { params });

        const items = Array.isArray(r.data) ? r.data : r.data?.items || [];
        const hdrTotal =
          Number(r?.headers?.["x-total-count"]) ||
          Number((r?.headers || {})["x-items-count"]) ||
          null;

        setResults((prev) => (reset ? items : [...prev, ...items]));

        const total = hdrTotal ?? (reset ? items.length : results.length + items.length);
        const fetched = reset ? items.length : results.length + items.length;
        setHasMore(total > fetched);

        setOpen(true);
      } catch {
        setResults([]);
        setHasMore(false);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounced, page, entity, extraParams]
  );

  useEffect(() => {
    setPage(1);
    setHighlight(0);
    fetchResults(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (page > 1) fetchResults(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const clearAll = () => {
    setTerm("");
    setResults([]);
    setOpen(false);
    setPage(1);
    setHighlight(0);
  };

  const handleSelect = (item) => {
    onSelect(item);
    if (clearOnSelect) clearAll();
    else setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" && results.length > 0) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      scrollIntoView(highlight + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      scrollIntoView(highlight - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[highlight];
      if (item) handleSelect(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const scrollIntoView = (idx) => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[idx];
    if (el) el.scrollIntoView({ block: "nearest" });
  };

  const onBlur = () => {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const onFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (results.length > 0) setOpen(true);
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full text-sm p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={placeholder}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onFocus={onFocus}
          />
          {term && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearAll}
              title="Limpar"
            >
              <FiX />
            </button>
          )}
        </div>
        {rightSlot}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow max-h-64 overflow-auto">
          <ul ref={listRef}>
            {results.length === 0 && !loading && (
              <li className="px-3 py-2 text-xs text-gray-500">Nenhum resultado</li>
            )}
            {results.map((it, idx) => (
              <li
                key={it.id}
                onMouseDown={() => handleSelect(it)}
                onMouseEnter={() => setHighlight(idx)}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  idx === highlight ? "bg-blue-50" : ""
                }`}
              >
                {formatOption(it)}
              </li>
            ))}
            {hasMore && (
              <li className="px-3 py-2 text-center">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs text-blue-600 hover:underline"
                  disabled={loading}
                >
                  {loading ? "Carregando..." : "Carregar mais"}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ========== Página: Preços de Produtos ========== */
export default function PrecosProdutos() {
  // seleção para cadastrar/alterar preço
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [preco, setPreco] = useState("");

  // listagem de preços (com busca + paginação)
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false); // <-- chave para habilitar "Próxima"

  // carregar lista com paginação e filtro
  const fetchPrecos = useCallback(async () => {
    setLoading(true);
    try {
      const skip = Math.max(0, (page - 1) * perPage);
      const params = { skip, limit: perPage }; // rota /precos usa skip/limit
      if (debouncedQ && debouncedQ.trim()) params.q = debouncedQ.trim();

      const resp = await api.get("/precos", { params });

      const items = Array.isArray(resp.data) ? resp.data : resp.data?.items || [];
      setLista(items);

      // headers padrão (se existirem)
      const hdrTotal =
        Number(resp?.headers?.["x-total-count"]) ||
        (() => {
          const cr = resp?.headers?.["content-range"];
          if (cr && typeof cr === "string" && cr.includes("/")) {
            const n = Number(cr.split("/").pop());
            return Number.isNaN(n) ? null : n;
          }
          return null;
        })();

      // se não houver cabeçalho, inferimos se há próxima página pelo tamanho do lote
      const next = items.length === perPage;
      setHasNext(next);

      if (typeof hdrTotal === "number") {
        setTotal(hdrTotal);
      } else {
        // estimativa: se tem próxima, adiciona +1 para não travar "Próxima"
        setTotal(skip + items.length + (next ? 1 : 0));
      }
    } catch (e) {
      setLista([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedQ]);

  useEffect(() => {
    fetchPrecos();
  }, [fetchPrecos]);

  // salvar novo preço (gera histórico no back)
  async function salvarPreco() {
    if (!produtoSelecionado?.id || !preco) return;
    try {
      await api.post("/precos", {
        produto_id: produtoSelecionado.id,
        preco: Number(preco),
      });
      setPreco("");
      setProdutoSelecionado(null);
      setPage(1);
      fetchPrecos();
    } catch (err) {
      console.error("Erro ao salvar preço", err);
    }
  }

  // excluir um registro de preço (caso sua regra permita)
  async function excluirPreco(id) {
    try {
      await api.delete(`/precos/${id}`);
      fetchPrecos();
    } catch (err) {
      console.error("Erro ao excluir preço", err);
    }
  }

  // helpers
  const fmtBRL = (v) =>
    typeof v === "number" && !Number.isNaN(v)
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "-";

  const renderSkip = Math.max(0, (page - 1) * perPage);
  const showingStart = lista.length === 0 ? 0 : renderSkip + 1;
  const showingEnd = renderSkip + lista.length;
  const displayTotal = total || (lista.length === 0 ? 0 : showingEnd);

  // habilita “Próxima” quando o lote veio cheio (ou quando headers trouxerem total maior)
  const canGoNext = hasNext || showingEnd < total;

  // UI
  return (
    <div className="max-w-6xl mx-auto bg-white shadow p-6 rounded-xl">
      <h1 className="text-xl font-bold mb-4 flex items-center">
        <FiDollarSign className="mr-2" /> Gerenciar Preços de Produtos
      </h1>

      {/* Barra ações: seleção de produto + preço */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Produto</label>
          {!produtoSelecionado ? (
            <AsyncSearchBox
              entity="produtos"
              placeholder="Digite 2+ letras, código ou escaneie o código de barras…"
              formatOption={(p) =>
                `${p.codigo_produto ? p.codigo_produto + " - " : ""}${p.nome} — ${fmtBRL(
                  Number(p.preco_venda ?? 0)
                )}`
              }
              onSelect={(p) => setProdutoSelecionado(p)}
              clearOnSelect={true}
            />
          ) : (
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <div className="text-sm text-gray-700">
                <span className="font-medium">
                  {produtoSelecionado.codigo_produto
                    ? `${produtoSelecionado.codigo_produto} - `
                    : ""}
                  {produtoSelecionado.nome}
                </span>
              </div>
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setProdutoSelecionado(null)}
              >
                Trocar
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <label className="block text-xs font-medium text-gray-700 mb-1">Novo preço</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 border p-2 rounded-lg"
              placeholder="0,00"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
            <button
              onClick={salvarPreco}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
              disabled={!produtoSelecionado || !preco}
              title={!produtoSelecionado ? "Selecione um produto" : "Salvar"}
            >
              <FiSave className="mr-1" /> Salvar
            </button>
          </div>
          <span className="text-[11px] text-gray-500 mt-1">
            Ao salvar, o back deve encerrar o preço ativo e criar um novo registro histórico.
          </span>
        </div>
      </div>

      {/* Filtros e paginação da LISTA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Buscar por produto, código, preço..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Por página:</span>
          <select
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
              setHasNext(false);
            }}
          >
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Produto</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Código</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Preço</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Ativo</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Início</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Fim</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>
                  Carregando...
                </td>
              </tr>
            ) : lista.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              lista.map((p) => {
                const prod =
                  p.produto ||
                  p.product ||
                  p.produto_obj ||
                  {};
                const nome = prod?.nome || p.produto_nome || "-";
                const cod = prod?.codigo_produto || p.codigo_produto || "-";
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2">{nome}</td>
                    <td className="px-4 py-2">{cod}</td>
                    <td className="px-4 py-2">
                      {fmtBRL(Number(p.preco))}
                    </td>
                    <td className="px-4 py-2">{p.ativo ? "Sim" : "Não"}</td>
                    <td className="px-4 py-2">
                      {p.data_inicio ? new Date(p.data_inicio).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {p.data_fim ? new Date(p.data_fim).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => excluirPreco(p.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Excluir registro"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="text-sm text-gray-600">
          Página <span className="font-medium">{page}</span> — mostrando{" "}
          <span className="font-medium">
            {lista.length === 0 ? 0 : `${showingStart}-${showingEnd}`}
          </span>{" "}
          de <span className="font-medium">{displayTotal}</span> registros
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <button
            className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
            disabled={!canGoNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
