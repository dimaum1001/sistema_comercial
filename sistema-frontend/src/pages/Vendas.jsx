import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import {
  FiShoppingCart,
  FiUser,
  FiPlus,
  FiTrash2,
  FiClock,
  FiSave,
} from "react-icons/fi";

export default function Vendas() {
  // ---------- Estado ----------
  const [clientes, setClientes] = useState([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");

  const [produtos, setProdutos] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);

  const [itens, setItens] = useState([]);
  const [vendas, setVendas] = useState([]);

  const [descontoPerc, setDescontoPerc] = useState(0);
  const [acrescimoPerc, setAcrescimoPerc] = useState(0);

  const hoje = new Date().toISOString().slice(0, 10);
  const [pagamentos, setPagamentos] = useState([
    { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: hoje },
  ]);
  const userEditouPagamentos = useRef(false);

  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });

  // ---------- Efeitos ----------
  useEffect(() => {
    carregarClientes();
    carregarProdutos();
    carregarVendas();
  }, []);

  async function carregarClientes() {
    try {
      const resp = await api.get("/clientes");
      setClientes(resp.data || []);
    } catch {
      setMensagem({ texto: "Erro ao carregar clientes", tipo: "erro" });
    }
  }

  async function carregarProdutos() {
    try {
      const resp = await api.get("/produtos");
      setProdutos(resp.data || []);
    } catch {
      setMensagem({ texto: "Erro ao carregar produtos", tipo: "erro" });
    }
  }

  async function carregarVendas() {
    try {
      const resp = await api.get("/vendas");
      setVendas(resp.data || []);
    } catch {
      setMensagem({ texto: "Erro ao carregar vendas", tipo: "erro" });
    }
  }

  // ---------- Helpers de normalização/busca ----------
  const normText = (s) =>
    (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const onlyDigits = (s) => (s || "").toString().replace(/\D/g, "");

  function findCliente(term) {
    const t = term.trim();
    if (!t) return null;

    const digits = onlyDigits(t);
    let m = null;

    if (digits) {
      m =
        clientes.find((c) => {
          const cd = onlyDigits(c?.codigo_cliente);
          if (!cd) return false;
          return parseInt(cd, 10) === parseInt(digits, 10);
        }) ||
        clientes.find((c) => onlyDigits(c?.codigo_cliente).startsWith(digits));
    }

    if (m) return m;

    const tn = normText(t);
    return (
      clientes.find((c) => normText(c?.nome).startsWith(tn)) ||
      clientes.find((c) => normText(c?.nome).includes(tn)) ||
      null
    );
  }

  function findProduto(term) {
    const t = term.trim();
    if (!t) return null;

    const digits = onlyDigits(t);
    let m = null;

    if (digits) {
      m =
        produtos.find((p) => {
          const cd = onlyDigits(p?.codigo_produto);
          if (!cd) return false;
          return parseInt(cd, 10) === parseInt(digits, 10);
        }) ||
        produtos.find((p) => onlyDigits(p?.codigo_produto).startsWith(digits));
    }

    if (m) return m;

    const tn = normText(t);
    return (
      produtos.find((p) => normText(p?.nome).startsWith(tn)) ||
      produtos.find((p) => normText(p?.nome).includes(tn)) ||
      null
    );
  }

  // ---------- Busca dinâmica (cliente/produto) ----------
  function handleBuscaClienteChange(val) {
    setBuscaCliente(val);
    const c = findCliente(val);
    setClienteId(c ? c.id : "");
  }

  function handleBuscaClienteBlur() {
    const c = findCliente(buscaCliente);
    if (c) {
      setClienteId(c.id);
      setBuscaCliente(
        `${c.codigo_cliente ? c.codigo_cliente + " - " : ""}${c.nome}`
      );
    }
  }

  function handleBuscaProdutoChange(val) {
    setBuscaProduto(val);
    const p = findProduto(val);
    setProdutoSelecionado(p ? p.id : "");
  }

  function handleBuscaProdutoBlur() {
    const p = findProduto(buscaProduto);
    if (p) {
      setProdutoSelecionado(p.id);
      setBuscaProduto(
        `${p.codigo_produto ? p.codigo_produto + " - " : ""}${p.nome} - R$ ${Number(
          p.preco_venda ?? 0
        ).toFixed(2)}`
      );
    }
  }

  // ---------- Itens ----------
  function adicionarItem() {
    if (!produtoSelecionado || quantidade <= 0) {
      setMensagem({
        texto: "Selecione um produto e informe a quantidade",
        tipo: "erro",
      });
      return;
    }
    const produto = produtos.find((p) => p.id === produtoSelecionado);
    if (!produto) return;

    setItens((prev) => [
      ...prev,
      {
        produto_id: produto.id,
        quantidade: Number(quantidade),
        preco_unit: Number(produto.preco_venda ?? 0),
        nome: produto.nome,
      },
    ]);

    setProdutoSelecionado("");
    setBuscaProduto("");
    setQuantidade(1);
  }

  function removerItem(index) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------- Totais ----------
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
  const restante = totalFinal - totalPagamentos;

  // Preenche o 1º pagamento com o total (ou com o restante, caso já existam outros)
  useEffect(() => {
    if (!userEditouPagamentos.current) {
      setPagamentos((curr) => {
        if (curr.length === 0) {
          return [
            {
              forma_pagamento: "dinheiro",
              valor: totalFinal.toFixed(2),
              parcelas: 1,
              data_vencimento: hoje,
            },
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

  // helpers monetários
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
        {
          forma_pagamento: "dinheiro",
          valor: faltando.toFixed(2),
          parcelas: 1,
          data_vencimento: hoje,
        },
      ];
    });
  }

  function removerPagamento(index) {
    setPagamentos((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------- Status fallback (para vendas antigas sem status) ----------
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

  // ---------- Salvar ----------
  async function salvarVenda() {
    if (itens.length === 0) {
      setMensagem({ texto: "Adicione pelo menos um item", tipo: "erro" });
      return;
    }

    if (totalPagamentos > totalFinal + 0.001) {
      setMensagem({
        texto: "Pagamentos excedem o total da venda.",
        tipo: "erro",
      });
      return;
    }

    let status = "pendente";
    if (restante <= 0) status = "pago";
    else if (totalPagamentos > 0 && restante > 0) status = "pago parcial";

    setLoading(true);
    try {
      await api.post("/vendas", {
        cliente_id: clienteId || null,
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
      setClienteId("");
      setBuscaCliente("");
      setItens([]);
      setDescontoPerc(0);
      setAcrescimoPerc(0);
      setObservacao("");
      userEditouPagamentos.current = false;
      setPagamentos([
        { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: hoje },
      ]);
      carregarVendas();
    } catch (err) {
      setMensagem({
        texto: err?.response?.data?.detail || "Erro ao salvar venda",
        tipo: "erro",
      });
    } finally {
      setLoading(false);
    }
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-5">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800 flex items-center mb-4">
          <FiShoppingCart className="mr-2" /> Registro de Vendas
        </h1>

        {mensagem.texto && (
          <div
            className={`mb-4 p-2 rounded text-sm ${
              mensagem.tipo === "sucesso"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        <div className="bg-white rounded shadow p-4 mb-6">
          <h2 className="text-md font-semibold mb-3 flex items-center">
            <FiPlus className="mr-1" /> Nova Venda
          </h2>

          {/* Cliente */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Código/Nome do cliente..."
              className="w-1/2 text-sm p-1.5 border border-gray-300 rounded"
              value={buscaCliente}
              onChange={(e) => handleBuscaClienteChange(e.target.value)}
              onBlur={handleBuscaClienteBlur}
            />
            <select
              className="flex-1 text-sm p-1.5 border border-gray-300 rounded"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Venda sem cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo_cliente ? `${c.codigo_cliente} - ` : ""}
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Produto */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Código/Nome do produto..."
              className="w-1/2 text-sm p-1.5 border border-gray-300 rounded"
              value={buscaProduto}
              onChange={(e) => handleBuscaProdutoChange(e.target.value)}
              onBlur={handleBuscaProdutoBlur}
            />
            <select
              className="flex-1 text-sm p-1.5 border border-gray-300 rounded"
              value={produtoSelecionado}
              onChange={(e) => setProdutoSelecionado(e.target.value)}
            >
              <option value="">Selecione um produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo_produto ? `${p.codigo_produto} - ` : ""}
                  {p.nome} - R$ {Number(p.preco_venda ?? 0).toFixed(2)}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="w-20 text-sm p-1.5 border border-gray-300 rounded"
              value={quantidade}
              min="1"
              onChange={(e) => setQuantidade(Number(e.target.value))}
            />
            <button
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700 flex items-center"
              onClick={adicionarItem}
            >
              <FiPlus className="mr-1" /> Adicionar
            </button>
          </div>

          {/* Pagamentos */}
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Pagamentos
          </label>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[11px] text-gray-500 mb-1">
            <div>Forma</div>
            <div>Valor</div>
            <div>Qtd. vezes</div>
            <div>Vencimento</div>
            <div></div>
          </div>

          {pagamentos.map((p, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
              <select
                className="text-sm p-1.5 border border-gray-300 rounded"
                value={p.forma_pagamento}
                onChange={(e) =>
                  atualizarPagamento(idx, "forma_pagamento", e.target.value)
                }
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Cartão de Crédito</option>
                <option value="debito">Cartão de Débito</option>
                <option value="pix">PIX</option>
              </select>

              <input
                type="text"
                className="text-sm p-1.5 border border-gray-300 rounded text-right"
                value={p.valor}
                onChange={(e) => atualizarPagamento(idx, "valor", e.target.value)}
              />

              <input
                type="number"
                min="1"
                placeholder="Qtd. vezes"
                className="text-sm p-1.5 border border-gray-300 rounded"
                value={p.parcelas}
                onChange={(e) => atualizarPagamento(idx, "parcelas", e.target.value)}
                title="Quantidade de parcelas (1 = à vista)"
              />

              <input
                type="date"
                className="text-sm p-1.5 border border-gray-300 rounded"
                value={p.data_vencimento}
                onChange={(e) =>
                  atualizarPagamento(idx, "data_vencimento", e.target.value)
                }
              />

              {idx > 0 && (
                <button
                  onClick={() => removerPagamento(idx)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={adicionarPagamento}
            className="text-blue-600 text-xs"
          >
            + Adicionar pagamento
          </button>

          <div className="mt-2 text-xs">
            <div>Total da venda: <strong>R$ {totalFinal.toFixed(2)}</strong></div>
            <div>Total pago: <strong>R$ {totalPagamentos.toFixed(2)}</strong></div>
            <div
              className={
                restante > 0.001
                  ? "text-amber-600"
                  : restante < -0.001
                  ? "text-red-600"
                  : "text-green-700"
              }
            >
              Restante: <strong>R$ {restante.toFixed(2)}</strong>
            </div>
          </div>

          {/* Observação */}
          <div className="mt-3">
            <label className="block text-xs mb-1">Observação</label>
            <textarea
              className="w-full text-sm p-1.5 border border-gray-300 rounded"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: venda fiado, desconto especial..."
            />
          </div>

          {/* Itens */}
          {itens.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Itens</h3>
              <table className="w-full text-xs border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Produto</th>
                    <th className="px-2 py-1">Qtd</th>
                    <th className="px-2 py-1 text-right">Unit</th>
                    <th className="px-2 py-1 text-right">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">{item.nome}</td>
                      <td className="px-2 py-1 text-center">{item.quantidade}</td>
                      <td className="px-2 py-1 text-right">
                        R$ {item.preco_unit.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        R$ {(item.preco_unit * item.quantidade).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => removerItem(idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end mt-3">
            <button
              onClick={salvarVenda}
              disabled={loading}
              className={`flex items-center text-sm px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Salvando..." : (<><FiSave className="mr-2" /> Finalizar Venda</>)}
            </button>
          </div>
        </div>

        {/* Histórico */}
        <div className="bg-white rounded shadow p-4">
          <h2 className="text-md font-semibold mb-3 flex items-center">
            <FiClock className="mr-2" /> Histórico de Vendas
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Observação</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2">
                      {new Date(v.data_venda).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>
                    <td className="px-4 py-2">{v.cliente?.nome || "Sem cliente"}</td>
                    <td className="px-4 py-2 text-right">
                      R$ {Number(v.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-2">{getStatus(v)}</td>
                    <td className="px-4 py-2">{v.observacao || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
