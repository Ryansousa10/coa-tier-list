import { Injectable } from '@angular/core';
import { BisFile, ClassInfo, StatsFile } from './models';

@Injectable({ providedIn: 'root' })
export class DataService {
  private classesPromise?: Promise<ClassInfo[]>;
  private statsPromise?: Promise<StatsFile>;
  private bisCache = new Map<string, Promise<BisFile | null>>();

  loadClasses(): Promise<ClassInfo[]> {
    this.classesPromise ??= fetch('data/classes.json').then(r => r.json());
    return this.classesPromise;
  }

  loadStats(): Promise<StatsFile> {
    this.statsPromise ??= fetch('data/stats.json').then(r => r.json());
    return this.statsPromise;
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
}
