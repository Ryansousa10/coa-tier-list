import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DataService } from '../../data.service';
import { TierService } from '../../tier.service';
import { ClassInfo, ContentType, Role, StatsFile, TierEntry, TierFilter } from '../../models';

@Component({
  selector: 'app-tier-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './tier-list.component.html',
  styleUrl: './tier-list.component.scss',
})
export class TierListComponent implements OnInit {
  classes = signal<ClassInfo[]>([]);
  statsFile = signal<StatsFile | null>(null);
  loading = signal(true);

  content = signal<ContentType>('raid');
  difficulty = signal('ascended');
  phase = signal(1);
  role = signal<Role>('dps');
  metric = signal<'median' | 'p95'>('median');

  readonly contents: { key: ContentType; label: string }[] = [
    { key: 'raid', label: "Raid — Zul'Gurub" },
    { key: 'dungeons', label: 'Dungeons' },
    { key: 'worldboss', label: 'World Bosses' },
  ];
  readonly raidDifficulties = [
    { key: 'ascended', label: 'Ascended' },
    { key: 'mythic', label: 'Mythic' },
    { key: 'heroic', label: 'Heroic' },
    { key: 'normal', label: 'Normal' },
  ];
  readonly dungeonDifficulties = [
    { key: 'normal', label: 'Normal' },
    { key: 'mythic', label: 'Mythic' },
  ];
  readonly roles: { key: Role; label: string; icon: string }[] = [
    { key: 'dps', label: 'DPS', icon: '⚔️' },
    { key: 'tank', label: 'Tank', icon: '🛡️' },
    { key: 'healer', label: 'Healer', icon: '✚' },
    { key: 'support', label: 'Suporte', icon: '✦' },
  ];

  filter = computed<TierFilter>(() => ({
    content: this.content(),
    difficulty: this.difficulty(),
    phase: this.phase(),
    role: this.role(),
    metric: this.metric(),
  }));

  tiers = computed(() => {
    const stats = this.statsFile();
    if (!stats) return [];
    const entries = this.tierService.compute(this.classes(), stats, this.filter());
    return this.tierService.groupByTier(entries);
  });

  totalSpecs = computed(() => this.tiers().reduce((n, g) => n + g.entries.length, 0));

  constructor(
    public data: DataService,
    private tierService: TierService,
    title: Title,
  ) {
    title.setTitle('CoA Tier List — Conquest of Azeroth');
  }

  async ngOnInit() {
    const [classes, stats] = await Promise.all([this.data.loadClasses(), this.data.loadStats()]);
    this.classes.set(classes);
    this.statsFile.set(stats);
    this.loading.set(false);
  }

  setContent(c: ContentType) {
    this.content.set(c);
    if (c === 'raid') this.difficulty.set('ascended');
    if (c === 'dungeons') { this.difficulty.set('mythic'); this.phase.set(1); }
    if (c === 'worldboss') this.phase.set(1);
  }

  metricLabel(): string {
    return this.role() === 'healer' ? 'HPS' : 'DPS';
  }

  fmt(n: number): string {
    return Math.round(n).toLocaleString('pt-BR');
  }

  barWidth(e: TierEntry): string {
    return `${Math.max(4, Math.round(e.relative * 100))}%`;
  }

  onIconError(ev: Event) {
    this.data.handleIconError(ev);
  }
}
