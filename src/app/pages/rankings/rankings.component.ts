import { Component, OnInit, computed, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { DataService } from '../../data.service';
import { TooltipDirective } from '../../tooltip.directive';
import { SegmentedDirective } from '../../segmented.directive';
import { Icons } from '../../icons';
import { RankingCategory, RankingPlayer, RankingScope, RankingsFile } from '../../models';

@Component({
  selector: 'app-rankings',
  standalone: true,
  imports: [LucideAngularModule, TooltipDirective, SegmentedDirective],
  templateUrl: './rankings.component.html',
  styleUrl: './rankings.component.scss',
})
export class RankingsComponent implements OnInit {
  readonly Icons = Icons;

  file = signal<RankingsFile | null>(null);
  loading = signal(true);

  scopeKey = signal<string>('raid-zg');
  categoryKey = signal<string>('dps');
  specFilter = signal<string>('all');

  scopes = computed(() => this.file()?.scopes ?? []);

  scope = computed<RankingScope | null>(
    () => this.scopes().find(s => s.key === this.scopeKey()) ?? this.scopes()[0] ?? null,
  );

  categories = computed<RankingCategory[]>(() => this.scope()?.categories ?? []);

  category = computed<RankingCategory | null>(
    () => this.categories().find(c => c.key === this.categoryKey()) ?? this.categories()[0] ?? null,
  );

  scopeIndex = computed(() => Math.max(0, this.scopes().findIndex(s => s.key === this.scope()?.key)));
  categoryIndex = computed(() => Math.max(0, this.categories().findIndex(c => c.key === this.category()?.key)));

  /** Specs agrupadas por classe — com ~50 specs, uma lista plana fica impossível de achar nada. */
  specGroups = computed(() => {
    const cat = this.category();
    if (!cat) return [];
    const byClass = new Map<string, Set<string>>();
    for (const p of cat.players) {
      if (!byClass.has(p.className)) byClass.set(p.className, new Set());
      byClass.get(p.className)!.add(p.spec);
    }
    return [...byClass.entries()]
      .map(([className, specs]) => ({ className, specs: [...specs].sort() }))
      .sort((a, b) => a.className.localeCompare(b.className));
  });

  /** Lista final: filtrada por spec e renumerada, pra a posição refletir o filtro. */
  players = computed(() => {
    const cat = this.category();
    if (!cat) return [];
    const spec = this.specFilter();
    const list = spec === 'all' ? cat.players : cat.players.filter(p => p.spec === spec);
    return list.map((p, i) => ({ ...p, rank: i + 1 }));
  });

  /** Os 3 primeiros ganham destaque de pódio acima da tabela (e seguem na tabela). */
  podium = computed(() => this.players().slice(0, 3));

  scoreLabel = computed(() => (this.scope()?.scoreKind === 'avg' ? 'Média geral' : 'Pontos'));

  scoreHint = computed(() =>
    this.scope()?.scoreKind === 'avg'
      ? 'Média do all-star score por boss (0 a 100), somando todas as dificuldades. É a nota média que o jogador tira em cada boss que enfrenta.'
      : 'Pontos totais do AscensionLogs. Em dungeons a pontuação premia cobertura: quanto mais bosses diferentes o jogador parseia bem, mais pontos ele soma.',
  );

  lastUpdated = computed(() => {
    const iso = this.file()?.extractedAt;
    if (!iso) return null;
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  });

  constructor(public data: DataService, title: Title) {
    title.setTitle('Rankings de Jogadores — CoA Meta');
  }

  async ngOnInit() {
    const file = await this.data.loadRankings();
    this.file.set(file);
    this.loading.set(false);
  }

  setScope(key: string) {
    this.scopeKey.set(key);
    // categoria e spec podem não existir no novo conteúdo
    const cats = this.scopes().find(s => s.key === key)?.categories ?? [];
    if (!cats.some(c => c.key === this.categoryKey())) this.categoryKey.set(cats[0]?.key ?? 'dps');
    this.specFilter.set('all');
  }

  setCategory(key: string) {
    this.categoryKey.set(key);
    this.specFilter.set('all');
  }

  onSpecChange(ev: Event) {
    this.specFilter.set((ev.target as HTMLSelectElement).value);
  }

  profileUrl(p: RankingPlayer): string {
    const s = this.scope();
    if (!s) return '#';
    // manda pro perfil já na dificuldade mais alta em que ele tem registro
    const diff = s.difficulties.find(d => p.results[d.key])?.key ?? s.difficulties[0].key;
    return this.data.playerUrl(p.name, s.location, s.phase, diff);
  }

  fmt(n: number): string {
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  /** Largura da barra do score, relativa ao 1º colocado da lista atual. */
  scoreBar(p: RankingPlayer): string {
    const top = this.players()[0]?.score ?? 0;
    if (!top) return '0%';
    return `${Math.max(3, Math.round((p.score / top) * 100))}%`;
  }

  resultTooltip(p: RankingPlayer, diffKey: string): string {
    const r = p.results[diffKey];
    if (!r) return 'Sem registro nesta dificuldade';
    return `${this.fmt(r.points)} pontos em ${r.bossesKilled} boss${r.bossesKilled === 1 ? '' : 'es'}`;
  }
}
