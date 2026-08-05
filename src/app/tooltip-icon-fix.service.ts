import { Injectable } from '@angular/core';

/**
 * O ícone que o tooltip oficial do Ascension DB (power.js) mostra vem direto
 * do banco de dados deles, que tem alguns ícones incorretos (ex.: "Embrace
 * of the Lycan" vira uma calça lá). O ícone é posicionado com
 * `position: absolute` fora da caixa do tooltip, então escondê-lo não deixa
 * espaço vazio — assim ficamos só com o ícone correto que já aparece no
 * resto do site, ao lado do item.
 */
@Injectable({ providedIn: 'root' })
export class TooltipIconFixService {
  private observer: MutationObserver | null = null;

  constructor() {
    if (typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver(() => this.hideIcon());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  }

  private hideIcon(): void {
    const iconEl = document.querySelector<HTMLElement>('.wowhead-tooltip p[style*="background-image"]');
    if (iconEl && iconEl.style.display !== 'none') {
      iconEl.style.display = 'none';
    }
  }
}
