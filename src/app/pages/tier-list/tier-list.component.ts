import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DataService } from '../../data.service';
import { TierService } from '../../tier.service';
import { ClassInfo, ContentType, DamageProfile, Role, StatsFile, TankMetric, TierEntry, TierFilter } from '../../models';

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
  damageProfile = signal<DamageProfile>('blended');
  tankMetric = signal<TankMetric>('threat');

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
    { key: 'support', label: 'Support', icon: '✦' },
  ];
  readonly damageProfiles: { key: DamageProfile; label: string; hint: string }[] = [
    { key: 'blended', label: 'Geral', hint: 'Todos os alvos da luta (boss + adds), como a luta acontece na prática.' },
    { key: 'single', label: 'Single-Target', hint: 'Só o dano no boss, sem contar adds — mostra o real dano single-target da spec.' },
    { key: 'aoe', label: 'AoE', hint: 'Só dano em trash/adds — mostra o real potencial de dano em área da spec. Poucos combates têm esse dado separado.' },
  ];
  readonly tankMetrics: { key: TankMetric; label: string; hint: string }[] = [
    { key: 'threat', label: 'Dano Causado', hint: 'Quanto dano o tank causa (útil pra threat/ameaça). Igual ao ranking de DPS, mas só entre specs de tank.' },
    { key: 'survival', label: 'Sobrevivência', hint: 'Quanto dano o tank recebe por segundo — aqui menor é melhor: significa que a spec mitiga mais e sobra folga pros healers.' },
  ];

  filter = computed<TierFilter>(() => ({
    content: this.content(),
    difficulty: this.difficulty(),
    phase: this.phase(),
    role: this.role(),
    metric: this.metric(),
    damageProfile: this.damageProfile(),
    tankMetric: this.tankMetric(),
  }));

  isSurvivalMode = computed(() => this.role() === 'tank' && this.tankMetric() === 'survival');

  tiers = computed(() => {
    const stats = this.statsFile();
    if (!stats) return [];
    const entries = this.tierService.compute(this.classes(), stats, this.filter());
    return this.tierService.groupByTier(entries);
  });

  totalSpecs = computed(() => this.tiers().reduce((n, g) => n + g.entries.length, 0));

  metricDescription = computed(() =>
    this.metric() === 'median'
      ? 'Desempenho típico: metade dos parses registrados fica acima desse valor, metade abaixo. Reflete como a spec performa "na prática", com builds e execução médias.'
      : 'Desempenho de teto: valor que 95% dos parses ficam abaixo dele (percentil 95). Mostra o potencial máximo da spec quando bem jogada e bem equipada, sem contar os parses excepcionais do topo.',
  );

  damageProfileDescription = computed(
    () => this.damageProfiles.find(p => p.key === this.damageProfile())?.hint ?? '',
  );

  tankMetricDescription = computed(
    () => this.tankMetrics.find(t => t.key === this.tankMetric())?.hint ?? '',
  );

  lastUpdated = computed(() => {
    const iso = this.statsFile()?.extractedAt;
    if (!iso) return null;
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} às ${timePart}`;
  });

  constructor(
    public data: DataService,
    private tierService: TierService,
    title: Title,
  ) {
    title.setTitle('CoA Meta - Tier List — Conquest of Azeroth');
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

  setRole(r: Role) {
    this.role.set(r);
    if (r !== 'tank') this.tankMetric.set('threat');
  }

  metricLabel(): string {
    if (this.isSurvivalMode()) return 'DTPS';
    return this.role() === 'healer' ? 'HPS' : 'DPS';
  }

  fmt(n: number): string {
    return Math.round(n).toLocaleString('pt-BR');
  }

  barWidth(e: TierEntry): string {
    return `${Math.max(4, Math.round(e.relative * 100))}%`;
  }

  varianceHint(e: TierEntry): string {
    const ratio = e.stats.p95 && e.stats.median ? (e.stats.p95 / e.stats.median).toFixed(1) : '?';
    if (this.isSurvivalMode()) {
      return `Dano recebido muito variável entre lutas (topo é ${ratio}x a média) — provavelmente picos pontuais de dano, não o padrão típico.`;
    }
    return `Desempenho muito variável entre lutas (topo é ${ratio}x a média) — essa spec provavelmente se destaca em fases com dano em área. Confira os filtros "Single-Target" e "AoE" pra ver o dano isolado.`;
  }

  onIconError(ev: Event) {
    this.data.handleIconError(ev);
  }
}
