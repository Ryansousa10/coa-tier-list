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

export interface BisSlot {
  key: string;
  label: string;
  items: BisItem[];
}

export interface BisFile {
  className: string;
  specName: string;
  weights: Record<string, number>;
  slots: BisSlot[];
}

export interface TierFilter {
  content: ContentType;
  difficulty: string; // raid: ascended|mythic|heroic|normal — dungeons: normal|mythic
  phase: number;      // dungeons/worldboss: 1|0
  role: Role;
  metric: 'median' | 'p95';
}
