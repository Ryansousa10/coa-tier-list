import { AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';

/**
 * Posiciona o indicador deslizante de um segmented control medindo o botão
 * ativo, em vez de assumir que todos têm a mesma largura.
 *
 * Isso deixa cada botão ocupar a largura natural do texto — sem "Raid — Zul…"
 * cortado — e ainda funciona quando os botões quebram em mais de uma linha,
 * porque medimos também topo e altura.
 *
 * Uso: <div class="segmented" coaSegmented [activeIndex]="i"> …
 */
@Directive({
  selector: '[coaSegmented]',
  standalone: true,
})
export class SegmentedDirective implements AfterViewInit, OnChanges, OnDestroy {
  /** Índice do item selecionado. Re-mede sempre que muda. */
  @Input({ required: true }) activeIndex = 0;

  private host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private ro?: ResizeObserver;
  private mo?: MutationObserver;
  private ready = false;
  private pending?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.ready = true;
    this.measure();
    // largura muda com resize da janela e quando a fonte termina de carregar
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.host);
    for (const seg of this.segs()) this.ro.observe(seg);
    // a lista de opções muda conforme o conteúdo (ex.: 4 dificuldades -> 2)
    this.mo = new MutationObserver(() => {
      for (const seg of this.segs()) this.ro?.observe(seg);
      this.measure();
    });
    this.mo.observe(this.host, { childList: true });
  }

  ngOnChanges(): void {
    if (!this.ready) return;
    // mede já, pra reagir no mesmo instante do clique...
    this.measure();
    // ...e confere de novo depois que o Angular terminou de aplicar as classes
    // e o layout assentou, cobrindo qualquer reflow que tenha vindo junto.
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.measure());
  }

  ngOnDestroy(): void {
    clearTimeout(this.pending);
    this.ro?.disconnect();
    this.mo?.disconnect();
  }

  private segs(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>('.seg'));
  }

  private measure(): void {
    const active = this.segs()[this.activeIndex];
    if (!active) return;
    // offsetLeft/offsetTop já são relativos ao .segmented (que é position: relative)
    this.host.style.setProperty('--thumb-x', `${active.offsetLeft}px`);
    this.host.style.setProperty('--thumb-y', `${active.offsetTop}px`);
    this.host.style.setProperty('--thumb-w', `${active.offsetWidth}px`);
    this.host.style.setProperty('--thumb-h', `${active.offsetHeight}px`);
  }
}
