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
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [itens, setItens] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [vendas, setVendas] = useState([]);

  // % sobre subtotal
  const [descontoPerc, setDescontoPerc] = useState(0);
  const [acrescimoPerc, setAcrescimoPerc] = useState(0);

  // pagamentos (com parcelas)
  const [pagamentos, setPagamentos] = useState([
    { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: "" },
  ]);
  const userEditouPagamentos = useRef(false);

  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });

  useEffect(() => {
    carregarClientes();
    carregarProdutos();
    carregarVendas();
  }, []);

  async function carregarClientes() {
    try {
      const resp = await api.get("/clientes");
      setClientes(resp.data);
    } catch {
      setMensagem({ texto: "Erro ao carregar clientes", tipo: "erro" });
    }
  }

  async function carregarProdutos() {
    try {
      const resp = await api.get("/produtos");
      setProdutos(resp.data);
    } catch {
      setMensagem({ texto: "Erro ao carregar produtos", tipo: "erro" });
    }
  }

  async function carregarVendas() {
    try {
      const resp = await api.get("/vendas");
      setVendas(resp.data);
    } catch {
      setMensagem({ texto: "Erro ao carregar vendas", tipo: "erro" });
    }
  }

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
    setQuantidade(1);
  }

  function removerItem(index) {
    setItens(itens.filter((_, i) => i !== index));
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

  // Preenche 1º pagamento com total enquanto usuário não mexe
  useEffect(() => {
    if (!userEditouPagamentos.current) {
      setPagamentos((curr) => {
        if (curr.length === 0) {
          return [
            {
              forma_pagamento: "dinheiro",
              valor: totalFinal.toFixed(2),
              parcelas: 1,
              data_vencimento: "",
            },
          ];
        }
        const novo = [...curr];
        novo[0] = { ...novo[0], valor: totalFinal.toFixed(2) };
        return novo;
      });
    }
  }, [totalFinal]);

  // helpers de entrada monetária (sem limitar dígitos antes da vírgula)
  function formatarValorParaState(v) {
    // aceita 12345, 12345.6, 12345,67 etc
    const s = String(v).replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(s);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  }

  function atualizarPagamento(index, campo, valor) {
    userEditouPagamentos.current = true;
    const novos = [...pagamentos];
    if (campo === "valor") {
      novos[index][campo] = formatarValorParaState(valor);
    } else if (campo === "parcelas") {
      const n = Math.max(1, parseInt(valor || "1", 10));
      novos[index][campo] = n;
      // se parcelas > 1 e a forma não exige crédito, não forço nada
      // mas aviso na validação antes de salvar
    } else {
      novos[index][campo] = valor;
    }
    setPagamentos(novos);
  }

  function adicionarPagamento() {
    userEditouPagamentos.current = true;
    setPagamentos((prev) => [
      ...prev,
      { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: "" },
    ]);
  }

  function removerPagamento(index) {
    setPagamentos(pagamentos.filter((_, i) => i !== index));
  }

  // Gera as parcelas (quebra em N linhas para o payload) com vencimentos mensais
  function explodirPagamentosEmParcelas() {
    const parcelasGeradas = [];
    pagamentos.forEach((p) => {
      const qtd = Number(p.parcelas || 1);
      const valorNum = Number(p.valor || 0);
      if (qtd <= 1) {
        parcelasGeradas.push({
          forma_pagamento: p.forma_pagamento,
          valor: Number(valorNum.toFixed(2)),
          data_vencimento: p.data_vencimento || null,
        });
      } else {
        // precisa de data de vencimento base para parcelas
        // (validação acontece antes de salvar)
        const baseDate = p.data_vencimento ? new Date(p.data_vencimento) : null;

        const valorParcela = Number((valorNum / qtd).toFixed(2));
        // para somar exato, a última parcela ajusta centavos de diferença
        const somaAux = valorParcela * (qtd - 1);
        const ultimaParcela = Number((valorNum - somaAux).toFixed(2));

        for (let i = 0; i < qtd; i++) {
          let venc = null;
          if (baseDate) {
            const d = new Date(baseDate);
            d.setMonth(d.getMonth() + i);
            venc = d.toISOString().slice(0, 10); // yyyy-mm-dd
          }
          parcelasGeradas.push({
            forma_pagamento: p.forma_pagamento,
            valor: i === qtd - 1 ? ultimaParcela : valorParcela,
            data_vencimento: venc,
            parcela_numero: i + 1,
            parcela_total: qtd,
          });
        }
      }
    });
    return parcelasGeradas;
  }

  async function salvarVenda() {
    if (itens.length === 0) {
      setMensagem({ texto: "Adicione pelo menos um item", tipo: "erro" });
      return;
    }

    // validação de pagamentos
    if (totalPagamentos > totalFinal + 0.001) {
      setMensagem({ texto: "Pagamentos excedem o total da venda.", tipo: "erro" });
      return;
    }

    // se houver parcelas > 1, exigir data base
    for (const p of pagamentos) {
      if ((p.parcelas || 1) > 1 && !p.data_vencimento) {
        setMensagem({
          texto: "Informe uma data de vencimento para gerar as parcelas.",
          tipo: "erro",
        });
        return;
      }
    }

    const pagamentosExplodidos = explodirPagamentosEmParcelas();

    setLoading(true);
    try {
      await api.post("/vendas", {
        cliente_id: clienteId || null,
        desconto: Number(descontoValor.toFixed(2)),
        acrescimo: Number(acrescimoValor.toFixed(2)),
        observacao,
        itens: itens.map((item) => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unit: Number(item.preco_unit.toFixed(2)),
        })),
        pagamentos: pagamentosExplodidos.map((p) => ({
          forma_pagamento: p.forma_pagamento,
          valor: Number(p.valor),
          data_vencimento: p.data_vencimento || null,
          parcela_numero: p.parcela_numero || null,
          parcela_total: p.parcela_total || null,
        })),
      });

      setMensagem({ texto: "Venda registrada com sucesso!", tipo: "sucesso" });
      setClienteId("");
      setItens([]);
      setDescontoPerc(0);
      setAcrescimoPerc(0);
      setObservacao("");
      userEditouPagamentos.current = false;
      setPagamentos([
        { forma_pagamento: "dinheiro", valor: "0.00", parcelas: 1, data_vencimento: "" },
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center mb-6">
          <FiShoppingCart className="mr-2" /> Registro de Vendas
        </h1>

        {/* Mensagem */}
        {mensagem.texto && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              mensagem.tipo === "sucesso"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        {/* Nova Venda */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FiPlus className="mr-2" /> Nova Venda
          </h2>

          {/* Cliente */}
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <FiUser className="mr-1" /> Cliente
          </label>
          <select
            className="w-full p-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Venda sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          {/* Produto */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produto
          </label>
          <div className="flex gap-2 mb-6">
            <select
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={produtoSelecionado}
              onChange={(e) => setProdutoSelecionado(e.target.value)}
            >
              <option value="">Selecione um produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} - R$ {Number(p.preco_venda ?? 0).toFixed(2)}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="w-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={quantidade}
              min="1"
              onChange={(e) => setQuantidade(Number(e.target.value))}
            />
            <button
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              onClick={adicionarItem}
            >
              <FiPlus className="mr-1" /> Adicionar
            </button>
          </div>

          {/* Pagamentos */}
          <div className="grid grid-cols-1 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              Pagamentos (pode dividir em parcelas)
            </label>

            {pagamentos.map((p, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                <select
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="p-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500"
                  value={p.valor}
                  onChange={(e) => atualizarPagamento(idx, "valor", e.target.value)}
                  placeholder="0,00"
                />

                <input
                  type="number"
                  min="1"
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={p.parcelas}
                  onChange={(e) => atualizarPagamento(idx, "parcelas", e.target.value)}
                  title="Número de parcelas (1 = à vista)"
                />

                <input
                  type="date"
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={p.data_vencimento}
                  onChange={(e) =>
                    atualizarPagamento(idx, "data_vencimento", e.target.value)
                  }
                  title="Data base para vencimento (obrigatória se houver parcelas)"
                />

                {idx > 0 && (
                  <button
                    onClick={() => removerPagamento(idx)}
                    className="text-red-600 hover:text-red-800 p-2 justify-self-start md:justify-self-end"
                    title="Remover pagamento"
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={adicionarPagamento}
              className="text-blue-600 text-sm mt-1"
            >
              + Adicionar pagamento
            </button>

            <div className="mt-2 text-sm">
              <div>
                Total pago: <strong>R$ {totalPagamentos.toFixed(2)}</strong>
              </div>
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
          </div>

          {/* Desconto/Acréscimo */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desconto (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={descontoPerc}
                onChange={(e) => setDescontoPerc(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Acréscimo (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={acrescimoPerc}
                onChange={(e) => setAcrescimoPerc(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Observação */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação
            </label>
            <textarea
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Venda fiado, desconto especial..."
            />
          </div>

          {/* Itens */}
          {itens.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Itens</h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Produto
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Qtd
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Preço Unit.
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Subtotal
                      </th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {itens.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.nome}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {item.quantidade}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          R$ {item.preco_unit.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          R$ {(item.preco_unit * item.quantidade).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm">
                          <button
                            onClick={() => removerItem(index)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition"
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

              {/* Totais */}
              <div className="mt-4 text-right">
                <p className="text-sm text-gray-600">
                  Subtotal: R$ {subtotalItens.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                  Desconto ({Number(descontoPerc).toFixed(2)}%): - R$ {descontoValor.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                  Acréscimo ({Number(acrescimoPerc).toFixed(2)}%): + R$ {acrescimoValor.toFixed(2)}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  Total: R$ {totalFinal.toFixed(2)}
                </p>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={salvarVenda}
                  disabled={loading}
                  className={`flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FiSave className="mr-2" />
                      Finalizar Venda
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Histórico de vendas */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FiClock className="mr-2" />
            Histórico de Vendas
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vendas.map((v) => (
                  <tr key={v.id}>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(v.data_venda).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {v.cliente?.nome || "Sem cliente"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      R$ {Number(v.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {v.status}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {v.observacao || "-"}
                    </td>
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
