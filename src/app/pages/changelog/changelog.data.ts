export interface ChangelogEntry {
  date: string; // yyyy-mm-dd
  title: string;
  items: string[];
}

/** Mais recente primeiro. Adicione uma entrada no topo a cada atualização relevante. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-05',
    title: 'Lançamento do site',
    items: [
      'Site no ar: tier list filtrável por conteúdo (Raid, Dungeons, World Bosses), dificuldade e função, com página de detalhe de cada spec mostrando o BIS gear por slot.',
      'Explicação sempre visível do que "Média" e "Topo (p95)" significam, e ranking numerado (1º a 4º) dos itens de BIS gear em cada slot.',
      'Correção do ícone e do link de BIS da spec Rot (Venomancer) — as duas fontes de dados usavam nomes diferentes pra mesma spec.',
      'Tooltip real do jogo ao passar o mouse nos itens de BIS gear, no mesmo padrão do Wowhead — puxa dados ao vivo direto do banco de dados oficial do Ascension.',
      'Os 3 melhores encantamentos de cada slot (antes só o 1º), incluindo encantamentos "proc" como o Ninja\'s Focus, que antes não entravam no cálculo por não terem atributo fixo.',
      'Novo filtro de Perfil de Dano: Geral, Single-Target e AoE — além de um aviso visual em specs cujo desempenho é muito puxado por dano em área.',
      'Créditos no rodapé e padronização dos termos de jargão (Tank, Healer, Support, Single-Target etc.) em inglês.',
    ],
  },
];
