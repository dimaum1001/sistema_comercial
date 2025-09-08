// Página de Contas a Pagar
//
// Esta página permite ao usuário visualizar, cadastrar e atualizar
// contas a pagar. Ela consome as rotas ``/contas-pagar`` da API para
// listar e manipular dados. A estrutura é semelhante às outras
// páginas do sistema, adotando hooks para estado e efeitos.

import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ContasPagar = () => {
  const [contas, setContas] = useState([]);
  const [novaConta, setNovaConta] = useState({
    fornecedorId: '',
    descricao: '',
    valor: '',
    dataVencimento: ''
  });

  // Carrega todas as contas ao montar o componente
  useEffect(() => {
    buscarContas();
  }, []);

  const buscarContas = async () => {
    try {
      const { data } = await api.get('/contas-pagar');
      setContas(data);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    }
  };

  const handleChange = (e) => {
    setNovaConta({ ...novaConta, [e.target.name]: e.target.value });
  };

  const criarConta = async () => {
    try {
      // Converte valor para número antes de enviar
      const payload = {
        fornecedor_id: novaConta.fornecedorId,
        descricao: novaConta.descricao,
        valor: parseFloat(novaConta.valor),
        data_vencimento: novaConta.dataVencimento
      };
      await api.post('/contas-pagar', payload);
      setNovaConta({ fornecedorId: '', descricao: '', valor: '', dataVencimento: '' });
      buscarContas();
    } catch (error) {
      console.error('Erro ao criar conta:', error);
    }
  };

  const marcarComoPaga = async (id) => {
    try {
      await api.put(`/contas-pagar/${id}`, {
        status: 'paga',
        data_pagamento: new Date().toISOString()
      });
      buscarContas();
    } catch (error) {
      console.error('Erro ao atualizar conta:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Contas a Pagar</h2>
      {/* Formulário para nova conta */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Fornecedor ID
          </label>
          <input
            type="text"
            name="fornecedorId"
            value={novaConta.fornecedorId}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="UUID do fornecedor"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Descrição
          </label>
          <input
            type="text"
            name="descricao"
            value={novaConta.descricao}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Descrição da conta"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Valor (R$)
          </label>
          <input
            type="number"
            name="valor"
            value={novaConta.valor}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="0.00"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Data de Vencimento
          </label>
          <input
            type="date"
            name="dataVencimento"
            value={novaConta.dataVencimento}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <button
          onClick={criarConta}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Criar Conta
        </button>
      </div>

      {/* Tabela de contas */}
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">ID</th>
            <th className="py-2 px-4 border-b">Fornecedor</th>
            <th className="py-2 px-4 border-b">Descrição</th>
            <th className="py-2 px-4 border-b">Valor (R$)</th>
            <th className="py-2 px-4 border-b">Vencimento</th>
            <th className="py-2 px-4 border-b">Status</th>
            <th className="py-2 px-4 border-b">Ações</th>
          </tr>
        </thead>
        <tbody>
          {contas.map((conta) => (
            <tr key={conta.id} className="text-center">
              <td className="py-2 px-4 border-b">
                {conta.id.substring(0, 8)}...
              </td>
              <td className="py-2 px-4 border-b">
                {conta.fornecedor_id || '—'}
              </td>
              <td className="py-2 px-4 border-b">{conta.descricao}</td>
              <td className="py-2 px-4 border-b">{parseFloat(conta.valor).toFixed(2)}</td>
              <td className="py-2 px-4 border-b">
                {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
              </td>
              <td className="py-2 px-4 border-b capitalize">
                {conta.status}
              </td>
              <td className="py-2 px-4 border-b">
                {conta.status === 'pendente' ? (
                  <button
                    onClick={() => marcarComoPaga(conta.id)}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded"
                  >
                    Marcar como Paga
                  </button>
                ) : (
                  <span className="text-green-700">Paga</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ContasPagar;