import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";
import {
  FiShoppingCart,
  FiPlus,
  FiTrash2,
  FiClock,
  FiSave,
  FiX,
  FiUser,
  FiBox,
} from "react-icons/fi";

/**
 * Hooks utilitarios
 */
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function onlyDigits(s) {
  return (s || "").toString().replace(/\D/g, "");
}

const HISTORICO_PAGE_SIZE = 10;

/**
 * Componente de busca assincrona (typeahead) para ENTIDADE (clientes/produtos)
 * Props principais:
 *  - entity: "clientes" | "produtos"
 *  - placeholder
 *  - formatOption(item): string
 *  - onSelect(item)
 *  - extraParams: params adicionais p/ API
 *  - clearOnSelect: limpa o input ao selecionar (default: true)
 */
function AsyncSearchBox({
  entity,
  placeholder,
  formatOption,
  onSelect,
  extraParams = {},
  minLen = 2,
  initialValue = "",
  rightSlot = null,
  clearOnSelect = true,
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
      const q = debounced.trim();
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

        const hdrTotal =
          Number(r?.headers?.["x-total-count"]) ||
          Number((r?.headers || {})["x-items-count"]) ||
          null;

        const items = Array.isArray(r.data) ? r.data : r.data?.items || [];
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
    if (clearOnSelect) {
      clearAll();
    } else {
      setOpen(false);
    }
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" && results.length > 0) {
        setOpen(true);
      }
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
    // da tempo de clicar no item da lista
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

export default function Vendas() {
  // ---------- estado principal ----------
  const [cliente, setCliente] = useState(null);
  const [produto, setProduto] = useState(null);
  const [quantidade, setQuantidade] = useState(1);

  const [itens, setItens] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [historicoPage, setHistoricoPage] = useState(1);
  const [historicoHasMore, setHistoricoHasMore] = useState(false);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  const [descontoPerc, setDescontoPerc] = useState(0);
  const [acrescimoPerc, setAcrescimoPerc] = useState(0);

  // estoque do produto selecionado
  const [estoqueAtual, setEstoqueAtual] = useState(null);
  const [estoqueLoading, setEstoqueLoading] = useState(false);

  const hoje = new Date().toISOString().slice(0, 10);
  const [pagamentos, setPagamentos] = useState([
    { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: hoje },
  ]);
  const userEditouPagamentos = useRef(false);

  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });

  // ---------- historico ----------
  const carregarVendas = useCallback(async () => {
    setHistoricoLoading(true);
    try {
      const skip = (historicoPage - 1) * HISTORICO_PAGE_SIZE;
      const limit = HISTORICO_PAGE_SIZE + 1;
      const resp = await api.get('/vendas', { params: { skip, limit } });
      const data = Array.isArray(resp.data) ? resp.data : resp.data?.items || [];
      if (data.length > HISTORICO_PAGE_SIZE) {
        setHistoricoHasMore(true);
        setVendas(data.slice(0, HISTORICO_PAGE_SIZE));
      } else {
        setHistoricoHasMore(false);
        setVendas(data);
      }
    } catch {
      setMensagem({ texto: 'Erro ao carregar vendas', tipo: 'erro' });
      setVendas([]);
      setHistoricoHasMore(false);
    } finally {
      setHistoricoLoading(false);
    }
  }, [historicoPage]);
  useEffect(() => {
    carregarVendas();
  }, [carregarVendas]);

  const handleHistoricoPrev = () => {
    if (historicoPage > 1) {
      setHistoricoPage((prev) => Math.max(1, prev - 1));
    }
  };

  const handleHistoricoNext = () => {
    if (historicoHasMore) {
      setHistoricoPage((prev) => prev + 1);
    }
  };

  // ---------- estoque do produto selecionado ----------
  async function carregarEstoque(prodId) {
    if (!prodId) {
      setEstoqueAtual(null);
      return;
    }
    setEstoqueLoading(true);
    try {
      const r = await api.get(`/produtos/${prodId}`);
      const d = r?.data || {};
      const estRaw =
        d.estoque ?? d.saldo ?? d.quantidade_estoque ?? d.qtd_estoque ?? null;
      const est = Number(estRaw);
      setEstoqueAtual(Number.isFinite(est) ? est : null);
    } catch {
      setEstoqueAtual(null);
    } finally {
      setEstoqueLoading(false);
    }
  }

  function extrairPrecoAtivoLocal(prod) {
    if (!prod) return null;
    const lista = Array.isArray(prod.precos) ? prod.precos : [];
    const ativo = lista.find((registro) => registro && registro.ativo);
    if (ativo) {
      const valor = Number(ativo.preco ?? ativo.valor ?? 0);
      if (Number.isFinite(valor) && valor > 0) {
        return valor;
      }
    }
    return null;
  }

  async function buscarPrecoAtivoRemoto(prodId) {
    if (!prodId) return null;
    try {
      const r = await api.get("/precos", { params: { produto_id: prodId, limit: 5 } });
      const lista = Array.isArray(r.data) ? r.data : r.data?.items || [];
      const ativo = lista.find((registro) => registro && registro.ativo);
      if (!ativo) return null;
      const valor = Number(ativo.preco ?? ativo.valor ?? 0);
      return Number.isFinite(valor) && valor > 0 ? valor : null;
    } catch {
      return null;
    }
  }

  // ---------- adicionar item ----------
  async function adicionarItemComProduto(p) {
    if (!p) {
      setMensagem({ texto: "Selecione um produto", tipo: "erro" });
      return;
    }
    if (quantidade <= 0) {
      setMensagem({ texto: "Quantidade invalida", tipo: "erro" });
      return;
    }

    let precoAtivo = extrairPrecoAtivoLocal(p);

    if (!Number.isFinite(precoAtivo) || precoAtivo <= 0) {
      const precoRemoto = await buscarPrecoAtivoRemoto(p.id);
      if (Number.isFinite(precoRemoto) && precoRemoto > 0) {
        precoAtivo = precoRemoto;
      }
    }

    if (!Number.isFinite(precoAtivo) || precoAtivo <= 0) {
      setMensagem({
        texto: "Produto sem preco ativo. Cadastre ou ative um preco antes de prosseguir.",
        tipo: "erro",
      });
      return;
    }

    const reservado = itens
      .filter((i) => i.produto_id === p.id)
      .reduce((s, i) => s + i.quantidade, 0);

    if (typeof estoqueAtual === "number") {
      const disponivel = estoqueAtual - reservado;
      if (quantidade > disponivel) {
        setMensagem({
          texto: `Quantidade indisponivel em estoque. Disponivel: ${Math.max(
            disponivel,
            0
          )} un.`,
          tipo: "erro",
        });
        return;
      }
    }

    setItens((prev) => [
      ...prev,
      {
        produto_id: p.id,
        quantidade: Number(quantidade),
        preco_unit: Number(precoAtivo),
        nome: p.nome,
      },
    ]);

    setProduto(null);
    setEstoqueAtual(null);
    setQuantidade(1);
  }

  // atalho: codigo/codigo de barras + Enter
  const onSubmitCodigoProduto = async (raw) => {
    const t = raw.trim();
    if (!t) return;
    try {
      const digits = onlyDigits(t);
      const params = { q: digits || t, page: 1, per_page: 1 };
      const r = await api.get("/produtos", { params });
      const list = Array.isArray(r.data) ? r.data : r.data?.items || [];
      if (list.length > 0) {
        // carrega estoque do produto e adiciona
        await carregarEstoque(list[0].id);
        await adicionarItemComProduto(list[0]);
      } else {
        setMensagem({ texto: "Produto nao encontrado", tipo: "erro" });
      }
    } catch {
      setMensagem({ texto: "Erro ao buscar produto", tipo: "erro" });
    }
  };

  // ---------- totais ----------
  const subtotalItens = itens.reduce((sum, i) => sum + i.preco_unit * i.quantidade, 0);
  const descontoValor = subtotalItens * (Number(descontoPerc) / 100);
  const acrescimoValor = subtotalItens * (Number(acrescimoPerc) / 100);
  const totalFinal = subtotalItens - descontoValor + acrescimoValor;

  const totalPagamentos = pagamentos.reduce((sum, p) => sum + Number(p.valor || 0), 0);
  const restante = totalFinal - totalPagamentos;

  // Preenche o 1o pagamento com o total (ou o restante)
  useEffect(() => {
    if (!userEditouPagamentos.current) {
      setPagamentos((curr) => {
        if (curr.length === 0) {
          return [
            { forma_pagamento: "dinheiro", valor: totalFinal.toFixed(2), parcelas: 1, data_vencimento: hoje },
          ];
        }
        const novo = [...curr];
        const outros = novo.slice(1).reduce((s, p) => s + Number(p.valor || 0), 0);
        novo[0] = {
          ...novo[0],
          valor: Math.max(totalFinal - outros, 0).toFixed(2),
          data_vencimento: novo[0].data_vencimento || hoje,
        };
        return novo;
      });
    }
  }, [totalFinal]); // eslint-disable-line

  function formatarValorParaState(v) {
    const s = String(v).replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(s);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  }

  function atualizarPagamento(index, campo, valor) {
    userEditouPagamentos.current = true;
    setPagamentos((prev) => {
      const novos = [...prev];
      if (campo === "valor") {
        novos[index][campo] = formatarValorParaState(valor);
      } else if (campo === "parcelas") {
        const n = Math.max(1, parseInt(valor || "1", 10));
        novos[index][campo] = n;
      } else {
        novos[index][campo] = valor;
      }
      return novos;
    });
  }

  function adicionarPagamento() {
    userEditouPagamentos.current = true;
    setPagamentos((prev) => {
      const pago = prev.reduce((s, p) => s + Number(p.valor || 0), 0);
      const faltando = Math.max(totalFinal - pago, 0);
      return [...prev, { forma_pagamento: "dinheiro", valor: faltando.toFixed(2), parcelas: 1, data_vencimento: hoje }];
    });
  }
  function removerPagamento(index) {
    setPagamentos((prev) => prev.filter((_, i) => i !== index));
  }
  function removerItem(index) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  function getStatus(v) {
    if (v?.status && String(v.status).trim()) return v.status;
    const somaPagos = Array.isArray(v?.pagamentos)
      ? v.pagamentos.reduce((s, p) => s + Number(p?.valor || 0), 0)
      : Number(v?.total_pago || 0) || 0;
    const total = Number(v?.total || 0);
    if (total > 0 && somaPagos >= total) return "pago";
    if (somaPagos > 0 && somaPagos < total) return "pago parcial";
    return "pendente";
  }

  // helpers para badge de estoque
  const estoqueBadgeClass = (n) => {
    if (n <= 0) return "bg-red-100 text-red-800";
    if (n < 10) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  // disponivel considerando itens ja no carrinho
  const reservadoAtual = produto
    ? itens.filter((i) => i.produto_id === produto.id).reduce((s, i) => s + i.quantidade, 0)
    : 0;
  const disponivel = typeof estoqueAtual === "number" ? Math.max(estoqueAtual - reservadoAtual, 0) : null;

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center">
            <FiShoppingCart className="mr-2" /> Registro de Vendas
          </h1>
        </div>

        {mensagem.texto && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              mensagem.tipo === "sucesso" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Coluna principal */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow p-4 md:p-5 mb-4">
              <h2 className="text-md font-semibold mb-4 flex items-center">
                <FiPlus className="mr-1" /> Nova Venda
              </h2>

              {/* Cliente */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiUser className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Cliente</span>
                </div>

                {!cliente ? (
                  <AsyncSearchBox
                    entity="clientes"
                    placeholder="Digite 2+ letras ou o codigo do cliente..."
                    minLen={2}
                    formatOption={(c) =>
                      `${c.codigo_cliente ? c.codigo_cliente + " - " : ""}${c.nome}${
                        c.cpf_cnpj ? " (" + c.cpf_cnpj + ")" : ""
                      }`
                    }
                    onSelect={(c) => setCliente(c)}
                    clearOnSelect={true}
                  />
                ) : (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">
                        {cliente.codigo_cliente ? `${cliente.codigo_cliente} - ` : ""}
                        {cliente.nome}
                      </span>
                      {cliente.cpf_cnpj ? <span className="text-gray-500">  {cliente.cpf_cnpj}</span> : null}
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setCliente(null)}
                    >
                      Trocar
                    </button>
                  </div>
                )}
              </div>

              {/* Produto */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiBox className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Produto</span>
                </div>

                <AsyncSearchBox
                  entity="produtos"
                  placeholder="Digite 2+ letras, codigo ou escaneie o codigo de barras..."
                  minLen={2}
                  formatOption={(p) =>
                    `${p.codigo_produto ? p.codigo_produto + " - " : ""}${p.nome}  R$ ${Number(
                      p.preco_venda ?? 0
                    ).toFixed(2)}`
                  }
                  onSelect={async (p) => {
                    setProduto(p);               // seleciona produto
                    setQuantidade(1);
                    await carregarEstoque(p.id); // carrega saldo atual
                  }}
                  clearOnSelect={true}
                  rightSlot={
                    <>
                      <input
                        type="number"
                        className="w-24 text-sm p-2 border border-gray-300 rounded-lg"
                        min="1"
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
                        title="Quantidade"
                      />
                      <button
                        className="bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700"
                        onClick={async () => { await adicionarItemComProduto(produto); }}
                      >
                        Adicionar
                      </button>
                    </>
                  }
                />

                {/* Campo rapido para codigo de barras / Enter */}
                <input
                  type="text"
                  className="mt-2 w-full text-sm p-2 border border-gray-200 rounded-lg"
                  placeholder="Ou digite/escaneie o CODIGO/CODIGO DE BARRAS e pressione Enter"
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      await onSubmitCodigoProduto(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />

                {/* Bloco de status do produto selecionado + estoque */}
                {produto && (
                  <div className="mt-2 flex flex-col gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-700">
                        Selecionado:{" "}
                        <strong>
                          {produto.codigo_produto ? `${produto.codigo_produto} - ` : ""}
                          {produto.nome}
                        </strong>
                      </div>
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => { setProduto(null); setEstoqueAtual(null); }}>
                        Trocar
                      </button>
                    </div>

                    <div className="text-xs text-gray-700 flex items-center gap-3">
                      {estoqueLoading ? (
                        <span className="text-gray-500">Carregando estoque...</span>
                      ) : typeof estoqueAtual === "number" ? (
                        <>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${estoqueBadgeClass(estoqueAtual)}`}>
                            Saldo atual: {estoqueAtual} un.
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${estoqueBadgeClass(disponivel ?? 0)}`}>
                            Disponivel ( no carrinho): {disponivel} un.
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-500">Saldo nao disponivel</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Itens */}
              {itens.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Itens</h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-2 text-left">Produto</th>
                          <th className="px-2 py-2 text-center">Qtd</th>
                          <th className="px-2 py-2 text-right">Unit</th>
                          <th className="px-2 py-2 text-right">Subtotal</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-2">{item.nome}</td>
                            <td className="px-2 py-2 text-center">{item.quantidade}</td>
                            <td className="px-2 py-2 text-right">R$ {item.preco_unit.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right">
                              R$ {(item.preco_unit * item.quantidade).toFixed(2)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                onClick={() => removerItem(idx)}
                                className="text-red-600 hover:text-red-800"
                                title="Remover"
                              >
                                <FiTrash2 />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Observacao */}
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">Observacao</label>
                <textarea
                  className="w-full text-sm p-2 border border-gray-300 rounded-lg"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: venda fiado, desconto especial..."
                />
              </div>

              {/* Acoes */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={async () => {
                    // salvar
                    if (itens.length === 0) {
                      setMensagem({ texto: "Adicione pelo menos um item", tipo: "erro" });
                      return;
                    }
                    const subtotalItens = itens.reduce(
                      (sum, i) => sum + i.preco_unit * i.quantidade,
                      0
                    );
                    const descontoValor = subtotalItens * (Number(descontoPerc) / 100);
                    const acrescimoValor = subtotalItens * (Number(acrescimoPerc) / 100);
                    const totalFinal = subtotalItens - descontoValor + acrescimoValor;

                    const totalPagamentos = pagamentos.reduce(
                      (sum, p) => sum + Number(p.valor || 0),
                      0
                    );
                    if (totalPagamentos > totalFinal + 0.001) {
                      setMensagem({
                        texto: "Pagamentos excedem o total da venda.",
                        tipo: "erro",
                      });
                      return;
                    }

                    let status = "pendente";
                    const restante = totalFinal - totalPagamentos;
                    if (restante <= 0) status = "pago";
                    else if (totalPagamentos > 0 && restante > 0) status = "pago parcial";

                    setLoading(true);
                    try {
                      await api.post("/vendas", {
                        cliente_id: cliente?.id || null,
                        desconto: Number(descontoValor.toFixed(2)),
                        acrescimo: Number(acrescimoValor.toFixed(2)),
                        observacao,
                        status,
                        itens: itens.map((item) => ({
                          produto_id: item.produto_id,
                          quantidade: item.quantidade,
                          preco_unit: Number(item.preco_unit.toFixed(2)),
                        })),
                        pagamentos: pagamentos.map((p) => ({
                          forma_pagamento: p.forma_pagamento,
                          valor: Number(p.valor),
                          data_vencimento: p.data_vencimento || null,
                          parcela_numero: p.parcela_numero || null,
                          parcela_total: p.parcela_total || null,
                        })),
                      });

                      setMensagem({ texto: "Venda registrada com sucesso!", tipo: "sucesso" });
                      // reset
                      setCliente(null);
                      setProduto(null);
                      setEstoqueAtual(null);
                      setItens([]);
                      setDescontoPerc(0);
                      setAcrescimoPerc(0);
                      setObservacao("");
                      userEditouPagamentos.current = false;
                      setPagamentos([
                        { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: hoje },
                      ]);
                      setHistoricoPage((prev) => (prev === 1 ? prev : 1));
                      if (historicoPage === 1) {
                        carregarVendas();
                      }
                    } catch (err) {
                      setMensagem({
                        texto: err?.response?.data?.detail || "Erro ao salvar venda",
                        tipo: "erro",
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className={`flex items-center text-sm px-5 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Salvando..." : (<><FiSave className="mr-2" /> Finalizar Venda</>)}
                </button>
              </div>
            </div>
          </div>

          {/* Coluna lateral: totais e pagamentos */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-4 md:p-5 sticky top-4">
              <h3 className="text-sm font-semibold mb-3">Totais</h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Desconto (%)</span>
                  <input
                    type="number"
                    className="w-24 text-sm p-2 border border-gray-300 rounded-lg text-right"
                    value={descontoPerc}
                    min="0"
                    onChange={(e) => setDescontoPerc(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Acrescimo (%)</span>
                  <input
                    type="number"
                    className="w-24 text-sm p-2 border border-gray-300 rounded-lg text-right"
                    value={acrescimoPerc}
                    min="0"
                    onChange={(e) => setAcrescimoPerc(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>

                <hr className="my-2" />

                {/* Calculo aqui tambem (reflete ao vivo) */}
                <ResumoTotais itens={itens} descontoPerc={descontoPerc} acrescimoPerc={acrescimoPerc} pagamentos={pagamentos} />
              </div>

              <hr className="my-3" />

              <h3 className="text-sm font-semibold mb-2">Pagamentos</h3>

              <PagamentosEditor
                pagamentos={pagamentos}
                setPagamentos={setPagamentos}
                totalBase={itens.reduce((sum, i) => sum + i.preco_unit * i.quantidade, 0)}
                descontoPerc={descontoPerc}
                acrescimoPerc={acrescimoPerc}
                userEditouPagamentos={userEditouPagamentos}
                hoje={hoje}
              />
            </div>
          </div>
        </div>

        {/* Historico */}
        <div className="bg-white rounded-xl shadow p-4 md:p-5 mt-4">
          <h2 className="text-md font-semibold mb-3 flex items-center">
            <FiClock className="mr-2" /> Historico de Vendas
          </h2>
          {historicoLoading ? (
            <div className="py-6 text-center text-sm text-gray-500">Carregando vendas...</div>
          ) : vendas.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">Nenhuma venda encontrada.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Observacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((v) => (
                      <tr key={v.id} className="border-t">
                        <td className="px-4 py-2">
                          {new Date(v.data_venda).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </td>
                        <td className="px-4 py-2">{v.cliente?.nome || "Sem cliente"}</td>
                        <td className="px-4 py-2 text-right">R$ {Number(v.total).toFixed(2)}</td>
                        <td className="px-4 py-2">{getStatus(v)}</td>
                        <td className="px-4 py-2">{v.observacao || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-gray-500">
                <div>
                  Pagina <span className="font-semibold">{historicoPage}</span> mostrando <span className="font-semibold">{vendas.length}</span> vendas ({HISTORICO_PAGE_SIZE} por pagina)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleHistoricoPrev}
                    disabled={historicoPage === 1}
                    className={`px-3 py-1 rounded-md ${historicoPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 transition'}`}
                  >
                    Anterior
                  </button>
                  <button
                    onClick={handleHistoricoNext}
                    disabled={!historicoHasMore}
                    className={`px-3 py-1 rounded-md ${!historicoHasMore ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 transition'}`}
                  >
                    Proxima
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

/** ----- componentes auxiliares (totais + pagamentos) ----- */

function ResumoTotais({ itens, descontoPerc, acrescimoPerc, pagamentos }) {
  const subtotalItens = itens.reduce((sum, i) => sum + i.preco_unit * i.quantidade, 0);
  const descontoValor = subtotalItens * (Number(descontoPerc) / 100);
  const acrescimoValor = subtotalItens * (Number(acrescimoPerc) / 100);
  const totalFinal = subtotalItens - descontoValor + acrescimoValor;
  const totalPagamentos = pagamentos.reduce((sum, p) => sum + Number(p.valor || 0), 0);
  const restante = totalFinal - totalPagamentos;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center justify-between">
        <span>Subtotal</span>
        <span>R$ {subtotalItens.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Desconto</span>
        <span>- R$ {descontoValor.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Acrescimo</span>
        <span>+ R$ {acrescimoValor.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between font-semibold">
        <span>Total</span>
        <span>R$ {totalFinal.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Pago</span>
        <span>R$ {totalPagamentos.toFixed(2)}</span>
      </div>
      <div
        className={`flex items-center justify-between ${
          restante > 0.001 ? "text-amber-600" : restante < -0.001 ? "text-red-600" : "text-green-700"
        }`}
      >
        <span>Restante</span>
        <span>R$ {restante.toFixed(2)}</span>
      </div>
    </div>
  );
}

function PagamentosEditor({
  pagamentos,
  setPagamentos,
  totalBase,
  descontoPerc,
  acrescimoPerc,
  userEditouPagamentos,
  hoje,
}) {
  const subtotalItens = totalBase;
  const descontoValor = subtotalItens * (Number(descontoPerc) / 100);
  const acrescimoValor = subtotalItens * (Number(acrescimoPerc) / 100);
  const totalFinal = subtotalItens - descontoValor + acrescimoValor;

  useEffect(() => {
    if (!userEditouPagamentos.current) {
      setPagamentos((curr) => {
        if (curr.length === 0) {
          return [{ forma_pagamento: "dinheiro", valor: totalFinal.toFixed(2), parcelas: 1, data_vencimento: hoje }];
        }
        const novo = [...curr];
        const outros = novo.slice(1).reduce((s, p) => s + Number(p.valor || 0), 0);
        novo[0] = {
          ...novo[0],
          valor: Math.max(totalFinal - outros, 0).toFixed(2),
          data_vencimento: novo[0].data_vencimento || hoje,
        };
        return novo;
      });
    }
  }, [totalFinal]); // eslint-disable-line

  function formatarValorParaState(v) {
    const s = String(v).replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(s);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  }

  function atualizarPagamento(index, campo, valor) {
    userEditouPagamentos.current = true;
    setPagamentos((prev) => {
      const novos = [...prev];
      if (campo === "valor") {
        novos[index][campo] = formatarValorParaState(valor);
      } else if (campo === "parcelas") {
        const n = Math.max(1, parseInt(valor || "1", 10));
        novos[index][campo] = n;
      } else {
        novos[index][campo] = valor;
      }
      return novos;
    });
  }

  function adicionarPagamento() {
    userEditouPagamentos.current = true;
    setPagamentos((prev) => {
      const pago = prev.reduce((s, p) => s + Number(p.valor || 0), 0);
      const faltando = Math.max(totalFinal - pago, 0);
      return [
        ...prev,
        { forma_pagamento: "dinheiro", valor: faltando.toFixed(2), parcelas: 1, data_vencimento: hoje },
      ];
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[11px] text-gray-500 mb-1">
        <div>Forma</div>
        <div>Valor</div>
        <div>Qtd. vezes</div>
        <div>Vencimento</div>
        <div></div>
      </div>

      {pagamentos.map((p, idx) => (
        <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2 items-center">
          <select
            className="text-sm p-2 border border-gray-300 rounded-lg"
            value={p.forma_pagamento}
            onChange={(e) => atualizarPagamento(idx, "forma_pagamento", e.target.value)}
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="credito">Cartao de Credito</option>
            <option value="debito">Cartao de Debito</option>
            <option value="pix">PIX</option>
          </select>

          <input
            type="text"
            className="text-sm p-2 border border-gray-300 rounded-lg text-right"
            value={p.valor}
            onChange={(e) => atualizarPagamento(idx, "valor", e.target.value)}
          />

          <input
            type="number"
            min="1"
            className="text-sm p-2 border border-gray-300 rounded-lg"
            value={p.parcelas}
            onChange={(e) => atualizarPagamento(idx, "parcelas", e.target.value)}
            title="Quantidade de parcelas (1 = a vista)"
          />

          <input
            type="date"
            className="text-sm p-2 border border-gray-300 rounded-lg"
            value={p.data_vencimento}
            onChange={(e) => atualizarPagamento(idx, "data_vencimento", e.target.value)}
          />

          {idx > 0 ? (
            <button
              onClick={() => setPagamentos((prev) => prev.filter((_, i) => i !== idx))}
              className="text-red-600 hover:text-red-800 justify-self-start"
              title="Remover"
            >
              <FiTrash2 />
            </button>
          ) : (
            <div />
          )}
        </div>
      ))}

      <button type="button" onClick={adicionarPagamento} className="text-blue-600 text-xs">
        + Adicionar pagamento
      </button>
    </div>
  );
}






