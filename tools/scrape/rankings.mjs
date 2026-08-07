// Extrai os rankings de jogadores ("All Stars") do coa.ascensionlogs.gg.
//
// A API é /api/encounters/rankings/overall. Detalhes descobertos testando:
//   - SEM `cohort=global` cada linha vem com a `spec` preenchida; COM ele a
//     spec vem null (é o modo agregado por jogador). Queremos por spec.
//   - `role=healer` dá 400 (mesma armadilha do /api/statistics): healer é
//     `metric=avg_hps` SEM role.
//   - `limit` não tem teto prático (limit=3000 devolveu 3000 de 3026).
//   - Em "All Dungeons", as consultas filtradas por `role` devolvem
//     `spec: null` (só em Zul'Gurub a spec vem preenchida). O contorno é
//     consultar spec a spec com `spec=<nome>`, que aí vem certo. O código
//     detecta o caso sozinho em vez de cravar quais combinações falham.
//   - `total_points` é a SOMA do all-star score de cada boss (0-100 por
//     boss), não uma média — quem matou 1 boss fica com ~100 e quem matou 10
//     fica com ~1000. Por isso guardamos também bosses_killed: a pontuação
//     comparável é points/bossesKilled (o percentil médio).
//
// Como Zul'Gurub Normal sozinho tem +3000 entradas, o recorte acontece aqui
// pra não inchar o repositório a cada atualização: guardamos os melhores no
// geral mais os melhores de cada spec (pra spec pouco jogada não sumir).
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

/** Recorte do roster: melhores no geral + melhores de cada spec. */
const TOP_OVERALL = 150;
const TOP_PER_SPEC = 8;

const CATEGORIES = [
  { key: 'dps', label: 'DPS', metric: 'avg_dps', role: 'dps', specSource: 'dps' },
  { key: 'tank', label: 'Tank', metric: 'avg_dps', role: 'tank', specSource: 'tankSpecs' },
  { key: 'healer', label: 'Healer', metric: 'avg_hps', role: null, specSource: 'healerSpecs' },
  { key: 'support', label: 'Support', metric: 'avg_dps', role: 'support', specSource: 'supportSpecs' },
];

// `scoreKind` decide como o roster é recortado, e precisa bater com o critério
// que o build-data usa pra ranquear — senão cortamos justamente quem deveria
// estar no topo. Em Zul'Gurub o score é pontos/bosses (all-star médio, 0-100);
// em dungeons são os pontos totais, que premiam cobertura (ver build-data.mjs).
const SCOPES = [
  {
    key: 'raid-zg',
    label: "Zul'Gurub",
    location: "Zul'Gurub",
    phase: 1,
    difficulties: ['ascended', 'mythic', 'heroic', 'normal'],
    scoreKind: 'avg',
  },
  {
    key: 'dungeons-mythic',
    label: 'Dungeons (Mythic)',
    location: 'All Dungeons',
    phase: 1,
    difficulties: ['mythic'],
    scoreKind: 'points',
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

  const out = {};
  for (const scope of SCOPES) {
    console.log(`[rankings] ${scope.label}...`);
    out[scope.key] = {};

    for (const cat of CATEGORIES) {
      const perDifficulty = await page.evaluate(async ({ scope, cat, specList }) => {
        const fetchRows = async (extra) => {
          let q = `location=${encodeURIComponent(scope.location)}&difficulty=${extra.diff}`
            + `&phase=${scope.phase}&metric=${cat.metric}&page=1&limit=3000`;
          if (cat.role) q += `&role=${cat.role}`;
          if (extra.spec) q += `&spec=${encodeURIComponent(extra.spec)}`;
          try {
            const j = await fetch('/api/encounters/rankings/overall?' + q).then(r => r.json());
            return j?.rankings?.[scope.location]?.[extra.diff] ?? [];
          } catch (e) {
            return [];
          }
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
      }, { scope, cat, specList: specsByCategory[cat.specSource] });

      // ---- junta as dificuldades por (jogador, spec)
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
              results: {},
            });
          }
          byKey.get(key).results[diff] = {
            points: row.total_points,
            bossesKilled: row.bosses_killed ?? null,
          };
        }
      }

      // ---- ordena pelo mesmo critério que o build-data vai usar
      const all = [...byKey.values()];
      const scoreOf = (e) => {
        let points = 0, kills = 0;
        for (const r of Object.values(e.results)) {
          points += r.points;
          kills += r.bossesKilled || 0;
        }
        if (scope.scoreKind === 'points') return points;
        return kills > 0 ? points / kills : 0;
      };
      all.sort((a, b) => scoreOf(b) - scoreOf(a));

      // ---- recorte: melhores no geral + melhores de cada spec
      const keep = new Set(all.slice(0, TOP_OVERALL));
      const perSpec = {};
      for (const e of all) {
        perSpec[e.spec] = (perSpec[e.spec] || 0) + 1;
        if (perSpec[e.spec] <= TOP_PER_SPEC) keep.add(e);
      }
      const entries = all.filter(e => keep.has(e));

      out[scope.key][cat.key] = {
        totals: Object.fromEntries(scope.difficulties.map(d => [d, (perDifficulty[d] || []).length])),
        entries,
      };
      console.log(`  -> ${cat.label}: ${entries.length} no roster (de ${all.length} jogadores, brutos ${JSON.stringify(out[scope.key][cat.key].totals)})`);
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
