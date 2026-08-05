import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DataService } from '../../data.service';
import { BisFile, BossStatsFile, ClassInfo, EnchantInfo, RaidDifficulty, SpecInfo, SpecStats, StatsFile } from '../../models';

interface ContentStat {
  label: string;
  metricLabel: string;
  stats: SpecStats;
}

@Component({
  selector: 'app-spec-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './spec-detail.component.html',
  styleUrl: './spec-detail.component.scss',
})
export class SpecDetailComponent implements OnInit {
  cls = signal<ClassInfo | null>(null);
  spec = signal<SpecInfo | null>(null);
  bis = signal<BisFile | null>(null);
  bossStats = signal<BossStatsFile | null>(null);
  statsFile = signal<StatsFile | null>(null);
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
      const [bis, bossStats] = await Promise.all([
        this.data.loadBis(classKey, specKey),
        this.data.loadBossStats(classKey, specKey),
      ]);
      this.bis.set(bis);
      this.bossStats.set(bossStats);
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
