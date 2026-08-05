export interface ChangelogEntry {
  date: string; // yyyy-mm-dd
  title: string;
  items: string[];
}

/** Mais recente primeiro. Adicione uma entrada no topo a cada atualização relevante. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-05',
    title: 'Automação dos dados, DTPS pra tanks e data de atualização',
    items: [
      'Os dados do site agora atualizam sozinhos a cada 2 dias (ou a qualquer momento sob demanda), sem precisar de ninguém rodando nada manualmente.',
      'A tier list mostra agora quando os dados foram atualizados pela última vez, no topo da página.',
      'Novo filtro "Sobrevivência" pra tanks: em vez de dano causado, mostra quanto dano cada spec recebe por segundo tanqueando (DTPS) — aqui menor é melhor. Também aparece uma tabela de sobrevivência na página de cada spec de tank.',
    ],
  },
  {
    date: '2026-08-05',
    title: 'Desempenho por boss e página de Atualizações',
    items: [
      'Nova seção na página de cada spec mostrando a média de dano/cura em cada boss individual de Zul\'Gurub, nas 4 dificuldades (Normal, Heroic, Mythic, Ascended).',
      'Esta página de Atualizações — histórico do que muda no site, pra facilitar acompanhar as novidades.',
    ],
  },
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
