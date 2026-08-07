export interface ChangelogEntry {
  date: string; // yyyy-mm-dd
  title: string;
  items: string[];
}

/** Mais recente primeiro. Adicione uma entrada no topo a cada atualização relevante. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-06',
    title: 'Rankings: aviso de amostra baixa nas médias por dificuldade',
    items: [
      'Uma média vinda de poucos bosses (ex.: 100 com 1 boss só) agora aparece marcada com ⚠, porque é fácil bater o topo de um grupo raso de competidores logo no início da temporada — o número não é tão confiável quanto uma média de 10 bosses.',
      'A seção "Como essa pontuação é calculada" foi reescrita com a fórmula oficial do AscensionLogs (tirada direto da FAQ deles): pontuação por boss é uma comparação de DPS/HPS contra o melhor de todo mundo naquele boss/dificuldade, cross-class — não por spec, como a versão anterior do texto dizia.',
      'A média geral de cada jogador já era ponderada corretamente pelo número de bosses de cada dificuldade — esse ajuste só deixa isso visível também nas colunas por dificuldade.',
    ],
  },
  {
    date: '2026-08-06',
    title: 'Rankings mais leve: carrega só o que você está vendo',
    items: [
      'A tela de Rankings baixava as 8 listas (2 conteúdos × 4 funções) de uma vez, mesmo você só olhando uma por vez. Agora cada lista é um arquivo à parte, baixado só quando você escolhe aquela combinação — a primeira tela abre com um quarto do tamanho de antes.',
      'A tabela agora mostra 50 jogadores por vez com um botão "Carregar mais", em vez de tudo de uma vez — evita travar o navegador em listas com centenas de jogadores. A busca continua funcionando sobre a lista inteira, não só o que já apareceu na tela.',
    ],
  },
  {
    date: '2026-08-06',
    title: 'Rankings: fontes maiores, pódio com ícone grande e explicação da pontuação',
    items: [
      'Fontes maiores em toda a tela de Rankings, pra facilitar a leitura.',
      'Os ícones de spec nos 3 primeiros colocados do pódio ficaram bem maiores e sempre centralizados à direita do card, pra bater o olho e já saber a spec de cada um.',
      'Nova seção "Como essa pontuação é calculada", explicando por que a nota em Zul\'Gurub e em Dungeons usa contas diferentes, e por que existe um mínimo de bosses pra entrar no ranking.',
    ],
  },
  {
    date: '2026-08-06',
    title: 'Rankings: ícones das specs e busca por jogador',
    items: [
      'Cada jogador agora aparece com o ícone da sua spec, e o filtro de spec virou um menu com os ícones e busca — bem mais fácil de achar a spec que você quer entre as ~50 disponíveis.',
      'Novo campo de busca pra encontrar um jogador pelo nome. A posição mostrada continua sendo a do ranking completo, então dá pra ver exatamente em que lugar você está.',
      'Clicando no nome da spec de um jogador você vai pra página dela aqui no site.',
      'Corrigido o alinhamento das linhas da tabela, que "sanfonavam" conforme o conteúdo de cada célula.',
    ],
  },
  {
    date: '2026-08-06',
    title: 'Nova tela: Rankings de Jogadores',
    items: [
      'Nova página de Rankings com os melhores jogadores de Zul\'Gurub e de Dungeons Mythic, separados por função (DPS, Tank, Healer e Support) e filtráveis por spec.',
      'No ranking de Zul\'Gurub dá pra ver a pontuação do jogador em cada uma das 4 dificuldades e a média geral da raid.',
      'Clicando no nome do jogador você vai direto pro perfil dele no AscensionLogs.',
      'Os 3 primeiros de cada ranking aparecem em destaque no pódio, e ao filtrar por spec a numeração se ajusta pra mostrar o top daquela spec.',
      'A pontuação usa critérios diferentes por conteúdo, porque ela significa coisas diferentes: em Zul\'Gurub é a nota média por boss (0 a 100), já que a raid tem 10 bosses; em Dungeons são os pontos totais do AscensionLogs, que premiam cobertura (quantos dos 239 bosses o jogador parseia bem).',
    ],
  },
  {
    date: '2026-08-05',
    title: 'Corrige as barras da tabela "Desempenho por Boss"',
    items: [
      'As barras de cada célula eram normalizadas por coluna (cada dificuldade tinha sua própria escala), o que fazia um número menor às vezes sair com barra maior que um número bem mais alto de outra dificuldade. Agora todas usam a mesma escala, comparável em qualquer célula da tabela.',
      'Em linhas onde várias dificuldades chegavam perto de 100% (ex.: Hakkar), as barras vizinhas se emendavam numa faixa só. Agora cada célula tem um respiro entre as barras e um separador entre colunas.',
      'As 4 colunas de dificuldade agora têm sempre a mesma largura entre si — antes cada uma se ajustava ao próprio conteúdo, o que também distorcia a comparação visual entre elas.',
    ],
  },
  {
    date: '2026-08-05',
    title: 'Todas as dificuldades da raid na página da spec',
    items: [
      'A seção "Desempenho nos logs" mostrava só Ascended e Normal — agora traz as 4 dificuldades de Zul\'Gurub (Ascended, Mythic, Heroic e Normal), e também as Dungeons no Normal, que faltavam.',
      'Os cards passaram a ser agrupados por conteúdo, com a dificuldade no título de cada um, em vez de repetir "Zul\'Gurub" em todos.',
      'Vale pra seção de Sobrevivência dos tanks também.',
    ],
  },
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
