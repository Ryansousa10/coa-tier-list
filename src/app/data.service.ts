import { Injectable } from '@angular/core';
import { BisFile, BossStatsFile, ClassInfo, RankingsFile, StatsFile, TankFocusFile } from './models';

const SOURCE_LABELS: Record<string, string> = {
  raid: 'Raid', dungeon: 'Dungeon', worldboss: 'World Boss', worldforged: 'Worldforged',
  worldboe: 'BoE de mundo', crafting: 'Profissão', reputation: 'Reputação', quests: 'Missão',
  vendor: 'Vendedor', events: 'Evento', affixed: 'Item com afixo', enchants: 'Encantamento',
};

@Injectable({ providedIn: 'root' })
export class DataService {
  private classesPromise?: Promise<ClassInfo[]>;
  private statsPromise?: Promise<StatsFile>;
  private tankFocusPromise?: Promise<TankFocusFile | null>;
  private rankingsPromise?: Promise<RankingsFile | null>;
  private bisCache = new Map<string, Promise<BisFile | null>>();
  private bossStatsCache = new Map<string, Promise<BossStatsFile | null>>();

  loadClasses(): Promise<ClassInfo[]> {
    this.classesPromise ??= fetch('data/classes.json').then(r => r.json());
    return this.classesPromise;
  }

  loadStats(): Promise<StatsFile> {
    this.statsPromise ??= fetch('data/stats.json').then(r => r.json());
    return this.statsPromise;
  }

  loadTankFocus(): Promise<TankFocusFile | null> {
    this.tankFocusPromise ??= fetch('data/tank-focus.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
    return this.tankFocusPromise;
  }

  /** Só a tela de Rankings carrega — é o maior arquivo de dados do site. */
  loadRankings(): Promise<RankingsFile | null> {
    this.rankingsPromise ??= fetch('data/rankings.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
    return this.rankingsPromise;
  }

  /** Link pro perfil do jogador no AscensionLogs. */
  playerUrl(name: string, location: string, phase: number, difficulty: string): string {
    const q = new URLSearchParams({ phase: String(phase), location, difficulty });
    return `https://coa.ascensionlogs.gg/characters/${encodeURIComponent(name)}?${q}`;
  }

  loadBis(classKey: string, specKey: string): Promise<BisFile | null> {
    const file = `${classKey}-${specKey}`;
    if (!this.bisCache.has(file)) {
      this.bisCache.set(
        file,
        fetch(`data/bis/${file}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      );
    }
    return this.bisCache.get(file)!;
  }

  loadBossStats(classKey: string, specKey: string): Promise<BossStatsFile | null> {
    const file = `${classKey}-${specKey}`;
    if (!this.bossStatsCache.has(file)) {
      this.bossStatsCache.set(
        file,
        fetch(`data/boss-stats/${file}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      );
    }
    return this.bossStatsCache.get(file)!;
  }

  /** Ícone servido localmente (baixado no build por tools/download-icons.mjs) */
  iconUrl(icon: string | null): string | null {
    if (!icon) return null;
    return `icons/${icon}.jpg`;
  }

  /**
   * Fallback de ícone: tenta o banco de dados do Ascension uma vez;
   * se falhar de novo, esconde a imagem.
   */
  handleIconError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    const name = img.src.split('/').pop();
    if (!img.dataset['fb'] && name) {
      img.dataset['fb'] = '1';
      img.src = `https://db.ascension.gg/static/images/wow/icons/large/${name}`;
    } else {
      img.style.display = 'none';
    }
  }

  itemUrl(id: string): string {
    return `https://db.ascension.gg/?item=${id}`;
  }

  /**
   * Os encantamentos não têm um ID de item/spell válido no Ascension DB
   * (é um ID interno do BisBeard), então em vez de um link quebrado
   * levamos o jogador pra busca por nome no banco de dados oficial.
   */
  searchUrl(name: string): string {
    return `https://db.ascension.gg/?search=${encodeURIComponent(name)}`;
  }

  sourceLabel(item: { sourceCategory: string; source: string; version?: string }): string {
    const cat = SOURCE_LABELS[item.sourceCategory] ?? item.sourceCategory;
    const parts = [cat];
    if (item.source && item.source !== 'Unknown') parts.push(item.source);
    if (item.version && item.version !== 'Unknown' && item.version !== item.source) parts.push(item.version);
    return parts.join(' · ');
  }
}
