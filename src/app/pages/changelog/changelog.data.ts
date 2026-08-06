export interface ChangelogEntry {
  date: string; // yyyy-mm-dd
  title: string;
  items: string[];
}

/** Mais recente primeiro. Adicione uma entrada no topo a cada atualização relevante. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-05',
    title: 'Estatísticas da spec agora são visuais, e nomes dos filtros por extenso',
    items: [
      'A seção "Desempenho nos logs" deixou de ser uma tabela de números soltos: agora cada conteúdo é um card com uma barra que vai de zero até o recorde, mostrando de relance onde fica o desempenho típico, o teto realista (p95) e o recorde. Quanto mais espalhados, mais o resultado depende de gear e execução.',
      'Cada card mostra também o tamanho da amostra com cor indicando o quanto dá pra confiar naquele número.',
      'A tabela de "Desempenho por Boss" ganhou barras dentro das células, comparando cada boss com o melhor boss da spec naquela dificuldade — dá pra ver num relance em quais bosses a spec brilha e em quais ela sofre.',
      'A mesma visualização vale pra seção de Sobrevivência dos tanks.',
      'Os nomes dos filtros não são mais cortados ("Raid — Zul\'Gurub" e "Ascended" apareciam como "Raid — Zul..." e "Ascen...").',
    ],
  },
  {
    date: '2026-08-05',
    title: 'Filtros reorganizados, filtro de Melee/Ranged/Caster e visual modernizado',
    items: [
      'Novo filtro de Estilo pras specs de DPS: dá pra ver só Melee, só Ranged (dano físico à distância) ou só Caster. Specs de tank jogando como DPS entram em Melee.',
      'Os filtros foram reorganizados em blocos: primeiro onde você joga (conteúdo, dificuldade, fase), depois qual função, e as opções de medição (Métrica e Perfil de Dano) foram pra uma seção "Opções avançadas" recolhida — com um resumo sempre visível do que está selecionado, pra nada ficar escondido.',
      'Botão "Limpar" pra voltar todos os filtros ao padrão de uma vez.',
      'O filtro de AoE foi removido: a API de logs só separa dano de trash em parte das dungeons e nunca nas raids, então aquele ranking dizia mais sobre quais combates tinham o dado do que sobre as specs.',
      'Emojis trocados por ícones de verdade em todo o site, e os textos de ajuda agora aparecem em tooltips próprias — mais legíveis, com quebra de linha e sem a demora do tooltip do navegador.',
      'A marca no topo agora mostra "CoA Meta", que é o nome do site.',
    ],
  },
  {
    date: '2026-08-05',
    title: 'Foco de Cura: Tank vs Raid (pra quem quer ser um healer dedicado a tank)',
    items: [
      'Nova seção "Foco de Cura: Tank vs Raid" no filtro Healer da tier list: mostra quais specs tendem a concentrar mais cura nos tanks em vez de espalhar pelo raid — pra quem quer saber qual spec escolher pra ser um healer dedicado a tank.',
      'A mesma informação também aparece na página de cada spec de healer, com uma barra comparando o foco real com a média esperada se a cura fosse espalhada igualmente.',
      'É uma estimativa por amostragem dos top parses de Zul\'Gurub (não todos os parses) — uma heurística baseada em quem recebeu a cura, não um dado oficial de "atribuição" de healer.',
    ],
  },
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
