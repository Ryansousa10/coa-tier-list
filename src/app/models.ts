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

export type DamageProfile = 'blended' | 'single' | 'aoe';

/** Só se aplica quando role === 'tank'. threat = dano causado (padrão), survival = dano recebido (menor é melhor). */
export type TankMetric = 'threat' | 'survival';

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

export interface TierFilter {
  content: ContentType;
  difficulty: string; // raid: ascended|mythic|heroic|normal — dungeons: normal|mythic
  phase: number;      // dungeons/worldboss: 1|0
  role: Role;
  metric: 'median' | 'p95';
  damageProfile: DamageProfile;
  tankMetric: TankMetric;
}
