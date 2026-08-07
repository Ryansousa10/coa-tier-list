// Extrai os rankings de jogadores do coa.ascensionlogs.gg, usando a mesma
// métrica "Best Perf. Avg" que aparece no perfil de cada personagem no site
// oficial — em vez de reconstruir algo parecido a partir dos pontos All-Star
// agregados (tentamos, os números não batiam de forma confiável com o total
// oficial da zona — ver histórico do projeto).
//
// A fórmula, direto da FAQ deles (coa.ascensionlogs.gg/faq#what-is-a-parse):
//   - por boss: percentil = 100 × (cohort_size - seu_rank) / cohort_size
//     (rank 1 = 100, cohort é todo mundo que matou aquele boss naquela
//     dificuldade/bracket/fase — cross-class, não por spec)
//   - "Best %"/"Best Perf. Avg": média desses percentis pelos bosses que a
//     pessoa matou. Só sobe (fica no pico historico), nunca cai.
// Verificado batendo 78.11 (calculado) com 78.1 (mostrado no perfil real).
//
// Detalhes da API descobertos testando:
//   - `/api/encounters/rankings/overall` (lote, por conteúdo/dificuldade) NÃO
//     tem o percentil — só points/bosses_killed agregados. Usamos só pra
//     descobrir QUEM são os candidatos (é barato, uma chamada por dificuldade).
//   - `/api/characters/<nome>/boss-rows` (por personagem) tem o percentil
//     boss a boss (`best_rank_dps_percentile` / `best_rank_hps_percentile`).
//     Funciona sem `realm` (◦ risco pequeno de ambiguidade se o nome existir
//     em mais de um reino — aceitável, não temos o reino no lote).
//   - Cohort pequeno demais (<2) deixa o percentil null — filtrado antes de
//     tirar a média.
//   - SEM `cohort=global` no lote, `spec` vem preenchida; em "All Dungeons"
//     + `role`, `spec` some mesmo assim — contorno: consulta spec a spec.
//   - `role=healer` dá 400: healer é `metric=avg_hps` SEM role.
//
// Como isso é 1 chamada extra por candidato por dificuldade (~1900 no total
// pras 8 combinações de conteúdo+categoria), o roster que recebe esse detalhe
// é um recorte (melhores no geral + melhores de cada spec pelo critério
// barato do lote), não o site inteiro — ver TOP_OVERALL/TOP_PER_SPEC.
//
// Gera: tools/data/raw/rankings-raw.json
//
// Uso: node tools/scrape/rankings.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'data', 'raw');
fs.mkdirSync(RAW, { recursive: true });

const BASE = 'https://coa.ascensionlogs.gg';

/** Recorte do roster: melhores no geral + melhores de cada spec (critério barato, pré-detalhe). */
const TOP_OVERALL = 150;
const TOP_PER_SPEC = 8;

const CATEGORIES = [
  { key: 'dps', label: 'DPS', metric: 'avg_dps', role: 'dps', specSource: 'dps', percentileField: 'best_rank_dps_percentile' },
  { key: 'tank', label: 'Tank', metric: 'avg_dps', role: 'tank', specSource: 'tankSpecs', percentileField: 'best_rank_dps_percentile' },
  { key: 'healer', label: 'Healer', metric: 'avg_hps', role: null, specSource: 'healerSpecs', percentileField: 'best_rank_hps_percentile' },
  { key: 'support', label: 'Support', metric: 'avg_dps', role: 'support', specSource: 'supportSpecs', percentileField: 'best_rank_dps_percentile' },
];

