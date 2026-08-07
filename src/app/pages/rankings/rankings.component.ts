import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { DataService } from '../../data.service';
import { TooltipDirective } from '../../tooltip.directive';
import { SegmentedDirective } from '../../segmented.directive';
import { Icons } from '../../icons';
import { ClassInfo, RankingCategory, RankingPlayer, RankingScope, RankingsFile } from '../../models';

/** O que a tela precisa saber de uma spec além do que vem no ranking. */
interface SpecMeta {
  icon: string | null;
  classKey: string;
  specKey: string;
  color: string;
}

@Component({
  selector: 'app-rankings',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TooltipDirective, SegmentedDirective],
  templateUrl: './rankings.component.html',
  styleUrl: './rankings.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'specOpen.set(false)',
  },
})
export class RankingsComponent implements OnInit {
  readonly Icons = Icons;

  private host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

  file = signal<RankingsFile | null>(null);
  classes = signal<ClassInfo[]>([]);
  loading = signal(true);

  scopeKey = signal<string>('raid-zg');
  categoryKey = signal<string>('dps');
  specFilter = signal<string>('all');
  specOpen = signal(false);
  specSearch = signal('');
  playerSearch = signal('');

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

  /**
   * Ícone/cor de cada spec do ranking. Os nomes vêm da API de logs, que usa
   * variantes como "Tyrant DPS" pras specs de tank jogando off-role — por isso
   * indexamos tanto pelo nome base quanto pelo nome da variante de DPS.
   */
  private specMeta = computed(() => {
    const map = new Map<string, SpecMeta>();
    for (const cls of this.classes()) {
      for (const spec of cls.specs) {
        const meta: SpecMeta = {
          icon: spec.icon,
          classKey: cls.key,
          specKey: spec.key,
          color: cls.color,
        };
        map.set(`${cls.name}|${spec.logSpecNames.base}`, meta);
        map.set(`${cls.name}|${spec.logSpecNames.dps}`, meta);
      }
    }
    return map;
  });

  metaFor(className: string, spec: string): SpecMeta | null {
    return this.specMeta().get(`${className}|${spec}`) ?? null;
  }

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
      .map(([className, specs]) => ({
        className,
        specs: [...specs].sort().map(spec => ({ spec, meta: this.metaFor(className, spec) })),
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  });

  /** Mesma lista, filtrada pela busca do dropdown. */
  specGroupsFiltered = computed(() => {
    const term = this.specSearch().trim().toLowerCase();
    if (!term) return this.specGroups();
    return this.specGroups()
      .map(g => ({
        ...g,
        // busca casa tanto pelo nome da spec quanto pelo da classe
        specs: g.className.toLowerCase().includes(term)
          ? g.specs
          : g.specs.filter(s => s.spec.toLowerCase().includes(term)),
      }))
      .filter(g => g.specs.length > 0);
  });

  /** Rótulo/ícone do que está selecionado, mostrado no botão do dropdown. */
  selectedSpec = computed(() => {
    const spec = this.specFilter();
    if (spec === 'all') return null;
    for (const g of this.specGroups()) {
      const hit = g.specs.find(s => s.spec === spec);
      if (hit) return { spec, className: g.className, meta: hit.meta };
    }
    return { spec, className: '', meta: null };
  });

  /** Filtrada por spec e renumerada, pra a posição refletir o filtro escolhido. */
  private rankedPlayers = computed(() => {
    const cat = this.category();
    if (!cat) return [];
    const spec = this.specFilter();
    const list = spec === 'all' ? cat.players : cat.players.filter(p => p.spec === spec);
    return list.map((p, i) => ({ ...p, rank: i + 1 }));
  });

  isSearching = computed(() => this.playerSearch().trim().length > 0);

  /**
   * A busca por nome NÃO renumera: quem procura o próprio nick quer ver em que
   * posição está, então a lista já vem ranqueada e a busca só filtra.
   */
  players = computed(() => {
    const term = this.playerSearch().trim().toLowerCase();
    const list = this.rankedPlayers();
    return term ? list.filter(p => p.name.toLowerCase().includes(term)) : list;
  });

  /** Os 3 primeiros ganham destaque de pódio (escondido durante a busca). */
  podium = computed(() => (this.isSearching() ? [] : this.rankedPlayers().slice(0, 3)));

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
    const [file, classes] = await Promise.all([
      this.data.loadRankings(),
      this.data.loadClasses(),
    ]);
    this.file.set(file);
    this.classes.set(classes);
    this.loading.set(false);
  }

  setScope(key: string) {
    this.scopeKey.set(key);
    // categoria e spec podem não existir no novo conteúdo
    const cats = this.scopes().find(s => s.key === key)?.categories ?? [];
    if (!cats.some(c => c.key === this.categoryKey())) this.categoryKey.set(cats[0]?.key ?? 'dps');
    this.resetSpec();
  }

  setCategory(key: string) {
    this.categoryKey.set(key);
    this.resetSpec();
  }

  private resetSpec() {
    this.specFilter.set('all');
    this.specSearch.set('');
    this.specOpen.set(false);
  }

  onPlayerSearch(ev: Event) {
    this.playerSearch.set((ev.target as HTMLInputElement).value);
  }

  clearPlayerSearch() {
    this.playerSearch.set('');
  }

  toggleSpecMenu(ev: Event) {
    ev.stopPropagation();
    this.specOpen.set(!this.specOpen());
    if (this.specOpen()) this.specSearch.set('');
  }

  pickSpec(spec: string) {
    this.specFilter.set(spec);
    this.specOpen.set(false);
    this.specSearch.set('');
  }

  onSearch(ev: Event) {
    this.specSearch.set((ev.target as HTMLInputElement).value);
  }

  /** Fecha o menu ao clicar fora dele. */
  onDocumentClick(ev: MouseEvent) {
    if (!this.specOpen()) return;
    const menu = this.host.querySelector('.spec-picker');
    if (menu && !menu.contains(ev.target as Node)) this.specOpen.set(false);
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

  onIconError(ev: Event) {
    this.data.handleIconError(ev);
  }

  resultTooltip(p: RankingPlayer, diffKey: string): string {
    const r = p.results[diffKey];
    if (!r) return 'Sem registro nesta dificuldade';
    return `${this.fmt(r.points)} pontos em ${r.bossesKilled} boss${r.bossesKilled === 1 ? '' : 'es'}`;
  }
}
