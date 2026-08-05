import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-about',
  standalone: true,
  template: `
    <section class="card section">
      <h1>Sobre este site</h1>
      <div class="credit-box">
        Feito com carinho por <strong>Analli</strong> - Vol'jin, pra ajudar a comunidade
        do Conquest of Azeroth a decidir specs, dungeons e gear sem precisar garimpar
        planilha e log um por um.
      </div>
      <p>
        Tier list não oficial das classes e specs do
        <strong>Conquest of Azeroth</strong> (Ascension WoW), gerada a partir de dados públicos
        da comunidade:
      </p>
      <ul>
        <li>
          <a href="https://coa.ascensionlogs.gg" target="_blank" rel="noopener">coa.ascensionlogs.gg</a>
          — logs de combate enviados pelos jogadores (raids, dungeons e world bosses).
          Os tiers são calculados a partir da média (ou p95) de DPS/HPS de cada spec
          em relação à melhor spec do filtro selecionado.
        </li>
        <li>
          <a href="https://coa.bisbeard.com" target="_blank" rel="noopener">coa.bisbeard.com</a>
          — pesos de atributos (stat weights) de cada spec e banco de itens usados para
          calcular o BIS gear.
        </li>
        <li>
          <a href="https://db.ascension.gg" target="_blank" rel="noopener">db.ascension.gg</a>
          — banco de dados oficial do Ascension (ícones e links dos itens).
        </li>
      </ul>
      <h2>Como os tiers são calculados</h2>
      <p>
        Para cada combinação de conteúdo, dificuldade e função, a pontuação da spec é a
        <strong>média</strong> de todos os parses registrados (ou o <strong>percentil 95</strong>
        no modo "Topo"). A pontuação é normalizada pela melhor spec:
        S ≥ 85%, A ≥ 68%, B ≥ 50%, C ≥ 32%, D &lt; 32%.
        Specs com menos de 5 parses são marcadas com ⚠ (amostra pequena).
      </p>
      <h2>Como o BIS e os encantamentos são calculados</h2>
      <p>
        Cada item (e cada encantamento) recebe uma pontuação somando seus atributos
        multiplicados pelos pesos oficiais da spec no BisBeard (incluindo DPS da arma),
        respeitando as permissões de armadura e arma de cada classe. Itens de PvP são
        excluídos. O resultado é o top de itens da Fase 1 por slot, mais o encantamento
        de maior pontuação pra cada slot que aceita encantamento. Passe o mouse sobre
        qualquer item pra ver o tooltip completo, como no jogo.
      </p>
      <p class="disclaimer">
        Este é um projeto de fã, sem afiliação com o Ascension. Os dados refletem o momento
        da última extração e podem ficar desatualizados.
      </p>
    </section>
  `,
  styles: `
    :host { display: block; padding-bottom: 40px; }
    .section { margin-top: 4px; padding: 22px 24px; }
    h1 { margin: 0 0 12px; font-size: 1.4rem; color: var(--accent-soft); }
    h2 { margin: 18px 0 8px; font-size: 1.05rem; color: var(--accent-soft); }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    .disclaimer { color: var(--text-dim); font-size: 0.85rem; margin-top: 18px; }
    .credit-box {
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border: 1px solid var(--accent);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      font-size: 0.92rem;
      color: var(--text);
    }
    .credit-box strong { color: var(--accent); }
  `,
})
export class AboutComponent {
  constructor(title: Title) {
    title.setTitle('Sobre — CoA Meta - Tier List');
  }
}
