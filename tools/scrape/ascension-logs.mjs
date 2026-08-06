// Extrai dados de coa.ascensionlogs.gg via navegador headless (Playwright),
// já que a API deles fica atrás de Cloudflare e bloqueia clientes HTTP simples
// (curl/fetch de servidor) — só funciona executando fetch() de dentro do
// próprio domínio, com um navegador de verdade.
//
// Gera:
//   tools/data/raw/ascensionlogs-data.json   (classSpecs, phases, stats base)
//   tools/data/raw/ascensionlogs-data2.json  (stats com variantes de damageMode)
//   tools/data/raw/boss-stats-raw.json       (desempenho por boss individual)
//   tools/data/raw/zg-bosses-meta.json       (lista de bosses de Zul'Gurub)
//
// Uso: node tools/scrape/ascension-logs.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'data', 'raw');
fs.mkdirSync(RAW, { recursive: true });

const BASE = 'https://coa.ascensionlogs.gg';

function buildCombos() {
  const combos = [];
  for (const diff of ['ascended', 'mythic', 'heroic', 'normal']) {
    for (const role of ['dps', 'tank', 'support']) {
      combos.push({ key: `raid-zg-${diff}-${role}`, loc: "Zul'Gurub", diff, role, metric: 'avg_dps' });
    }
    combos.push({ key: `raid-zg-${diff}-healer`, loc: "Zul'Gurub", diff, role: null, metric: 'avg_hps' });
  }
  for (const ph of [1, 0]) {
    for (const diff of ['normal', 'mythic']) {
      for (const role of ['dps', 'tank', 'support']) {
        combos.push({ key: `dungeons-p${ph}-${diff}-${role}`, loc: 'All Dungeons', diff, role, metric: 'avg_dps', ph });
      }
      combos.push({ key: `dungeons-p${ph}-${diff}-healer`, loc: 'All Dungeons', diff, role: null, metric: 'avg_hps', ph });
    }
    for (const role of ['dps', 'tank', 'support']) {
      combos.push({ key: `worldboss-p${ph}-${role}`, loc: 'World Bosses', diff: 'normal', role, metric: 'avg_dps', ph });
    }
    combos.push({ key: `worldboss-p${ph}-healer`, loc: 'World Bosses', diff: 'normal', role: null, metric: 'avg_hps', ph });
  }
  return combos;
}

// Dano recebido pelos tanks (DTPS) — usado no filtro "Sobrevivência" da tier
// list. Não passa pelas variantes de damageMode (single/AoE): é uma métrica
// só, sem essa dimensão extra.
function buildDtpsCombos() {
  const combos = [];
  for (const diff of ['ascended', 'mythic', 'heroic', 'normal']) {
    combos.push({ key: `raid-zg-${diff}-dtps`, loc: "Zul'Gurub", diff, metric: 'avg_dtps' });
  }
  for (const ph of [1, 0]) {
    for (const diff of ['normal', 'mythic']) {
      combos.push({ key: `dungeons-p${ph}-${diff}-dtps`, loc: 'All Dungeons', diff, metric: 'avg_dtps', ph });
    }
    combos.push({ key: `worldboss-p${ph}-dtps`, loc: 'World Bosses', diff: 'normal', metric: 'avg_dtps', ph });
  }
  return combos;
}

