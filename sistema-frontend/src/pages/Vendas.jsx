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

import { Page, Card } from "../components/ui";
import { classNames } from "../utils/classNames";

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

const FORMA_PAGAMENTO_OPCOES = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartao de Credito" },
  { value: "debito", label: "Cartao de Debito" },
  { value: "pix", label: "PIX" },
];

const toCents = (value) => Math.round(Number(value || 0) * 100);
const subtotalItemToCents = (item) => Math.round(item.preco_unit * item.quantidade * 100);
const fromCents = (cents) => cents / 100;
const formatCurrency = (cents) => fromCents(cents).toFixed(2);

function formatarDataLocal(valor) {
  if (!valor) return "--";

  const toDate = (raw) => {
    if (raw instanceof Date) return raw;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
      const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized);

      if (!hasOffset) {
        const match = normalized.match(
          /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
        );
        if (match) {
          const [, year, month, day, hour, minute, second = "0", fraction = "0"] = match;
          const localDate = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
            Number(String(fraction).padEnd(3, "0"))
          );
          if (!Number.isNaN(localDate.getTime())) return localDate;
        }

        const parsedLocal = new Date(normalized);
        if (!Number.isNaN(parsedLocal.getTime())) return parsedLocal;
      }

      const parsedIso = new Date(normalized);
      if (!Number.isNaN(parsedIso.getTime())) return parsedIso;

      if (!hasOffset) {
        const parsedUtc = new Date(`${normalized}Z`);
        if (!Number.isNaN(parsedUtc.getTime())) return parsedUtc;
      }
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const data = toDate(valor);
  if (!data) return String(valor);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

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
  const [precoProduto, setPrecoProduto] = useState(null);
  const [precoLoading, setPrecoLoading] = useState(false);

  const hoje = new Date().toISOString().slice(0, 10);
  const [pagamentos, setPagamentos] = useState([
    { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: hoje },
  ]);
  const userEditouPagamentos = useRef(false);

  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });

  const permiteDecimal = produto?.unidade_medida?.permite_decimal !== false;
  const unidadeSiglaAtual = produto?.unidade_medida?.sigla || "un.";

  const formatQuantidade = (valor, aceitaDecimal = true) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return "0";
    if (aceitaDecimal) {
      return (Math.round(numero * 1000) / 1000).toFixed(3).replace(/\.?0+$/, "");
    }
    return Math.round(numero).toString();
  };

  const handleQuantidadeChange = (valor) => {
    const normalizado = String(valor).replace(",", ".");
    let parsed = Number(normalizado);
    if (!Number.isFinite(parsed)) {
      parsed = 0;
    }
    if (parsed < 0) {
      parsed = 0;
    }
    if (permiteDecimal) {
      parsed = Math.round(parsed * 1000) / 1000;
    } else {
      if (parsed > 0 && parsed < 1) {
        parsed = 1;
      } else {
        parsed = Math.max(0, Math.floor(parsed));
      }
    }
    setQuantidade(parsed);
  };

  useEffect(() => {
    let ativo = true;

    if (!produto) {
      setPrecoProduto(null);
      setPrecoLoading(false);
      return () => {
        ativo = false;
      };
    }

    const precoLocal = extrairPrecoAtivoLocal(produto);
    if (Number.isFinite(precoLocal) && precoLocal > 0) {
      setPrecoProduto(precoLocal);
      setPrecoLoading(false);
      return () => {
        ativo = false;
      };
    }

    setPrecoProduto(null);
    setPrecoLoading(true);

    (async () => {
      try {
        const precoRemoto = await buscarPrecoAtivoRemoto(produto.id);
        if (ativo) {
          setPrecoProduto(
            Number.isFinite(precoRemoto) && precoRemoto > 0 ? precoRemoto : null
          );
        }
      } finally {
        if (ativo) {
          setPrecoLoading(false);
        }
      }
    })();

    return () => {
      ativo = false;
    };
  }, [produto]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- historico ----------
  const carregarVendas = useCallback(async (pageOverride = null) => {
    const pageToLoad = Math.max(pageOverride ?? historicoPage, 1);
    setHistoricoLoading(true);
    try {
      const skip = (pageToLoad - 1) * HISTORICO_PAGE_SIZE;
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

    const permiteDecimalProduto = p?.unidade_medida?.permite_decimal !== false;
    const unidadeSigla = p?.unidade_medida?.sigla || "un.";

    const precoSelecionado =
      produto &&
      produto.id === p.id &&
      Number.isFinite(precoProduto) &&
      precoProduto > 0
        ? precoProduto
        : null;

    let precoAtivo = precoSelecionado ?? extrairPrecoAtivoLocal(p);

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
      const tolerancia = permiteDecimalProduto ? 0.0005 : 0;
      if (quantidade - disponivel > tolerancia) {
        setMensagem({
          texto: `Quantidade indisponivel em estoque. Disponivel: ${formatQuantidade(
            Math.max(disponivel, 0),
            permiteDecimalProduto
          )} ${unidadeSigla}.`,
          tipo: "erro",
        });
        return;
      }
    }

    const quantidadeFinal = permiteDecimalProduto
      ? Math.round(Number(quantidade) * 1000) / 1000
      : Math.max(1, Math.floor(Number(quantidade)));

    if (quantidadeFinal <= 0) {
      setMensagem({ texto: "Quantidade invalida", tipo: "erro" });
      return;
    }

    setItens((prev) => [
      ...prev,
      {
        produto_id: p.id,
        quantidade: quantidadeFinal,
        preco_unit: Number(precoAtivo),
        nome: p.nome,
        unidade_sigla: unidadeSigla,
        permite_decimal: permiteDecimalProduto,
      },
    ]);

    setProduto(null);
    setEstoqueAtual(null);
    setPrecoProduto(null);
    setPrecoLoading(false);
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
  const subtotalCents = itens.reduce((sum, item) => sum + subtotalItemToCents(item), 0);
  const descontoCents = Math.round(subtotalCents * (Number(descontoPerc) / 100));
  const acrescimoCents = Math.round(subtotalCents * (Number(acrescimoPerc) / 100));
  const totalFinalCents = subtotalCents - descontoCents + acrescimoCents;


  // Preenche o 1o pagamento com o total (ou o restante)
  useEffect(() => {
    if (!userEditouPagamentos.current) {
      setPagamentos((curr) => {
        if (curr.length === 0) {
          return [{ forma_pagamento: "dinheiro", valor: formatCurrency(totalFinalCents), parcelas: 1, data_vencimento: hoje }];
        }
        const novo = [...curr];
        const outrosCents = novo.slice(1).reduce((s, p) => s + toCents(p.valor), 0);
        novo[0] = {
          ...novo[0],
          valor: formatCurrency(Math.max(totalFinalCents - outrosCents, 0)),
          data_vencimento: novo[0].data_vencimento || hoje,
        };
        return novo;
      });
    }
  }, [totalFinalCents]); // eslint-disable-line

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
      const pagoCents = prev.reduce((s, p) => s + toCents(p.valor), 0);
      const faltandoCents = Math.max(totalFinalCents - pagoCents, 0);
      return [
        ...prev,
        { forma_pagamento: "dinheiro", valor: formatCurrency(faltandoCents), parcelas: 1, data_vencimento: hoje },
      ];
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
  const disponivel =
    typeof estoqueAtual === "number"
      ? (() => {
          const calculado = estoqueAtual - reservadoAtual;
          if (permiteDecimal) {
            return Math.max(Math.round(calculado * 1000) / 1000, 0);
          }
          return Math.max(Math.floor(calculado), 0);
        })()
      : null;

  // ---------- UI ----------
  const messageTone =
    mensagem?.tipo === "sucesso"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : mensagem?.tipo === "erro"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <Page
      title="Registro de Vendas"
      subtitle="Monte pedidos, controle pagamentos e visualize o historico recente."
      icon={<FiShoppingCart className="h-5 w-5" />}
    >
      {mensagem.texto && (
        <Card className={classNames('text-sm', messageTone)}>
          {mensagem.texto}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card padding="p-4 md:p-5">
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
                  onSelect={(cli) => setCliente(cli)}
                  clearOnSelect={true}
                  rightSlot={null}
                />
              ) : (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
                  <span className="text-blue-700">
                    Cliente selecionado:{' '}
                    <strong>{cliente.nome}</strong>
                    {cliente.cpf_cnpj ? (
                      <span className="text-xs ml-2 text-blue-600">({cliente.cpf_cnpj})</span>
                    ) : null}
                  </span>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => setCliente(null)}>Trocar</button>
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
                placeholder="Digite 2+ letras do produto ou codigo..."
                minLen={2}
                extraParams={{ somente_ativos: true }}
                formatOption={(p) => `${p.codigo_produto ? p.codigo_produto + " - " : ''}${p.nome}`}
                onSelect={async (p) => {
                  const precoLocal = extrairPrecoAtivoLocal(p);
                  if (Number.isFinite(precoLocal) && precoLocal > 0) {
                    setPrecoProduto(precoLocal);
                    setPrecoLoading(false);
                  } else {
                    setPrecoProduto(null);
                    setPrecoLoading(true);
                  }
                  setProduto(p);
                  setQuantidade(1);
                  await carregarEstoque(p.id);
                }}
                clearOnSelect={true}
                rightSlot={
                  <div className="flex items-center gap-2">
                    <div className="min-w-[96px] text-right">
                      {precoLoading ? (
                        <span className="text-xs text-gray-500">Carregando...</span>
                      ) : Number.isFinite(precoProduto) ? (
                        <span className="text-sm font-semibold text-gray-700">
                          R$ {Number(precoProduto).toFixed(2)}
                        </span>
                      ) : produto ? (
                        <span className="text-xs text-red-500">Sem preco</span>
                      ) : (
                        <span className="text-xs text-gray-400">--</span>
                      )}
                    </div>
                    <input
                      type="number"
                      className="w-24 text-sm p-2 border border-gray-300 rounded-lg"
                      min={permiteDecimal ? "0.001" : "1"}
                      step={permiteDecimal ? "0.001" : "1"}
                      value={quantidade}
                      onChange={(e) => handleQuantidadeChange(e.target.value)}
                      title={permiteDecimal ? "Quantidade (aceita decimais)" : "Quantidade (somente inteiros)"}
                    />
                    <button
                      className="bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700"
                      onClick={async () => { await adicionarItemComProduto(produto); }}
                    >
                      Adicionar
                    </button>
                  </div>
                }
              />

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

              {produto && (
                <div className="mt-2 flex flex-col gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-700">
                      Selecionado:{' '}
                      <strong>
                        {produto.codigo_produto ? `${produto.codigo_produto} - ` : ''}
                        {produto.nome}
                      </strong>
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        setProduto(null);
                        setEstoqueAtual(null);
                        setPrecoProduto(null);
                        setPrecoLoading(false);
                      }}
                    >
                      Trocar
                    </button>
                  </div>

                  <div className="text-xs text-gray-700 flex items-center gap-3">
                    {estoqueLoading ? (
                      <span className="text-gray-500">Carregando estoque...</span>
                    ) : typeof estoqueAtual === "number" ? (
                      <>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${estoqueBadgeClass(estoqueAtual)}`}>
                          Saldo atual: {formatQuantidade(estoqueAtual, permiteDecimal)} {unidadeSiglaAtual}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${estoqueBadgeClass(disponivel ?? 0)}`}>
                          Disponivel (no carrinho): {formatQuantidade(disponivel ?? 0, permiteDecimal)} {unidadeSiglaAtual}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">Saldo nao disponivel</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-700">
                    {precoLoading ? (
                      <span className="text-gray-500">Consultando preco...</span>
                    ) : Number.isFinite(precoProduto) ? (
                      <span>
                        Preco unitario:{' '}
                        <strong>R$ {Number(precoProduto).toFixed(2)}</strong>
                      </span>
                    ) : (
                      <span className="text-gray-500">
                        Preco nao disponivel para este produto.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                        <tr key={`${item.produto_id}-${idx}`} className="border-t">
                          <td className="px-2 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{item.nome}</span>
                              <span className="text-[11px] text-gray-500">
                                {formatQuantidade(item.quantidade, item.permite_decimal)} {item.unidade_sigla}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">{formatQuantidade(item.quantidade, item.permite_decimal)}</td>
                          <td className="px-2 py-2 text-right">R$ {item.preco_unit.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right">R$ {(item.preco_unit * item.quantidade).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right">
                            <button
                              className="text-red-500 hover:text-red-700"
                              onClick={() =>
                                setItens((prev) => prev.filter((_, i) => i !== idx))
                              }
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

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
              <textarea
                className="w-full text-sm p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Anote detalhes relevantes para esta venda"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-4 md:flex-row md:items-center md:justify-between">
              <ResumoTotais
                itens={itens}
                descontoPerc={descontoPerc}
                acrescimoPerc={acrescimoPerc}
                pagamentos={pagamentos}
              />
              <button
                onClick={async () => {
                  if (itens.length === 0) {
                    setMensagem({ texto: 'Adicione ao menos um item', tipo: 'erro' });
                    return;
                  }

                  const subtotalCents = itens.reduce((sum, item) => sum + subtotalItemToCents(item), 0);
                  const descontoCents = Math.round(subtotalCents * (Number(descontoPerc) / 100));
                  const acrescimoCents = Math.round(subtotalCents * (Number(acrescimoPerc) / 100));
                  const totalFinalCents = subtotalCents - descontoCents + acrescimoCents;
                  const totalPagamentosCents = pagamentos.reduce((sum, p) => sum + toCents(p.valor), 0);

                  if (totalPagamentosCents > totalFinalCents) {
                    setMensagem({
                      texto: 'Pagamentos excedem o total da venda.',
                      tipo: 'erro',
                    });
                    return;
                  }

                  let status = 'pendente';
                  const restanteCents = totalFinalCents - totalPagamentosCents;
                  if (restanteCents <= 0) status = 'pago';
                  else if (totalPagamentosCents > 0 && restanteCents > 0) status = 'pago parcial';

                  setLoading(true);
                  try {
                    await api.post('/vendas', {
                      cliente_id: cliente?.id || null,
                      desconto: fromCents(descontoCents),
                      acrescimo: fromCents(acrescimoCents),
                      observacao,
                      status,
                      itens: itens.map((item) => ({
                        produto_id: item.produto_id,
                        quantidade: item.quantidade,
                        preco_unit: fromCents(toCents(item.preco_unit)),
                      })),
                      pagamentos: pagamentos.map((p) => ({
                        forma_pagamento: p.forma_pagamento,
                        valor: fromCents(toCents(p.valor)),
                        data_vencimento: p.data_vencimento || null,
                        parcela_numero: p.parcela_numero || null,
                        parcela_total: p.parcela_total || null,
                      })),
                    });

                    setMensagem({ texto: 'Venda registrada com sucesso!', tipo: 'sucesso' });
                    setCliente(null);
                    setProduto(null);
                    setEstoqueAtual(null);
                    setItens([]);
                    setDescontoPerc(0);
                    setAcrescimoPerc(0);
                    setObservacao('');
                    userEditouPagamentos.current = false;
                    setPagamentos([
                      { forma_pagamento: 'dinheiro', valor: '0.00', parcelas: 1, data_vencimento: hoje },
                    ]);
                    setHistoricoPage(1);
                    await carregarVendas(1);
                  } catch (err) {
                    setMensagem({
                      texto: err?.response?.data?.detail || 'Erro ao salvar venda',
                      tipo: 'erro',
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className={`flex items-center text-sm px-5 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Salvando...' : (<><FiSave className="mr-2" /> Finalizar Venda</>)}
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card padding="p-4 md:p-5" className="lg:sticky lg:top-4">
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
            </div>

            <hr className="my-3" />

            <ResumoTotais
              itens={itens}
              descontoPerc={descontoPerc}
              acrescimoPerc={acrescimoPerc}
              pagamentos={pagamentos}
            />

            <hr className="my-3" />

            <h3 className="text-sm font-semibold mb-2">Pagamentos</h3>

            <PagamentosEditor
              pagamentos={pagamentos}
              setPagamentos={setPagamentos}
              subtotalCents={itens.reduce((sum, item) => sum + subtotalItemToCents(item), 0)}
              descontoPerc={descontoPerc}
              acrescimoPerc={acrescimoPerc}
              userEditouPagamentos={userEditouPagamentos}
              hoje={hoje}
            />
          </Card>
        </div>
      </div>

      <Card padding="p-4 md:p-5">
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
                        {formatarDataLocal(v.data_venda)}
                      </td>
                      <td className="px-4 py-2">{v.cliente?.nome || 'Sem cliente'}</td>
                      <td className="px-4 py-2 text-right">R$ {formatCurrency(toCents(v.total))}</td>
                      <td className="px-4 py-2">{getStatus(v)}</td>
                      <td className="px-4 py-2">{v.observacao || '-'}</td>
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
      </Card>
    </Page>
  );

}

/** ----- componentes auxiliares (totais + pagamentos) ----- */

function ResumoTotais({ itens, descontoPerc, acrescimoPerc, pagamentos }) {
  const subtotalCents = itens.reduce((sum, item) => sum + subtotalItemToCents(item), 0);
  const descontoCents = Math.round(subtotalCents * (Number(descontoPerc) / 100));
  const acrescimoCents = Math.round(subtotalCents * (Number(acrescimoPerc) / 100));
  const totalFinalCents = subtotalCents - descontoCents + acrescimoCents;
  const totalPagamentosCents = pagamentos.reduce((sum, p) => sum + toCents(p.valor), 0);
  const restanteCents = totalFinalCents - totalPagamentosCents;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center justify-between">
        <span>Subtotal</span>
        <span>R$ {formatCurrency(subtotalCents)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Desconto</span>
        <span>- R$ {formatCurrency(descontoCents)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Acrescimo</span>
        <span>+ R$ {formatCurrency(acrescimoCents)}</span>
      </div>
      <div className="flex items-center justify-between font-semibold">
        <span>Total</span>
        <span>R$ {formatCurrency(totalFinalCents)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Pago</span>
        <span>R$ {formatCurrency(totalPagamentosCents)}</span>
      </div>
      <div
        className={`flex items-center justify-between ${
          restanteCents > 0 ? "text-amber-600" : restanteCents < 0 ? "text-red-600" : "text-green-700"
        }`}
      >
        <span>Restante</span>
        <span>R$ {formatCurrency(restanteCents)}</span>
      </div>
    </div>
  );
}

function PagamentosEditor({
  pagamentos,
  setPagamentos,
  subtotalCents,
  descontoPerc,
  acrescimoPerc,
  userEditouPagamentos,
  hoje,
}) {
  const descontoCents = Math.round(subtotalCents * (Number(descontoPerc) / 100));
  const acrescimoCents = Math.round(subtotalCents * (Number(acrescimoPerc) / 100));
  const totalFinalCents = subtotalCents - descontoCents + acrescimoCents;

  useEffect(() => {
    if (!userEditouPagamentos.current) {
      setPagamentos((curr) => {
        if (curr.length === 0) {
          return [{ forma_pagamento: "dinheiro", valor: formatCurrency(totalFinalCents), parcelas: 1, data_vencimento: hoje }];
        }
        const novo = [...curr];
        const outrosCents = novo.slice(1).reduce((s, p) => s + toCents(p.valor), 0);
        novo[0] = {
          ...novo[0],
          valor: formatCurrency(Math.max(totalFinalCents - outrosCents, 0)),
          data_vencimento: novo[0].data_vencimento || hoje,
        };
        return novo;
      });
    }
  }, [totalFinalCents]); // eslint-disable-line

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
      const pagoCents = prev.reduce((s, p) => s + toCents(p.valor), 0);
      const faltandoCents = Math.max(totalFinalCents - pagoCents, 0);
      return [
        ...prev,
        { forma_pagamento: "dinheiro", valor: formatCurrency(faltandoCents), parcelas: 1, data_vencimento: hoje },
      ];
    });
  }

  return (
    <div className="space-y-4">
      {pagamentos.map((p, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Pagamento {idx + 1}
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {idx === 0 ? "Principal" : "Complementar"}
              </p>
            </div>
            {idx > 0 ? (
              <button
                type="button"
                onClick={() => setPagamentos((prev) => prev.filter((_, i) => i !== idx))}
                className="btn-ghost h-9 rounded-full px-3 text-sm text-rose-600 hover:text-rose-700"
                title="Remover pagamento"
              >
                <FiTrash2 className="mr-1 h-4 w-4" />
                Remover
              </button>
            ) : (
              <span className="text-xs text-slate-400">Valor ajustado automaticamente</span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Forma
              </span>
              <select
                className="select h-11 w-full appearance-none pr-10 text-sm font-medium text-slate-700"
                value={p.forma_pagamento}
                onChange={(e) => atualizarPagamento(idx, "forma_pagamento", e.target.value)}
              >
                {FORMA_PAGAMENTO_OPCOES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Valor
              </span>
              <input
                type="text"
                className="input h-11 text-right"
                value={p.valor}
                onChange={(e) => atualizarPagamento(idx, "valor", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Parcelas
              </span>
              <input
                type="number"
                min="1"
                className="input h-11"
                value={p.parcelas}
                onChange={(e) => atualizarPagamento(idx, "parcelas", e.target.value)}
                title="Quantidade de parcelas (1 = a vista)"
              />
            </div>

            <div className="flex flex-col gap-1.5 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Vencimento
              </span>
              <input
                type="date"
                className="input h-11"
                value={p.data_vencimento}
                onChange={(e) => atualizarPagamento(idx, "data_vencimento", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={adicionarPagamento}
        className="btn-ghost h-11 w-full justify-center gap-2 rounded-full border border-dashed border-blue-300 text-sm font-semibold text-blue-600 hover:border-blue-400 hover:text-blue-700 sm:w-auto"
      >
        <FiPlus className="h-4 w-4" />
        Adicionar pagamento
      </button>
    </div>
  );
}






