import { Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';

/**
 * Tooltip própria, no lugar do atributo `title` nativo — que demora ~1s pra
 * abrir, não quebra linha, não estiliza e some no mobile. Aqui o texto abre
 * na hora, com largura confortável de leitura e seta apontando pro elemento.
 *
 * Uso: <button coaTooltip="texto explicativo">…</button>
 *
 * O balão é anexado ao <body> (não ao elemento) pra nunca ser cortado por
 * `overflow: hidden` de um card ou tabela ancestral.
 */
@Directive({
  selector: '[coaTooltip]',
  standalone: true,
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
    '(click)': 'hide()',
  },
})
export class TooltipDirective implements OnDestroy {
  /** Texto do tooltip. Vazio/nulo desliga o tooltip. */
  @Input('coaTooltip') text: string | null = '';

  private host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private tip?: HTMLElement;
  private static seq = 0;

  show(): void {
    const text = (this.text ?? '').trim();
    if (!text || this.tip) return;

    const tip = document.createElement('div');
    tip.className = 'coa-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.id = `coa-tip-${TooltipDirective.seq++}`;
    tip.textContent = text;
    document.body.appendChild(tip);
    this.tip = tip;
    this.host.setAttribute('aria-describedby', tip.id);

    this.position();
    // Força um reflow antes de ligar a classe: garante que o browser registre
    // o estado inicial e a transição rode. Não usamos requestAnimationFrame
    // porque ele não dispara em aba sem renderização, o que deixaria o balão
    // presos em opacity 0.
    void tip.offsetWidth;
    tip.classList.add('is-visible');
  }

  hide(): void {
    this.tip?.remove();
    this.tip = undefined;
    this.host.removeAttribute('aria-describedby');
  }

  ngOnDestroy(): void {
    this.hide();
  }

  /** Prefere abrir acima; cai pra baixo se não couber, e nunca vaza nas laterais. */
  private position(): void {
    const tip = this.tip;
    if (!tip) return;
    const gap = 10;
    const margin = 8;
    const anchor = this.host.getBoundingClientRect();
    const box = tip.getBoundingClientRect();

    const fitsAbove = anchor.top - box.height - gap >= margin;
    const top = fitsAbove ? anchor.top - box.height - gap : anchor.bottom + gap;
    tip.classList.add(fitsAbove ? 'is-above' : 'is-below');

    const ideal = anchor.left + anchor.width / 2 - box.width / 2;
    const left = Math.max(margin, Math.min(ideal, window.innerWidth - box.width - margin));

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    // a seta acompanha o elemento mesmo quando o balão foi empurrado pro lado
    tip.style.setProperty('--arrow-x', `${anchor.left + anchor.width / 2 - left}px`);
  }
}
