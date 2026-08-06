import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgTemplateOutlet } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipDirective } from '../../tooltip.directive';
import { Icons } from '../../icons';
import { DataService } from '../../data.service';
import { BisFile, BossStatsFile, ClassInfo, EnchantInfo, RaidDifficulty, SpecInfo, SpecStats, StatsFile, TankFocusEntry, TankFocusFile } from '../../models';

interface ContentStat {
  label: string;
  metricLabel: string;
  stats: SpecStats;
  /** posição da média e do p95 numa escala de 0 até o máximo, pra desenhar a barra */
  medianPct: number;
  p95Pct: number;
  confidence: { label: string; level: 'alta' | 'media' | 'baixa' };
}

interface BossCell {
  difficulty: RaidDifficulty;
  median: number | null;
  parses: number;
  /** 0..1 em relação ao melhor valor da spec naquela dificuldade */
  pct: number;
}

interface BossRow {
  id: number;
  name: string;
  icon: string | null;
  cells: BossCell[];
}

/** Quanto dá pra confiar no número, a partir do tamanho da amostra. */
function confidenceOf(parses: number): ContentStat['confidence'] {
  if (parses >= 50) return { label: 'amostra alta', level: 'alta' };
  if (parses >= 15) return { label: 'amostra média', level: 'media' };
  return { label: 'amostra baixa', level: 'baixa' };
}

@Component({
  selector: 'app-spec-detail',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TooltipDirective, NgTemplateOutlet],
  templateUrl: './spec-detail.component.html',
  styleUrl: './spec-detail.component.scss',
  // expõe a cor da classe pra página inteira (barras, destaques), não só pro header
  host: { '[style.--class-color]': 'cls()?.color ?? null' },
})
export class SpecDetailComponent implements OnInit {
  readonly Icons = Icons;

  cls = signal<ClassInfo | null>(null);
  spec = signal<SpecInfo | null>(null);
  bis = signal<BisFile | null>(null);
  bossStats = signal<BossStatsFile | null>(null);
  statsFile = signal<StatsFile | null>(null);
  tankFocusFile = signal<TankFocusFile | null>(null);
  loading = signal(true);
  notFound = signal(false);

  readonly roleLabels: Record<string, string> = {
    dps: 'DPS', tank: 'Tank', healer: 'Healer', support: 'Support',
  };
  readonly fineRoleLabels: Record<string, string> = {
    'melee-dps': 'Melee DPS', 'ranged-dps': 'Ranged DPS',
    'caster-dps': 'Caster DPS', 'healer': 'Healer', 'tank': 'Tank', 'support': 'Support',
  };
  readonly raidDifficulties: { key: RaidDifficulty; label: string }[] = [
    { key: 'normal', label: 'Normal' },
    { key: 'heroic', label: 'Heroic' },
    { key: 'mythic', label: 'Mythic' },
    { key: 'ascended', label: 'Ascended' },
  ];
  contentStats = computed<ContentStat[]>(() => {
    const cls = this.cls();
    const spec = this.spec();
    const sf = this.statsFile();
    if (!cls || !spec || !sf) return [];
    const isHealer = spec.roles.includes('healer');
    const metricLabel = isHealer ? 'HPS' : 'DPS';
    const name = spec.logSpecNames.base;
    const rows: ContentStat[] = [];
    const lookups: { combo: string; label: string }[] = [
      { combo: 'raid-zg-ascended-' + this.roleCombo(spec), label: "Zul'Gurub (Ascended)" },
      { combo: 'raid-zg-normal-' + this.roleCombo(spec), label: "Zul'Gurub (Normal)" },
      { combo: 'dungeons-p1-mythic-' + this.roleCombo(spec), label: 'Dungeons Fase 1 (Mythic)' },
      { combo: 'worldboss-p1-' + this.roleCombo(spec), label: 'World Bosses Fase 1' },
    ];
    for (const l of lookups) {
      const stats = sf.stats[l.combo]?.[cls.name]?.[name];
      if (stats) rows.push(this.toRow(l.label, metricLabel, stats));
    }
    return rows;
  });

  /** Só preenchido pra specs de tank — dano recebido (menor é melhor) */
  dtpsStats = computed<ContentStat[]>(() => {
    const cls = this.cls();
    const spec = this.spec();
    const sf = this.statsFile();
    if (!cls || !spec || !sf || !spec.roles.includes('tank')) return [];
    const name = spec.logSpecNames.base;
    const rows: ContentStat[] = [];
    const lookups: { combo: string; label: string }[] = [
      { combo: 'raid-zg-ascended-dtps', label: "Zul'Gurub (Ascended)" },
      { combo: 'raid-zg-normal-dtps', label: "Zul'Gurub (Normal)" },
      { combo: 'dungeons-p1-mythic-dtps', label: 'Dungeons Fase 1 (Mythic)' },
      { combo: 'worldboss-p1-dtps', label: 'World Bosses Fase 1' },
    ];
    for (const l of lookups) {
      const stats = sf.stats[l.combo]?.[cls.name]?.[name];
      if (stats) rows.push(this.toRow(l.label, 'DTPS', stats));
    }
    return rows;
  });

