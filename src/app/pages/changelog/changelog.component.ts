import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CHANGELOG } from './changelog.data';

@Component({
  selector: 'app-changelog',
  standalone: true,
  template: `
    <section class="card section">
      <h1>Atualizações</h1>
      <p class="hint">O que mudou no site, da mais recente pra mais antiga.</p>
      <div class="timeline">
        @for (entry of entries; track entry.date + entry.title) {
          <div class="entry">
            <div class="entry-date">{{ formatDate(entry.date) }}</div>
            <div class="entry-body">
              <h2>{{ entry.title }}</h2>
              <ul>
                @for (item of entry.items; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; padding-bottom: 40px; }
    .section { margin-top: 4px; padding: 22px 24px; }
    h1 { margin: 0 0 4px; font-size: 1.4rem; color: var(--accent-soft); }
    .hint { margin: 0 0 20px; color: var(--text-dim); font-size: 0.88rem; }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .entry {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 16px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--border);
    }
    .entry:last-child { border-bottom: none; padding-bottom: 0; }

    .entry-date {
      color: var(--text-dim);
      font-size: 0.82rem;
      font-weight: 600;
      padding-top: 2px;
      white-space: nowrap;
    }

    .entry-body h2 {
      margin: 0 0 8px;
      font-size: 1.05rem;
      color: var(--accent);
    }

    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 6px; line-height: 1.5; }

    @media (max-width: 560px) {
      .entry { grid-template-columns: 1fr; gap: 4px; }
    }
  `,
})
export class ChangelogComponent {
  entries = CHANGELOG;

  constructor(title: Title) {
    title.setTitle('Atualizações — CoA Meta - Tier List');
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}
