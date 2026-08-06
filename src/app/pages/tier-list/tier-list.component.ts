import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';
import { DataService } from '../../data.service';
import { TierService } from '../../tier.service';
import { TooltipDirective } from '../../tooltip.directive';
import { SegmentedDirective } from '../../segmented.directive';
import { Icons } from '../../icons';
import {
  ClassInfo, ContentType, DamageProfile, Role, SpecInfo, SpecStyle,
  StatsFile, TankFocusFile, TankMetric, TierEntry, TierFilter,
} from '../../models';

@Component({
  selector: 'app-tier-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TooltipDirective, SegmentedDirective],
  templateUrl: './tier-list.component.html',
  styleUrl: './tier-list.component.scss',
})
export class TierListComponent implements OnInit {
  readonly Icons = Icons;

  classes = signal<ClassInfo[]>([]);
  statsFile = signal<StatsFile | null>(null);
  tankFocusFile = signal<TankFocusFile | null>(null);
  loading = signal(true);

  content = signal<ContentType>('raid');
  difficulty = signal('ascended');
  phase = signal(1);
  role = signal<Role>('dps');
  metric = signal<'median' | 'p95'>('median');
  damageProfile = signal<DamageProfile>('blended');
  tankMetric = signal<TankMetric>('threat');
  style = signal<SpecStyle>('all');
  advancedOpen = signal(false);

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
  readonly phases = [
    { key: 1, label: 'Fase 1' },
    { key: 0, label: 'Fase 0' },
  ];
  readonly roles: { key: Role; label: string; icon: LucideIconData; hint: string }[] = [
    { key: 'dps', label: 'DPS', icon: Icons.dps, hint: 'Specs de dano — ranqueadas por DPS.' },
    { key: 'tank', label: 'Tank', icon: Icons.tank, hint: 'Specs de tank — dá pra ver tanto o dano que causam quanto o dano que recebem.' },
    { key: 'healer', label: 'Healer', icon: Icons.healer, hint: 'Specs de cura — ranqueadas por HPS.' },
    { key: 'support', label: 'Support', icon: Icons.support, hint: 'Specs de suporte — ranqueadas pelo dano que causam enquanto buffam o grupo.' },
  ];
  readonly styles: { key: SpecStyle; label: string; icon: LucideIconData | null; hint: string }[] = [
    { key: 'all', label: 'Todos', icon: null, hint: 'Todas as specs de DPS, sem separar por estilo de jogo.' },
    { key: 'melee', label: 'Melee', icon: Icons.melee, hint: 'Specs que causam dano corpo a corpo. Inclui specs de tank jogando como DPS.' },
    { key: 'ranged', label: 'Ranged', icon: Icons.ranged, hint: 'Specs de dano físico à distância (arco, arma de fogo).' },
    { key: 'caster', label: 'Caster', icon: Icons.caster, hint: 'Specs que causam dano com magia.' },
  ];
  readonly damageProfiles: { key: DamageProfile; label: string; hint: string }[] = [
    { key: 'blended', label: 'Geral', hint: 'Todos os alvos da luta (boss + adds), como a luta acontece na prática.' },
    { key: 'single', label: 'Single-Target', hint: 'Só o dano no boss, sem contar adds — mostra o real dano single-target da spec.' },
  ];
  readonly tankMetrics: { key: TankMetric; label: string; hint: string }[] = [
    { key: 'threat', label: 'Dano Causado', hint: 'Quanto dano o tank causa (útil pra threat/ameaça). Igual ao ranking de DPS, mas só entre specs de tank.' },
    { key: 'survival', label: 'Sobrevivência', hint: 'Quanto dano o tank recebe por segundo — aqui menor é melhor: significa que a spec mitiga mais e sobra folga pros healers.' },
  ];
  readonly metrics: { key: 'median' | 'p95'; label: string; hint: string }[] = [
    { key: 'median', label: 'Média', hint: 'Desempenho típico: metade dos parses fica acima desse valor, metade abaixo.' },
    { key: 'p95', label: 'Topo (p95)', hint: 'Teto de desempenho: 95% dos parses ficam abaixo desse valor.' },
  ];

  filter = computed<TierFilter>(() => ({
    content: this.content(),
    difficulty: this.difficulty(),
    phase: this.phase(),
    role: this.role(),
    metric: this.metric(),
    damageProfile: this.damageProfile(),
    tankMetric: this.tankMetric(),
    style: this.style(),
  }));

  isSurvivalMode = computed(() => this.role() === 'tank' && this.tankMetric() === 'survival');

  // Cura não tem "single-target" (não existe curar só o boss) — a API ignora
  // damageMode quando a métrica é HPS e devolve o mesmo valor do Geral, o que
  // só confunde. Dano recebido (DTPS) também não tem essa dimensão.
  showDamageProfile = computed(() => this.role() !== 'healer' && !this.isSurvivalMode());

  /** Dificuldades válidas pro conteúdo atual (World Bosses só tem Normal). */
  difficulties = computed(() =>
    this.content() === 'raid' ? this.raidDifficulties
      : this.content() === 'dungeons' ? this.dungeonDifficulties
        : [],
  );

  // índices que a diretiva coaSegmented usa pra achar o botão ativo e medi-lo
  contentIndex = computed(() => this.contents.findIndex(c => c.key === this.content()));
  difficultyIndex = computed(() => this.difficulties().findIndex(d => d.key === this.difficulty()));
  phaseIndex = computed(() => this.phases.findIndex(p => p.key === this.phase()));
  roleIndex = computed(() => this.roles.findIndex(r => r.key === this.role()));
  styleIndex = computed(() => this.styles.findIndex(s => s.key === this.style()));
  tankMetricIndex = computed(() => this.tankMetrics.findIndex(t => t.key === this.tankMetric()));
  metricIndex = computed(() => this.metrics.findIndex(m => m.key === this.metric()));
  damageProfileIndex = computed(() => this.damageProfiles.findIndex(p => p.key === this.damageProfile()));

