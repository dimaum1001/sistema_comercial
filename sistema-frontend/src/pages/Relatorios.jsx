// Página de Relatórios
//
// Esta página coleta dados agregados da API (relatórios de vendas,
// produtos mais vendidos, estoque atual e ranking de clientes) e
// apresenta ao usuário de forma tabular. Ela usa parâmetros de
// data para filtrar vendas em um intervalo específico.

import React, { useEffect, useState } from 'react';
import api from '../services/api';

const Relatorios = () => {
  // Relatório de vendas por período
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });
  const [vendas, setVendas] = useState([]);
  // Outros relatórios
  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState([]);
  const [estoqueAtual, setEstoqueAtual] = useState([]);
  const [rankingClientes, setRankingClientes] = useState([]);

  useEffect(() => {
    // Carrega relatórios fixos quando a página monta
    carregarOutrosRelatorios();
  }, []);

  const carregarOutrosRelatorios = async () => {
    try {
      const [produtosResp, estoqueResp, rankingResp] = await Promise.all([
        api.get('/relatorios/produtos-mais-vendidos'),
        api.get('/relatorios/estoque-atual'),
        api.get('/relatorios/ranking-clientes')
      ]);
      setProdutosMaisVendidos(produtosResp.data);
      setEstoqueAtual(estoqueResp.data);
      setRankingClientes(rankingResp.data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    }
  };

  const handlePeriodoChange = (e) => {
    setPeriodo({ ...periodo, [e.target.name]: e.target.value });
  };

  const gerarRelatorioVendas = async () => {
    if (!periodo.inicio || !periodo.fim) {
      alert('Por favor, selecione datas de início e fim.');
      return;
    }
    try {
      const { data } = await api.get('/relatorios/vendas', {
        params: { start_date: periodo.inicio, end_date: periodo.fim }
      });
      setVendas(data);
    } catch (error) {
      console.error('Erro ao gerar relatório de vendas:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Relatórios</h2>
      {/* Relatório de vendas por período */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <h3 className="text-xl font-semibold mb-4">Vendas por Período</h3>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-gray-700 text-sm mb-1">Data início</label>
            <input
              type="date"
              name="inicio"
              value={periodo.inicio}
              onChange={handlePeriodoChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm mb-1">Data fim</label>
            <input
              type="date"
              name="fim"
              value={periodo.fim}
              onChange={handlePeriodoChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <button
            onClick={gerarRelatorioVendas}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Gerar
          </button>
        </div>
        {/* Tabela de vendas */}
        {vendas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">ID</th>
                  <th className="py-2 px-4 border-b">Cliente</th>
                  <th className="py-2 px-4 border-b">Usuário</th>
                  <th className="py-2 px-4 border-b">Data</th>
                  <th className="py-2 px-4 border-b">Total (R$)</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <tr key={venda.id} className="text-center">
                    <td className="py-2 px-4 border-b">
                      {venda.id.substring(0, 8)}...
                    </td>
                    <td className="py-2 px-4 border-b">
                      {venda.cliente?.nome || venda.cliente_id}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {venda.usuario?.nome || venda.usuario_id}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {parseFloat(venda.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Produtos mais vendidos */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <h3 className="text-xl font-semibold mb-4">Produtos Mais Vendidos</h3>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Produto</th>
              <th className="py-2 px-4 border-b">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {produtosMaisVendidos.map((item, idx) => (
              <tr key={idx} className="text-center">
                <td className="py-2 px-4 border-b">{item.produto}</td>
                <td className="py-2 px-4 border-b">{item.total_vendido}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Estoque atual */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <h3 className="text-xl font-semibold mb-4">Estoque Atual</h3>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Produto</th>
              <th className="py-2 px-4 border-b">Código</th>
              <th className="py-2 px-4 border-b">Estoque</th>
              <th className="py-2 px-4 border-b">Estoque Mínimo</th>
              <th className="py-2 px-4 border-b">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {estoqueAtual.map((p, idx) => (
              <tr key={idx} className="text-center">
                <td className="py-2 px-4 border-b">{p.produto}</td>
                <td className="py-2 px-4 border-b">{p.codigo}</td>
                <td className="py-2 px-4 border-b">{p.estoque}</td>
                <td className="py-2 px-4 border-b">{p.estoque_minimo}</td>
                <td className="py-2 px-4 border-b">
                  {p.alerta_baixo ? (
                    <span className="text-red-600 font-semibold">Baixo</span>
                  ) : (
                    <span className="text-green-600">Ok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ranking de clientes */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <h3 className="text-xl font-semibold mb-4">Ranking de Clientes</h3>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Cliente</th>
              <th className="py-2 px-4 border-b">Total Gasto (R$)</th>
            </tr>
          </thead>
          <tbody>
            {rankingClientes.map((item, idx) => (
              <tr key={idx} className="text-center">
                <td className="py-2 px-4 border-b">{item.cliente}</td>
                <td className="py-2 px-4 border-b">{item.total_gasto.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Relatorios;