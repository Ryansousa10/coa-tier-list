import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipDirective } from '../../tooltip.directive';
import { Icons } from '../../icons';
import { DataService } from '../../data.service';
import { BisFile, BossStatsFile, ClassInfo, EnchantInfo, RaidDifficulty, SpecInfo, SpecStats, StatsFile, TankFocusEntry, TankFocusFile } from '../../models';

interface ContentStat {
  label: string;
  metricLabel: string;
  stats: SpecStats;
}

@Component({
  selector: 'app-spec-detail',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TooltipDirective],
  templateUrl: './spec-detail.component.html',
  styleUrl: './spec-detail.component.scss',
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
      if (stats) rows.push({ label: l.label, metricLabel, stats });
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
      if (stats) rows.push({ label: l.label, metricLabel: 'DTPS', stats });
    }
    return rows;
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
