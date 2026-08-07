export type Role = 'dps' | 'tank' | 'healer' | 'support';
export type ContentType = 'raid' | 'dungeons' | 'worldboss';

export interface SpecInfo {
  name: string;
  key: string;
  icon: string | null;
  roles: Role[];
  fineRole: string | null;
  logSpecNames: { base: string; dps: string };
}

export interface ClassInfo {
  name: string;
  key: string;
  icon: string | null;
  color: string;
  specs: SpecInfo[];
}

export interface SpecStats {
  avg: number;
  median: number;
  max: number;
  min: number;
  parses: number;
  p99?: number;
  p95?: number;
  p75?: number;
  p50?: number;
  p25?: number;
  p10?: number;
}

/** stats.json: stats[comboKey][className][specName] -> SpecStats */
export interface StatsFile {
  extractedAt: string;
  phases: { phase: number; name: string; active: boolean }[];
  stats: Record<string, Record<string, Record<string, SpecStats>> | null>;
}

export interface TierEntry {
  cls: ClassInfo;
  spec: SpecInfo;
  /** nome usado nos logs para o role selecionado (ex.: "Vanguard DPS") */
  logSpecName: string;
  stats: SpecStats;
  score: number;
  relative: number; // 0..1 em relação ao topo
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  lowSample: boolean;
  /** p95 muito acima da mediana — desempenho puxado por picos, geralmente dano em área */
  highVariance: boolean;
}

export interface BisItem {
  id: string;
  name: string;
  quality: string;
  ilvl: number;
  icon: string | null;
  source: string;
  sourceCategory: string;
  version: string;
  dropRate: string;
  type: string;
  slot: string;
  stats: Record<string, number>;
  score: number;
}

export interface EnchantInfo {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  quality: string;
  score: number;
}

export interface BisSlot {
  key: string;
  label: string;
  items: BisItem[];
  enchants: EnchantInfo[];
}

export interface BisFile {
  className: string;
  specName: string;
  weights: Record<string, number>;
  slots: BisSlot[];
}

export type RaidDifficulty = 'normal' | 'heroic' | 'mythic' | 'ascended';

export interface BossDifficultyResult {
  median: number;
  parses: number;
}

export interface BossStatsEntry {
  id: number;
  name: string;
  icon: string | null;
  results: Partial<Record<RaidDifficulty, BossDifficultyResult>>;
}

export interface BossStatsFile {
  className: string;
  specName: string;
  isHealer: boolean;
  bosses: BossStatsEntry[];
}

/**
 * "blended" = todos os alvos da luta; "single" = só o boss (damageMode=boss-only).
 * Não existe perfil de AoE: a API só separa dano de trash em dungeons, e mesmo
 * lá a amostra não sustenta um ranking — o filtro foi removido em vez de
 * mostrar um dado que engana.
 */
export type DamageProfile = 'blended' | 'single';

/** Só se aplica quando role === 'tank'. threat = dano causado (padrão), survival = dano recebido (menor é melhor). */
export type TankMetric = 'threat' | 'survival';

/** Filtra as specs de DPS por estilo de jogo, a partir do fineRole de cada spec. */
export type SpecStyle = 'all' | 'melee' | 'ranged' | 'caster';

/**
 * Estimativa (amostral) de quanto da cura efetiva de cada spec de healer
 * vai pros tanks vs pro resto do raid — ver tools/scrape/healer-tank-focus.mjs.
 * baselineRatio = fração esperada se a cura fosse espalhada igualmente
 * entre todos (tanks/total de jogadores); focusRatio bem acima disso indica
 * um spec que tende a concentrar cura nos tanks.
 */
export interface TankFocusEntry {
  samples: number;
  focusRatio: number;
  baselineRatio: number;
}

export interface TankFocusFile {
  extractedAt: string;
  specs: Record<string, TankFocusEntry>; // key = "<classKey>-<specKey>"
}

/**
 * Ranking de jogadores — ver tools/scrape/rankings.mjs.
 * `avg` é o "Best Perf. Avg" do AscensionLogs pra UMA dificuldade específica:
 * a média do percentil (rank vs. cross-class) dos bosses da zona. Em
 * Zul'Gurub (zona fechada de 10 bosses) divide sempre pelos 10, boss não
 * matado conta 0 — por isso um clear parcial mostra um número baixo de
 * verdade, não um número alto e enganoso. Em Dungeons (agregado de dezenas
 * de instances sem um "clear completo" definido) divide pelos bosses
 * realmente atacados.
 * Não existe (nem no AscensionLogs) uma média combinando dificuldades
 * diferentes — por isso não inventamos uma: o ranking é sempre de uma
 * dificuldade por vez, escolhida na tela.
 * `lowSample` é true quando `avg` vem de poucos bosses (< 5) — ainda pode
 * acontecer de bater o topo de um grupo raso de competidores.
 * `tiebreak` é a soma dos pontos All-Star (medida contínua de DPS/HPS bruto
 * vs. o topo do cohort) dos mesmos bosses que entraram no `avg`. Serve só
 * pra desempatar quando dois jogadores têm o mesmo `avg` arredondado — o
 * percentil satura em 100 pra qualquer um que seja o topo do cohort, então
 * ele sozinho não diferencia "o quanto" alguém ficou à frente do resto.
 */
export interface RankingResult {
  avg: number;
  bossesKilled: number;
  lowSample: boolean;
  tiebreak: number;
}

export interface RankingPlayer {
  name: string;
  className: string;
  spec: string;
  results: Record<string, RankingResult>;
  /** Tamanho do pool de bosses do conteúdo (10 em Zul'Gurub) — usado pra explicar o divisor. */
  totalBosses: number | null;
}

/**
 * Metadados de uma categoria (specs disponíveis, quantos jogadores) — SEM os
 * jogadores em si. Os jogadores de cada conteúdo+categoria vivem num arquivo
 * à parte (`data/rankings/<scopeKey>-<categoryKey>.json`, ver `RankingPlayersFile`)
 * carregado sob demanda pela tela, pra não baixar as 8 listas de uma vez só
 * pra mostrar uma.
 */
export interface RankingCategory {
  key: string;
  label: string;
  specs: string[];
  playerCount: number;
}

export interface RankingScope {
  key: string;
  label: string;
  location: string;
  phase: number;
  difficulties: { key: string; label: string }[];
  categories: RankingCategory[];
}

/** data/rankings-index.json — carregado assim que a tela de Rankings abre. */
export interface RankingsIndexFile {
  extractedAt: string;
  scopes: RankingScope[];
}

/** data/rankings/<scopeKey>-<categoryKey>.json — carregado ao trocar de aba. */
export interface RankingPlayersFile {
  players: RankingPlayer[];
}

export interface TierFilter {
  content: ContentType;
  difficulty: string; // raid: ascended|mythic|heroic|normal — dungeons: normal|mythic
  phase: number;      // dungeons/worldboss: 1|0
  role: Role;
  metric: 'median' | 'p95';
  damageProfile: DamageProfile;
  tankMetric: TankMetric;
  style: SpecStyle;
}
