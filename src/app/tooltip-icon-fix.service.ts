import { Injectable } from '@angular/core';
import { DataService } from './data.service';

/**
 * O tooltip oficial do Ascension DB (power.js) às vezes mostra o ícone errado
 * porque o banco de dados deles tem alguns ícones incorretos (ex.: "Embrace
 * of the Lycan" vira uma calça lá). Como já sabemos o ícone certo — vem do
 * BisBeard, o mesmo que usamos no resto do site — sobrescrevemos o ícone do
 * tooltip assim que ele é criado/atualizado pelo widget.
 */
@Injectable({ providedIn: 'root' })
export class TooltipIconFixService {
  private pendingIcon: string | null = null;
  private observer: MutationObserver | null = null;

  constructor(private data: DataService) {
    if (typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver(() => this.patch());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  }

  /** Chamar ao passar o mouse num item, com o ícone correto que já temos */
  prepare(icon: string | null): void {
    this.pendingIcon = icon;
  }

  private patch(): void {
    if (!this.pendingIcon) return;
    const iconEl = document.querySelector<HTMLElement>('.wowhead-tooltip p[style*="background-image"]');
    if (!iconEl) return;
    const url = this.data.iconUrl(this.pendingIcon);
    if (url) iconEl.style.backgroundImage = `url("${url}")`;
  }
}
