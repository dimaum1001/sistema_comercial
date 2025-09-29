import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";
import { FiBox, FiSave, FiList, FiX } from "react-icons/fi";

/* ---------------- utils ---------------- */
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------------- Typeahead genérico (clientes/produtos) ---------------- */
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
                  type="button"
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

/* ---------------- Página: Movimentos de Estoque ---------------- */
export default function MovimentosEstoque() {
  const [produto, setProduto] = useState(null);
  const [tipo, setTipo] = useState("entrada");
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");

  const [estoqueAtual, setEstoqueAtual] = useState(null);
  const [estoqueLoading, setEstoqueLoading] = useState(false);

  // histórico (lista)
  const [movimentos, setMovimentos] = useState([]);
  const [loading, setLoading] = useState(false);

  // busca e paginação — mesmo esquema da tela de preços
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });

  /* --------- carregar histórico com paginação --------- */
  const carregarMovimentos = useCallback(async () => {
    setLoading(true);
    try {
      // use skip/limit (ou page/per_page — ajuste se seu backend pedir)
      const skip = Math.max(0, (page - 1) * perPage);
      const params = { skip, limit: perPage };
      if (debouncedQ && debouncedQ.trim()) params.q = debouncedQ.trim();

      const r = await api.get("/estoque/movimentos", { params });
      const items = Array.isArray(r.data) ? r.data : r.data?.items || [];

      setMovimentos(items);

      const hdrTotal =
        Number(r?.headers?.["x-total-count"]) ||
        (() => {
          const cr = r?.headers?.["content-range"];
          if (cr && typeof cr === "string" && cr.includes("/")) {
            const n = Number(cr.split("/").pop());
            return Number.isNaN(n) ? null : n;
          }
          return null;
        })();

      // inferir próxima página quando não houver cabeçalho
      const next = items.length === perPage;
      setHasNext(next);

      if (typeof hdrTotal === "number") {
        setTotal(hdrTotal);
      } else {
        setTotal(skip + items.length + (next ? 1 : 0));
      }
    } catch {
      setMovimentos([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedQ]);

  useEffect(() => {
    carregarMovimentos();
  }, [carregarMovimentos]);

  /* --------- estoque do produto selecionado --------- */
  async function carregarEstoque(prodId) {
    if (!prodId) {
      setEstoqueAtual(null);
      return;
    }
    setEstoqueLoading(true);
    try {
      const r = await api.get(`/produtos/${prodId}`);
      const d = r?.data || {};
      const estRaw = d.estoque ?? d.saldo ?? d.quantidade_estoque ?? d.qtd_estoque ?? null;
      const est = Number(estRaw);
      setEstoqueAtual(Number.isFinite(est) ? est : null);
    } catch {
      setEstoqueAtual(null);
    } finally {
      setEstoqueLoading(false);
    }
  }

  /* --------- salvar movimento --------- */
  async function salvarMovimento(e) {
    e.preventDefault();

    if (!produto || quantidade <= 0) {
      setMensagem({ texto: "Selecione um produto e informe a quantidade", tipo: "erro" });
      return;
    }

    if (tipo === "saida" && typeof estoqueAtual === "number" && quantidade > estoqueAtual) {
      setMensagem({
        texto: `Saída maior que o saldo disponível (${estoqueAtual} un.).`,
        tipo: "erro",
      });
      return;
    }

    setMensagem({ texto: "", tipo: "" });
    setLoading(true);
    try {
      await api.post("/estoque/movimentar", {
        produto_id: produto.id,
        tipo,
        quantidade: Number(quantidade),
        observacao,
      });

      setMensagem({ texto: "Movimentação registrada com sucesso!", tipo: "sucesso" });
      setTipo("entrada");
      setQuantidade(1);
      setObservacao("");

      await carregarEstoque(produto.id);
      // volta para a página 1 para o usuário já ver a movimentação recente
      setPage(1);
      await carregarMovimentos();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || "Erro ao registrar movimentação";
      setMensagem({ texto: errorMsg, tipo: "erro" });
    } finally {
      setLoading(false);
    }
  }

  /* --------- helpers UI --------- */
  const estoqueBadgeClass = (n) => {
    if (n <= 0) return "bg-red-100 text-red-800";
    if (n < 10) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  const renderSkip = Math.max(0, (page - 1) * perPage);
  const showingStart = movimentos.length === 0 ? 0 : renderSkip + 1;
  const showingEnd = renderSkip + movimentos.length;
  const displayTotal = total || (movimentos.length === 0 ? 0 : showingEnd);
  const canGoNext = hasNext || showingEnd < total;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow p-5 md:p-6">
          {/* Cabeçalho */}
          <h1 className="text-xl font-bold text-gray-800 flex items-center mb-4">
            <FiBox className="mr-2" />
            Movimentações de Estoque
          </h1>

          {/* Mensagem */}
          {mensagem.texto && (
            <div
              className={`mb-4 p-3 rounded-md text-sm ${
                mensagem.tipo === "sucesso"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {mensagem.texto}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={salvarMovimento} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Produto (typeahead) */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Produto*</label>
              {!produto ? (
                <AsyncSearchBox
                  entity="produtos"
                  placeholder="Digite 2+ letras, código ou escaneie o código de barras…"
                  minLen={2}
                  formatOption={(p) =>
                    `${p.codigo_produto ? p.codigo_produto + " - " : ""}${p.nome}`
                  }
                  onSelect={async (p) => {
                    setProduto(p);
                    await carregarEstoque(p.id);
                  }}
                  clearOnSelect={true}
                />
              ) : (
                <div className="flex flex-col gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">
                        {produto.codigo_produto ? `${produto.codigo_produto} - ` : ""}
                        {produto.nome}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        setProduto(null);
                        setEstoqueAtual(null);
                      }}
                    >
                      Trocar
                    </button>
                  </div>
                  <div className="text-xs text-gray-700">
                    {estoqueLoading ? (
                      <span className="text-gray-500">Carregando estoque…</span>
                    ) : typeof estoqueAtual === "number" ? (
                      <span className={`px-2 py-0.5 rounded-full ${estoqueBadgeClass(estoqueAtual)}`}>
                        Saldo atual: {estoqueAtual} un.
                      </span>
                    ) : (
                      <span className="text-gray-500">Saldo não disponível</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimento*</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                required
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade*</label>
              <input
                type="number"
                min="1"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
                required
              />
              {tipo === "saida" && typeof estoqueAtual === "number" && (
                <p className="text-[11px] mt-1">
                  Disponível para saída:{" "}
                  <span className={`px-1 rounded ${estoqueBadgeClass(estoqueAtual)}`}>
                    {estoqueAtual} un.
                  </span>
                </p>
              )}
            </div>

            {/* Observação */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Compra fornecedor X / Perda / Ajuste inventário…"
              />
            </div>

            {/* Botão */}
            <div className="flex items-end justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-60"
              >
                {loading ? "Salvando..." : <> <FiSave className="mr-2" /> Registrar </>}
              </button>
            </div>
          </form>

          {/* Filtros e paginação da LISTA (igual à tela de preços) */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Buscar por produto, tipo, observação…"
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

          {/* Histórico */}
          <h2 className="text-md font-semibold mb-3 flex items-center">
            <FiList className="mr-2" />
            Histórico de Movimentações
          </h2>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Produto</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-right">Quantidade</th>
                  <th className="px-4 py-2 text-left">Observação</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : movimentos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                ) : (
                  movimentos.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-4 py-2 text-gray-600">
                        {m.data_movimento
                          ? new Date(m.data_movimento).toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2">{m.produto?.nome || "Produto removido"}</td>
                      <td className="px-4 py-2 capitalize">{m.tipo}</td>
                      <td className="px-4 py-2 text-right">{m.quantidade}</td>
                      <td className="px-4 py-2 text-gray-600">{m.observacao || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação (igual à tela de preços) */}
          <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm text-gray-600">
              Página <span className="font-medium">{page}</span> — mostrando{" "}
              <span className="font-medium">
                {movimentos.length === 0 ? 0 : `${showingStart}-${showingEnd}`}
              </span>{" "}
              de <span className="font-medium">{displayTotal}</span> registros
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
                disabled={!canGoNext || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