const SCOPES = [
  {
    key: 'raid-zg',
    label: "Zul'Gurub",
    location: "Zul'Gurub",
    phase: 1,
    difficulties: ['ascended', 'mythic', 'heroic', 'normal'],
  },
  {
    key: 'dungeons-mythic',
    label: 'Dungeons (Mythic)',
    location: 'All Dungeons',
    phase: 1,
    difficulties: ['mythic'],
  },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  console.log('[rankings] abrindo o site...');
  await page.goto(`${BASE}/rankings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  console.log('[rankings] class-specs (pra saber as specs de cada categoria)...');
  const classSpecs = await page.evaluate(async () => {
    const d = await fetch('/api/creatures/class-specs').then(r => r.json());
    return d.classSpecs;
  });

  // specs por categoria — usadas só no contorno de quando a API devolve spec null
  const specsByCategory = { dps: [], tankSpecs: [], healerSpecs: [], supportSpecs: [] };
  for (const info of Object.values(classSpecs)) {
    for (const s of info.specs) if (!/ DPS$/.test(s)) specsByCategory.dps.push(s);
    for (const s of info.tankSpecs || []) specsByCategory.tankSpecs.push(s);
    for (const s of info.healerSpecs || []) specsByCategory.healerSpecs.push(s);
    for (const s of info.supportSpecs || []) specsByCategory.supportSpecs.push(s);
  }

  // A fase 2 (detalhe por boss) faz ~1900 chamadas no total, sequenciais, numa
  // sessão de página bem mais longa que qualquer outro scraper do projeto.
  // Confirmado ao vivo: a API devolve HTTP 429 depois de um volume alto de
  // chamadas seguidas (viu-se explicitamente no log, algo que as tentativas
  // anteriores escondiam por engolir erro em silêncio). Por isso:
  //   - `window.__fetchRetry` (injetado uma vez via addInitScript, disponível
  //     em toda chamada de fetch das duas fases) trata 429 com espera —
  //     respeitando o header Retry-After quando existe, backoff exponencial
  //     quando não — em vez de estourar a chamada inteira.
  //   - Um espaço base pequeno antes de CADA chamada individual (não só
  //     entre candidatos), pra reduzir a chance de bater o limite de novo em
  //     vez de só reagir depois que já bateu.
  const DETAIL_DELAY_MS = 120;
  const BULK_DELAY_MS = 150;

  // addInitScript só vale pra navegações FUTURAS — como a página já carregou
  // (page.goto acima) e não navega de novo, um evaluate() normal é o jeito
  // certo de definir isso no documento atual (e persiste pro resto da sessão,
  // já que não há mais nenhuma navegação depois desse ponto).
  await page.evaluate(() => {
    // @ts-ignore — roda no contexto da página, não no Node
    window.__fetchRetry = async (url, baseDelayMs) => {
      if (baseDelayMs) await new Promise((res) => setTimeout(res, baseDelayMs));
      let wait = 5000;
      for (let attempt = 0; attempt < 6; attempt++) {
        const r = await fetch(url);
        if (r.status === 429) {
          const retryAfter = Number(r.headers.get('retry-after'));
          await new Promise((res) => setTimeout(res, retryAfter > 0 ? retryAfter * 1000 : wait));
          wait = Math.min(wait * 1.7, 30000);
          continue;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
        return r.json();
      }
      throw new Error(`HTTP 429 esgotou tentativas em ${url}`);
    };
  });

  async function fetchBulk(page, scope, cat, specList) {
    return page.evaluate(async ({ scope, cat, specList, delayMs }) => {
      const fetchRows = async (extra) => {
        let q = `location=${encodeURIComponent(scope.location)}&difficulty=${extra.diff}`
          + `&phase=${scope.phase}&metric=${cat.metric}&page=1&limit=3000`;
        if (cat.role) q += `&role=${cat.role}`;
        if (extra.spec) q += `&spec=${encodeURIComponent(extra.spec)}`;
        const j = await window.__fetchRetry('/api/encounters/rankings/overall?' + q, delayMs);
        return j?.rankings?.[scope.location]?.[extra.diff] ?? [];
      };

      const result = {};
      for (const diff of scope.difficulties) {
        let rows = await fetchRows({ diff });
        // Em algumas combinações (dungeons + role) a API devolve tudo com
        // spec null. Sem spec não dá pra montar ranking por spec, então
        // refazemos consultando spec a spec, que aí vem preenchido.
        if (rows.length > 0 && rows.every(r => !r.spec)) {
          const merged = [];
          for (const spec of specList) {
            const sub = await fetchRows({ diff, spec });
            for (const r of sub) merged.push({ ...r, spec: r.spec || spec });
          }
          merged.sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
          rows = merged;
        }
        result[diff] = rows;
      }
      return result;
    }, { scope, cat, specList, delayMs: BULK_DELAY_MS });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const out = {};
  for (const scope of SCOPES) {
    console.log(`[rankings] ${scope.label}...`);
    out[scope.key] = {};

    for (const cat of CATEGORIES) {
      // ---- fase 1: lote (barato) — só pra descobrir os candidatos.
      // Se vier tudo vazio (uma categoria real nunca tem 0 linhas em toda
      // dificuldade), espera um pouco e tenta de novo antes de desistir —
      // provavelmente é um bloqueio temporário, não ausência real de dados.
      let perDifficulty = await fetchBulk(page, scope, cat, specsByCategory[cat.specSource]);
      if (Object.values(perDifficulty).every((rows) => rows.length === 0)) {
        console.warn(`  !! ${cat.label}: lote veio vazio em todas as dificuldades — esperando 20s e tentando de novo...`);
        await sleep(20000);
        perDifficulty = await fetchBulk(page, scope, cat, specsByCategory[cat.specSource]);
        if (Object.values(perDifficulty).every((rows) => rows.length === 0)) {
          console.error(`  !! ${cat.label}: continuou vazio depois do retry — pulando essa categoria.`);
        }
      }

      // junta as dificuldades por (jogador, spec) — só com o que o lote dá
      const byKey = new Map();
      for (const diff of scope.difficulties) {
        for (const row of perDifficulty[diff] || []) {
          if (!row?.spec || row.character_id == null) continue;
          if (!(row.total_points > 0)) continue;
          const key = `${row.character_id}|${row.spec}`;
          if (!byKey.has(key)) {
            byKey.set(key, {
              characterId: row.character_id,
              name: row.name,
              className: row.class,
              spec: row.spec,
              totalBosses: row.total_bosses ?? null,
              lotePoints: 0,
            });
          }
          byKey.get(key).lotePoints += row.total_points;
        }
      }

      // recorte barato: melhores no geral + melhores de cada spec, só pra
      // decidir quem vale a pena buscar o detalhe (caro) a seguir
      const all = [...byKey.values()].sort((a, b) => b.lotePoints - a.lotePoints);
      const keep = new Set(all.slice(0, TOP_OVERALL));
      const perSpec = {};
      for (const e of all) {
        perSpec[e.spec] = (perSpec[e.spec] || 0) + 1;
        if (perSpec[e.spec] <= TOP_PER_SPEC) keep.add(e);
      }
      const shortlist = all.filter(e => keep.has(e));

      // ---- fase 2: detalhe por boss de cada candidato (Best Perf. Avg de
      // verdade) — uma chamada de cada vez (não em lote dentro do
      // evaluate), passando por window.__fetchRetry (trata 429 sozinho) e
      // com contagem real de falha, pra não repetir o silêncio que escondeu
      // o bloqueio da vez passada.
      const detailed = [];
      let failures = 0;
      for (const cand of shortlist) {
        const results = await page.evaluate(async ({ cand, scope, percentileField, delayMs }) => {
          const results = {};
          for (const diff of scope.difficulties) {
            const q = `phase=${scope.phase}&difficulty=${diff}&bracket=all&metric=avg_dps`
              + `&location=${encodeURIComponent(scope.location)}`;
            try {
              const j = await window.__fetchRetry(`/api/characters/${encodeURIComponent(cand.name)}/boss-rows?${q}`, delayMs);
              const rows = (j.rows || []).filter(row => row[percentileField] != null);
              if (rows.length > 0) {
                const sum = rows.reduce((acc, row) => acc + row[percentileField], 0);
                results[diff] = { avg: sum / rows.length, bossesKilled: rows.length };
              }
            } catch (err) {
              results[diff] = { error: String(err) };
            }
          }
          return results;
        }, { cand, scope, percentileField: cat.percentileField, delayMs: DETAIL_DELAY_MS });

        const ok = {};
        let hadError = false;
        for (const [diff, r] of Object.entries(results)) {
          if (r.error) hadError = true;
          else ok[diff] = r;
        }
        if (hadError) failures++;
        if (Object.keys(ok).length > 0) {
          detailed.push({
            characterId: cand.characterId, name: cand.name, className: cand.className,
            spec: cand.spec, totalBosses: cand.totalBosses, results: ok,
          });
        }
      }

      out[scope.key][cat.key] = {
        totals: Object.fromEntries(scope.difficulties.map(d => [d, (perDifficulty[d] || []).length])),
        entries: detailed,
      };
      const failNote = failures > 0 ? ` (${failures} candidatos com alguma falha HTTP)` : '';
      console.log(`  -> ${cat.label}: ${detailed.length}/${shortlist.length} candidatos com detalhe${failNote} (lote: ${JSON.stringify(out[scope.key][cat.key].totals)})`);
    }
  }

  fs.writeFileSync(path.join(RAW, 'rankings-raw.json'), JSON.stringify({
    extractedAt: new Date().toISOString(),
    // location/phase seguem pro build porque o site monta com eles o link do
    // perfil do jogador no AscensionLogs
    scopes: SCOPES.map(s => ({
      key: s.key, label: s.label, difficulties: s.difficulties,
      location: s.location, phase: s.phase,
    })),
    categories: CATEGORIES.map(c => ({ key: c.key, label: c.label })),
    data: out,
  }));

  await browser.close();
  console.log('[rankings] concluído.');
}

main().catch(e => {
  console.error('[rankings] ERRO:', e);
  process.exit(1);
});