  tiers = computed(() => {
    const stats = this.statsFile();
    if (!stats) return [];
    const entries = this.tierService.compute(this.classes(), stats, this.filter());
    return this.tierService.groupByTier(entries);
  });

  totalSpecs = computed(() => this.tiers().reduce((n, g) => n + g.entries.length, 0));

  /**
   * As specs de Support não têm classificação de estilo na fonte (o BisBeard
   * marca só "support"), então elas ficam de fora ao filtrar por Melee/Ranged/
   * Caster. Avisamos em vez de deixar sumirem sem explicação.
   */
  styleNote = computed(() => {
    if (this.role() !== 'dps' || this.style() === 'all') return null;
    const hidden = this.classes()
      .flatMap(c => c.specs)
      .filter(s => s.roles.includes('dps') && s.fineRole === 'support').length;
    if (hidden === 0) return null;
    return `${hidden} specs de Support ficam de fora aqui — a fonte não separa elas por estilo de jogo. Use "Todos" pra vê-las.`;
  });

  /** Resumo das opções avançadas, pra nada ficar escondido quando fechado. */
  advancedSummary = computed(() => {
    const parts = [this.metrics.find(m => m.key === this.metric())!.label];
    if (this.showDamageProfile()) {
      parts.push(this.damageProfiles.find(p => p.key === this.damageProfile())!.label);
    }
    return parts.join(' · ');
  });

  /** Só faz sentido pra healers — quanto da cura tende a ir pros tanks vs pro raid */
  tankFocusRanking = computed(() => {
    if (this.role() !== 'healer') return [];
    const tf = this.tankFocusFile();
    if (!tf) return [];
    const rows: { cls: ClassInfo; spec: SpecInfo; focusRatio: number; baselineRatio: number; samples: number }[] = [];
    for (const cls of this.classes()) {
      for (const spec of cls.specs) {
        if (!spec.roles.includes('healer')) continue;
        const entry = tf.specs[`${cls.key}-${spec.key}`];
        if (!entry) continue;
        rows.push({ cls, spec, focusRatio: entry.focusRatio, baselineRatio: entry.baselineRatio, samples: entry.samples });
      }
    }
    return rows.sort((a, b) => b.focusRatio - a.focusRatio);
  });

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
    const [classes, stats, tankFocus] = await Promise.all([
      this.data.loadClasses(),
      this.data.loadStats(),
      this.data.loadTankFocus(),
    ]);
    this.classes.set(classes);
    this.statsFile.set(stats);
    this.tankFocusFile.set(tankFocus);
    this.loading.set(false);
  }

  setContent(c: ContentType) {
    this.content.set(c);
    if (c === 'raid') this.difficulty.set('ascended');
    if (c === 'dungeons') { this.difficulty.set('mythic'); this.phase.set(1); }
    if (c === 'worldboss') { this.difficulty.set('normal'); this.phase.set(1); }
  }

  setRole(r: Role) {
    this.role.set(r);
    if (r !== 'tank') this.tankMetric.set('threat');
    if (r !== 'dps') this.style.set('all');
    if (r === 'healer') this.damageProfile.set('blended');
  }

  setTankMetric(m: TankMetric) {
    this.tankMetric.set(m);
    if (m === 'survival') this.damageProfile.set('blended');
  }

  /** Volta tudo pro padrão — a saída fácil quando o usuário se perde nos filtros. */
  resetFilters() {
    this.content.set('raid');
    this.difficulty.set('ascended');
    this.phase.set(1);
    this.role.set('dps');
    this.metric.set('median');
    this.damageProfile.set('blended');
    this.tankMetric.set('threat');
    this.style.set('all');
  }

  isDefault = computed(() =>
    this.content() === 'raid' && this.difficulty() === 'ascended' && this.phase() === 1 &&
    this.role() === 'dps' && this.metric() === 'median' && this.damageProfile() === 'blended' &&
    this.tankMetric() === 'threat' && this.style() === 'all',
  );

  metricLabel(): string {
    if (this.isSurvivalMode()) return 'DTPS';
    return this.role() === 'healer' ? 'HPS' : 'DPS';
  }

  fmt(n: number): string {
    return Math.round(n).toLocaleString('pt-BR');
  }

  pct(n: number): string {
    return (n * 100).toFixed(1) + '%';
  }

  barWidth(e: TierEntry): string {
    return `${Math.max(4, Math.round(e.relative * 100))}%`;
  }

  specTooltip(e: TierEntry): string {
    return `${e.cls.name} — ${e.spec.name}\n${this.metricLabel()} ${this.fmt(e.score)} · ${e.stats.parses} parses`;
  }

  varianceHint(e: TierEntry): string {
    const ratio = e.stats.p95 && e.stats.median ? (e.stats.p95 / e.stats.median).toFixed(1) : '?';
    if (this.isSurvivalMode()) {
      return `Dano recebido muito variável entre lutas (topo é ${ratio}x a média) — provavelmente picos pontuais de dano, não o padrão típico.`;
    }
    return `Desempenho muito variável entre lutas (topo é ${ratio}x a média) — essa spec provavelmente se destaca em fases com muitos alvos. Compare com o perfil "Single-Target" nas opções avançadas.`;
  }

  onIconError(ev: Event) {
    this.data.handleIconError(ev);
  }
}