const ZG_BOSS_IDS = [1001, 1002, 1003, 1004, 1009, 1010, 1011, 1012, 1005, 1013, 1006, 1007, 1008];
const RAID_DIFFICULTIES = ['normal', 'heroic', 'mythic', 'ascended'];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  console.log('[ascension-logs] abrindo statistics...');
  await page.goto(`${BASE}/statistics`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  // -------------------------------------------------- classSpecs, phases
  console.log('[ascension-logs] class-specs + phases...');
  const { classSpecs, phases } = await page.evaluate(async () => {
    const cs = await fetch('/api/creatures/class-specs').then(r => r.json());
    const ph = await fetch('/api/phases').then(r => r.json());
    return { classSpecs: cs.classSpecs, phases: ph.phases };
  });

  // ------------------------------------------------------- bosses meta
  console.log('[ascension-logs] bosses meta...');
  const bossesMeta = await page.evaluate(async () => {
    const d = await fetch('/api/creatures/bosses').then(r => r.json());
    return d.bosses["Zul'Gurub"];
  });
  bossesMeta.sort((a, b) => a.display_order - b.display_order);
  fs.writeFileSync(path.join(RAW, 'zg-bosses-meta.json'), JSON.stringify(bossesMeta));
  console.log(`  -> ${bossesMeta.length} bosses`);

  // ----------------------------------------------- stats (base + perfis)
  const combos = buildCombos();
  // Não extraímos mais o perfil de AoE (damageMode=trash): a API só separa
  // dano de trash em dungeons e, mesmo lá, a amostra é pequena demais pra
  // sustentar um ranking — o filtro saiu do site em vez de mostrar dado ruim.
  const profiles = [
    { suffix: '', damageMode: null },
    { suffix: '-st', damageMode: 'boss-only' },
  ];
  console.log(`[ascension-logs] stats: ${combos.length} combos x ${profiles.length} perfis = ${combos.length * profiles.length} requisições...`);

  const statsOut = await page.evaluate(async ({ combos, profiles }) => {
    const out = {};
    for (const c of combos) {
      for (const p of profiles) {
        let q = `phase=${c.ph ?? 1}&difficulty=${c.diff}&bracket=all&metric=${c.metric}&location=${encodeURIComponent(c.loc)}`;
        if (c.role) q += `&role=${c.role}`;
        if (p.damageMode) q += `&damageMode=${p.damageMode}`;
        const key = c.key + p.suffix;
        try {
          const j = await fetch('/api/statistics?' + q).then(r => r.json());
          if (!j.success || !j.statistics) { out[key] = null; continue; }
          const classes = {};
          for (const [cls, cd] of Object.entries(j.statistics)) {
            const specs = {};
            for (const [sp, sd] of Object.entries(cd.specs || {})) {
              const pc = sd.percentiles || {};
              specs[sp] = {
                avg: sd.avg, median: sd.median, max: sd.max, min: sd.min, parses: sd.total_parses,
                p99: pc.p99, p95: pc.p95, p75: pc.p75, p50: pc.p50, p25: pc.p25, p10: pc.p10,
              };
            }
            classes[cls] = specs;
          }
          out[key] = classes;
        } catch (e) { out[key] = null; }
      }
    }
    return out;
  }, { combos, profiles });

  const withData = Object.values(statsOut).filter(Boolean).length;
  console.log(`  -> ${withData}/${Object.keys(statsOut).length} combos com dados`);

  // ---------------------------------------- dano recebido pelos tanks (DTPS)
  const dtpsCombos = buildDtpsCombos();
  console.log(`[ascension-logs] dtps: ${dtpsCombos.length} combos...`);
  const dtpsOut = await page.evaluate(async (combos) => {
    const out = {};
    for (const c of combos) {
      const q = `phase=${c.ph ?? 1}&difficulty=${c.diff}&bracket=all&metric=${c.metric}&location=${encodeURIComponent(c.loc)}&role=tank`;
      try {
        const j = await fetch('/api/statistics?' + q).then(r => r.json());
        if (!j.success || !j.statistics) { out[c.key] = null; continue; }
        const classes = {};
        for (const [cls, cd] of Object.entries(j.statistics)) {
          const specs = {};
          for (const [sp, sd] of Object.entries(cd.specs || {})) {
            const pc = sd.percentiles || {};
            specs[sp] = {
              avg: sd.avg, median: sd.median, max: sd.max, min: sd.min, parses: sd.total_parses,
              p99: pc.p99, p95: pc.p95, p75: pc.p75, p50: pc.p50, p25: pc.p25, p10: pc.p10,
            };
          }
          classes[cls] = specs;
        }
        out[c.key] = classes;
      } catch (e) { out[c.key] = null; }
    }
    return out;
  }, dtpsCombos);
  console.log(`  -> ${Object.values(dtpsOut).filter(Boolean).length}/${dtpsCombos.length} combos com dados`);
  Object.assign(statsOut, dtpsOut);

  fs.writeFileSync(path.join(RAW, 'ascensionlogs-data.json'), JSON.stringify({
    extractedAt: new Date().toISOString(),
    classSpecs,
    phases: phases.map(p => ({ phase: p.phase_number, name: p.name, active: p.is_active })),
    stats: statsOut,
  }));

  // ------------------------------------------------------- boss stats
  // IMPORTANTE: a query "healer" (metric=avg_hps SEM role=, já que role=healer
  // dá erro "Invalid role") retorna cura incidental de TODAS as specs, não só
  // das healers de verdade. Por isso ela roda PRIMEIRO e dps/tank/support
  // (que são filtradas de verdade pela API) rodam depois e sobrescrevem —
  // preservando o valor certo pra specs de dano E pras healers reais (que não
  // aparecem nas 3 queries filtradas).
  console.log(`[ascension-logs] boss-stats: ${ZG_BOSS_IDS.length} bosses x ${RAID_DIFFICULTIES.length} dificuldades...`);
  const bossStatsOut = await page.evaluate(async ({ bossIds, difficulties }) => {
    const roleQueries = [
      { role: null, metric: 'avg_hps' },
      { role: 'dps', metric: 'avg_dps' },
      { role: 'tank', metric: 'avg_dps' },
      { role: 'support', metric: 'avg_dps' },
    ];
    const out = {};
    for (const bossId of bossIds) {
      for (const diff of difficulties) {
        const key = `${bossId}-${diff}`;
        const merged = {};
        for (const rq of roleQueries) {
          try {
            let q = `phase=1&difficulty=${diff}&bracket=all&metric=${rq.metric}&location=${encodeURIComponent("Zul'Gurub")}&bossId=${bossId}`;
            if (rq.role) q += `&role=${rq.role}`;
            const j = await fetch('/api/statistics?' + q).then(r => r.json());
            if (j.success && j.statistics) {
              for (const [cls, cd] of Object.entries(j.statistics)) {
                merged[cls] ??= {};
                for (const [sp, sd] of Object.entries(cd.specs || {})) {
                  merged[cls][sp] = { avg: sd.avg, median: sd.median, parses: sd.total_parses };
                }
              }
            }
          } catch (e) { /* ignora */ }
        }
        out[key] = Object.keys(merged).length > 0 ? merged : null;
      }
    }
    return out;
  }, { bossIds: ZG_BOSS_IDS, difficulties: RAID_DIFFICULTIES });

  const bossWithData = Object.values(bossStatsOut).filter(Boolean).length;
  console.log(`  -> ${bossWithData}/${Object.keys(bossStatsOut).length} combos de boss com dados`);
  fs.writeFileSync(path.join(RAW, 'boss-stats-raw.json'), JSON.stringify({ out: bossStatsOut }));

  // -------------------------------------------- ascensionlogs-data2.json
  // Mantido por compatibilidade com build-data.mjs (que mescla data + data2
  // em logs.stats) — como já geramos tudo em statsOut, data2 fica vazio;
  // build-data.mjs simplesmente não sobrescreve nada.
  fs.writeFileSync(path.join(RAW, 'ascensionlogs-data2.json'), JSON.stringify({}));

  await browser.close();
  console.log('[ascension-logs] concluído.');
}

main().catch(e => {
  console.error('[ascension-logs] ERRO:', e);
  process.exit(1);
});
