import { Link } from 'react-router-dom'

const sections = [
  {
    title: '1. Sobre esta política',
    body: [
      'Esta Política de Privacidade explica, em linguagem simples, como o Sistema Comercial trata dados pessoais de clientes, fornecedores, colaboradores e demais usuários. Ela foi elaborada para atender aos princípios da Lei Geral de Proteção de Dados (LGPD).'
    ]
  },
  {
    title: '2. Dados coletados',
    body: [
      'Cadastro de usuários: nome, e-mail, perfil de acesso e registros de autenticação.',
      'Cadastro de clientes e fornecedores: dados cadastrais, fiscais, endereços e contatos.',
      'Registros de uso da plataforma: logs de acesso, IP pseudonimizado, hora, rota e agente de usuário.'
    ]
  },
  {
    title: '3. Finalidades e bases legais',
    body: [
      'Executar o contrato de prestação de serviços firmado com a sua empresa (art. 7º, V da LGPD).',
      'Cumprir obrigações legais e regulatórias ligadas à emissão de notas fiscais, relatórios contábeis e obrigações fiscais (art. 7º, II).',
      'Proteger o crédito e prevenir fraudes, incluindo mecanismos de auditoria e rate limiting (art. 7º, X).',
      'Aprimorar a experiência de uso e prover suporte técnico, com base em interesse legítimo e expectativas do usuário (art. 7º, IX).'
    ]
  },
  {
    title: '4. Tempo de retenção',
    body: [
      'Dados cadastrais e transacionais são armazenados enquanto durar a relação contratual e pelo prazo necessário para cumprimento de obrigações legais (normalmente até 10 anos para registros fiscais/contábeis).',
      'Logs de acesso gerados pelo módulo de auditoria são automaticamente descartados após o período configurado pelo controlador (padrão de 90 dias).'
    ]
  },
  {
    title: '5. Compartilhamento',
    body: [
      'Fornecedores de infraestrutura (hospedagem em nuvem, serviços de e-mail e monitoramento).',
      'Parceiros contábeis ou fiscais indicados pela sua empresa, quando necessário para cumprir obrigações legais.',
      'Autoridades públicas, mediante requisição formal ou para exercício regular de direitos.'
    ]
  },
  {
    title: '6. Direitos dos titulares',
    body: [
      'Confirmar a existência de tratamento, acessar e obter cópia dos dados.',
      'Corrigir dados incompletos, inexatos ou desatualizados.',
      'Solicitar anonimização, bloqueio ou eliminação de dados excessivos.',
      'Revogar o consentimento, quando aplicável, e manifestar oposição ao uso para finalidades legítimas.',
      'Portar os dados a outro fornecedor, observados requisitos legais.'
    ]
  },
  {
    title: '7. Como exercer seus direitos',
    body: [
      'Envie requisição escrita ao encarregado através do canal abaixo. Responderemos em até 15 dias ou no prazo legal aplicável.',
      'Caso o pedido dependa de validação adicional, poderemos solicitar informações para confirmar a identidade.'
    ]
  },
  {
    title: '8. Encarregado (DPO)',
    body: [
      'Nome: Dimas Carvalho da Silva',
      'E-mail: dpo@sistemacomercial.com.br',
      'Endereço: Rua dos Dados, 123, São Paulo/SP – Brasil.'
    ]
  },
  {
    title: '9. Atualizações',
    body: [
      'Esta política pode ser atualizada para refletir mudanças operacionais ou legais. A versão vigente estará sempre disponível neste endereço. Ao continuar utilizando o sistema após eventuais alterações, você concorda com os novos termos.'
    ]
  }
]

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-2xl p-8 space-y-6 text-gray-700">
        <header className="space-y-3 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Política de Privacidade</h1>
          <p className="text-sm text-gray-500">
            Vigente a partir de 10 de outubro de 2025. Última atualização automática registrada na auditoria do sistema.
          </p>
        </header>

        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
            <ul className="list-disc ml-5 space-y-1 text-sm leading-relaxed">
              {section.body.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
          <p>
            Ao criar uma conta ou continuar utilizando a plataforma, você declara que leu e compreendeu esta política. Em caso de dúvidas, entre em contato com o encarregado.
          </p>
        </section>

        <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-500 border-t pt-4">
          <p>
            Precisa retornar? <Link className="text-blue-600 hover:underline" to="/login">Voltar para o login</Link>
          </p>
          <p>© {new Date().getFullYear()} Sistema Comercial. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  )
}
