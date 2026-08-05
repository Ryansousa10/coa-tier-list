import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DataService } from '../../data.service';
import { BisFile, ClassInfo, SpecInfo, SpecStats, StatsFile } from '../../models';

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
  statsFile = signal<StatsFile | null>(null);
  loading = signal(true);
  notFound = signal(false);

  readonly roleLabels: Record<string, string> = {
    dps: 'DPS', tank: 'Tank', healer: 'Healer', support: 'Suporte',
  };
  readonly fineRoleLabels: Record<string, string> = {
    'melee-dps': 'DPS corpo a corpo', 'ranged-dps': 'DPS à distância',
    'caster-dps': 'DPS conjurador', 'healer': 'Curandeiro', 'tank': 'Tanque', 'support': 'Suporte',
  };
  readonly sourceLabels: Record<string, string> = {
    raid: 'Raid', dungeon: 'Dungeon', worldboss: 'World Boss', worldforged: 'Worldforged',
    worldboe: 'BoE de mundo', crafting: 'Profissão', reputation: 'Reputação', quests: 'Missão',
    vendor: 'Vendedor', events: 'Evento', affixed: 'Item com afixo',
  };

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
      this.title.setTitle(`${spec.name} ${cls.name} — CoA Tier List`);
      this.bis.set(await this.data.loadBis(classKey, specKey));
      this.loading.set(false);
    });
  }

  fmt(n: number): string {
    return Math.round(n).toLocaleString('pt-BR');
  }

  statLine(stats: Record<string, number>): string {
    const names: Record<string, string> = {
      stamina: 'Vig', intellect: 'Int', strength: 'For', agility: 'Agi', spirit: 'Esp',
      critRating: 'Crít', hitRating: 'Acerto', hasteRating: 'Pressa', spellPower: 'PdM',
      attackPower: 'PdA', healingPower: 'Cura', armorPenetration: 'PenArm',
      spellPenetration: 'PenMag', expertise: 'Perícia', defenseRating: 'Def',
      dodgeRating: 'Esquiva', parryRating: 'Aparar', blockRating: 'Bloq', armor: 'Armadura',
    };
    return Object.entries(stats)
      .filter(([, v]) => typeof v === 'number' && v !== 0)
      .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${names[k] ?? k}`)
      .join(' · ');
  }

  sourceLabel(item: { sourceCategory: string; source: string; version: string }): string {
    const cat = this.sourceLabels[item.sourceCategory] ?? item.sourceCategory;
    const parts = [cat];
    if (item.source && item.source !== 'Unknown') parts.push(item.source);
    if (item.version && item.version !== 'Unknown' && item.version !== item.source) parts.push(item.version);
    return parts.join(' · ');
  }

  onIconError(ev: Event) {
    this.data.handleIconError(ev);
  }
}