  /** Enriquece o stat cru com o que a barra precisa pra ser desenhada. */
  private toRow(label: string, metricLabel: string, stats: SpecStats): ContentStat {
    const scale = Math.max(stats.max, stats.p95 ?? 0, stats.median, 1);
    return {
      label,
      metricLabel,
      stats,
      medianPct: (stats.median / scale) * 100,
      p95Pct: ((stats.p95 ?? stats.median) / scale) * 100,
      confidence: confidenceOf(stats.parses),
    };
  }

  /**
   * Tabela por boss com as barras já normalizadas: cada célula é comparada
   * com o melhor valor da própria spec naquela dificuldade, então dá pra ver
   * de relance em quais bosses ela vai bem ou mal.
   */
  bossView = computed(() => {
    const bs = this.bossStats();
    if (!bs) return null;
    const maxPerDifficulty: Partial<Record<RaidDifficulty, number>> = {};
    for (const boss of bs.bosses) {
      for (const d of this.raidDifficulties) {
        const r = boss.results[d.key];
        if (r && r.median > 0) {
          maxPerDifficulty[d.key] = Math.max(maxPerDifficulty[d.key] ?? 0, r.median);
        }
      }
    }
    const rows: BossRow[] = bs.bosses.map(boss => ({
      id: boss.id,
      name: boss.name,
      icon: boss.icon,
      cells: this.raidDifficulties.map(d => {
        const r = boss.results[d.key];
        const max = maxPerDifficulty[d.key] ?? 0;
        return {
          difficulty: d.key,
          median: r?.median ?? null,
          parses: r?.parses ?? 0,
          pct: r && max > 0 ? r.median / max : 0,
        };
      }),
    }));
    return { isHealer: bs.isHealer, unit: bs.isHealer ? 'HPS' : 'DPS', rows };
  });

  /** Só preenchido pra specs de healer com amostra suficiente */
  tankFocus = computed<TankFocusEntry | null>(() => {
    const cls = this.cls();
    const spec = this.spec();
    const tf = this.tankFocusFile();
    if (!cls || !spec || !tf) return null;
    return tf.specs[`${cls.key}-${spec.key}`] ?? null;
  });

  tankFocusLabel = computed(() => {
    const entry = this.tankFocus();
    if (!entry) return '';
    const times = entry.focusRatio / entry.baselineRatio;
    if (times >= 1.8) return 'Bem focado em tank';
    if (times >= 1.2) return 'Um pouco focado em tank';
    if (times <= 0.6) return 'Cura mais espalhada pelo raid';
    return 'Cura equilibrada';
  });

  constructor(
    public data: DataService,
    private route: ActivatedRoute,
    private title: Title,
  ) {}

  private roleCombo(spec: SpecInfo): string {
    if (spec.roles.includes('healer')) return 'healer';
    if (spec.roles.includes('tank')) return 'tank';
    if (spec.roles[0] === 'support') return 'support';
    return 'dps';
  }

  ngOnInit() {
    this.route.paramMap.subscribe(async params => {
      const classKey = params.get('classKey')!;
      const specKey = params.get('specKey')!;
      this.loading.set(true);
      const [classes, statsFile] = await Promise.all([
        this.data.loadClasses(),
        this.data.loadStats(),
      ]);
      const cls = classes.find(c => c.key === classKey) ?? null;
      const spec = cls?.specs.find(s => s.key === specKey) ?? null;
      this.cls.set(cls);
      this.spec.set(spec);
      this.statsFile.set(statsFile);
      if (!cls || !spec) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.title.setTitle(`${spec.name} ${cls.name} — CoA Meta - Tier List`);
      const [bis, bossStats, tankFocusFile] = await Promise.all([
        this.data.loadBis(classKey, specKey),
        this.data.loadBossStats(classKey, specKey),
        spec.roles.includes('healer') ? this.data.loadTankFocus() : Promise.resolve(null),
      ]);
      this.bis.set(bis);
      this.bossStats.set(bossStats);
      this.tankFocusFile.set(tankFocusFile);
      this.loading.set(false);
    });
  }

  fmt(n: number): string {
    return Math.round(n).toLocaleString('pt-BR');
  }

  onIconError(ev: Event) {
    this.data.handleIconError(ev);
  }

  onEnchantClick(ench: EnchantInfo) {
    window.open(this.data.searchUrl(ench.name), '_blank', 'noopener');
  }
}
