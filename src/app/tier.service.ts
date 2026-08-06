import { Injectable } from '@angular/core';
import { ClassInfo, SpecInfo, SpecStats, SpecStyle, StatsFile, TierEntry, TierFilter } from './models';

const TIER_THRESHOLDS: { tier: TierEntry['tier']; min: number }[] = [
  { tier: 'S', min: 0.85 },
  { tier: 'A', min: 0.68 },
  { tier: 'B', min: 0.5 },
  { tier: 'C', min: 0.32 },
  { tier: 'D', min: 0 },
];

const LOW_SAMPLE = 5;
/** p95/mediana acima disso indica desempenho muito puxado por picos (geralmente AoE) */
const HIGH_VARIANCE_RATIO = 2.5;

/**
 * Estilo de jogo de uma spec, a partir do fineRole vindo do BisBeard.
 * As 12 specs que aparecem como "X DPS" nos logs são todas specs de tank
 * jogando off-role — e todo tank luta em melee, então cai em 'melee' em vez
 * de sumir dos filtros. Healer/Support não têm variante de DPS nos logs.
 */
function styleOf(spec: SpecInfo): SpecStyle | null {
  switch (spec.fineRole) {
    case 'melee-dps': return 'melee';
    case 'ranged-dps': return 'ranged';
    case 'caster-dps': return 'caster';
    case 'tank': return 'melee';
    default: return null;
  }
}

@Injectable({ providedIn: 'root' })
export class TierService {
  /** Chave do combo em stats.json para o filtro selecionado */
  comboKey(f: TierFilter): string {
    const isSurvival = f.role === 'tank' && f.tankMetric === 'survival';
    const roleKey = isSurvival ? 'dtps' : f.role;
    // dano recebido não tem variantes de perfil de dano (não é dano causado)
    const suffix = isSurvival ? '' : f.damageProfile === 'single' ? '-st' : '';
    switch (f.content) {
      case 'raid':
        return `raid-zg-${f.difficulty}-${roleKey}${suffix}`;
      case 'dungeons':
        return `dungeons-p${f.phase}-${f.difficulty}-${roleKey}${suffix}`;
      case 'worldboss':
        return `worldboss-p${f.phase}-${roleKey}${suffix}`;
    }
  }

  compute(classes: ClassInfo[], statsFile: StatsFile, f: TierFilter): TierEntry[] {
    const combo = statsFile.stats[this.comboKey(f)];
    if (!combo) return [];
    const isSurvival = f.role === 'tank' && f.tankMetric === 'survival';

    const entries: Omit<TierEntry, 'relative' | 'tier'>[] = [];
    for (const cls of classes) {
      const classStats = combo[cls.name];
      if (!classStats) continue;
      for (const spec of cls.specs) {
        if (!spec.roles.includes(f.role)) continue;
        // estilo (melee/ranged/caster) só faz sentido pra DPS — pros outros
        // roles o fineRole é o próprio role, sem essa distinção
        if (f.role === 'dps' && f.style !== 'all' && styleOf(spec) !== f.style) continue;
        // no modo DPS, specs de tank/healer aparecem nos logs como "X DPS"
        const logName = f.role === 'dps' ? spec.logSpecNames.dps : spec.logSpecNames.base;
        const stats: SpecStats | undefined = classStats[logName];
        if (!stats) continue;
        const score = f.metric === 'p95' ? (stats.p95 ?? stats.max) : (stats.p50 ?? stats.median);
        if (!score || score <= 0) continue;
        const highVariance = !!(stats.p95 && stats.median && stats.p95 / stats.median >= HIGH_VARIANCE_RATIO);
        entries.push({
          cls,
          spec,
          logSpecName: logName,
          stats,
          score,
          lowSample: stats.parses < LOW_SAMPLE,
          highVariance,
        });
      }
    }

    if (isSurvival) {
      // dano recebido: menor é melhor — inverte a referência pro menor valor
      const best = Math.min(...entries.map(e => e.score), Infinity);
      return entries
        .map(e => {
          const relative = best / e.score;
          const tier = TIER_THRESHOLDS.find(t => relative >= t.min)!.tier;
          return { ...e, relative, tier };
        })
        .sort((a, b) => a.score - b.score);
    }

    const top = Math.max(...entries.map(e => e.score), 1);
    return entries
      .map(e => {
        const relative = e.score / top;
        const tier = TIER_THRESHOLDS.find(t => relative >= t.min)!.tier;
        return { ...e, relative, tier };
      })
      .sort((a, b) => b.score - a.score);
  }

  groupByTier(entries: TierEntry[]): { tier: TierEntry['tier']; entries: TierEntry[] }[] {
    const tiers: TierEntry['tier'][] = ['S', 'A', 'B', 'C', 'D'];
    return tiers
      .map(tier => ({ tier, entries: entries.filter(e => e.tier === tier) }))
      .filter(g => g.entries.length > 0);
  }
}
