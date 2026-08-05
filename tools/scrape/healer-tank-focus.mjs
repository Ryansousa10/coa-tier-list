// Estima, por spec de healer, que fração da cura efetiva vai pros tanks vs
// pro resto do raid — pra responder "qual spec é melhor pra ser um healer
// dedicado a tank?". Essa dimensão NÃO existe no /api/statistics agregado
// (confirmado: metric=avg_hps não tem parâmetro de alvo). Só existe dentro
// de relatórios individuais, então esse script amostra os top parses de
// cada boss/dificuldade (via /api/encounters/rankings/healing/all, que já
// devolve report_id + encounter_id por parse) e, pra cada relatório único,
// pergunta quanto da cura de cada healer foi pros personagens jogando spec
// de tank naquele raid (via /api/reports/{id}/character_spell_healing com
// targetCharacterIds=<tanks>).
//
// É uma amostra (top parses, não "todos os parses" como o resto do site) e
// o resultado é uma heurística, não um dado oficial — não tem como saber
// com certeza se um healer estava "designado" pro tank ou só ficou perto
// dele. Mas a fração de cura efetiva que cai nos tanks é um sinal razoável.
//
// Gera: tools/data/raw/tank-focus-raw.json
//
// Uso: node tools/scrape/healer-tank-focus.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'data', 'raw');
fs.mkdirSync(RAW, { recursive: true });

const BASE = 'https://coa.ascensionlogs.gg';
const RAID_DIFFICULTIES = ['normal', 'heroic', 'mythic', 'ascended'];

function median(nums) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  console.log('[tank-focus] abrindo statistics...');
  await page.goto(`${BASE}/statistics`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  console.log('[tank-focus] class-specs (pra saber quem é tank)...');
  const classSpecs = await page.evaluate(async () => {
    const d = await fetch('/api/creatures/class-specs').then(r => r.json());
    return d.classSpecs;
  });
  const tankSpecSet = new Set();
  const healerSpecSet = new Set();
  for (const [cls, info] of Object.entries(classSpecs)) {
    for (const sp of info.tankSpecs || []) tankSpecSet.add(`${cls}:${sp}`);
    for (const sp of info.healerSpecs || []) healerSpecSet.add(`${cls}:${sp}`);
  }

  // ---------------------------------------------- top parses de cura por boss
  console.log('[tank-focus] rankings de cura (todos os bosses, 4 dificuldades)...');
  const parses = [];
  for (const diff of RAID_DIFFICULTIES) {
    const rankings = await page.evaluate(async (diff) => {
      const j = await fetch(`/api/encounters/rankings/healing/all?phase=1&difficulty=${diff}&location=${encodeURIComponent("Zul'Gurub")}`).then(r => r.json());
      return j.success ? j.rankings : {};
    }, diff);
    for (const bossData of Object.values(rankings)) {
      const rows = bossData?.rankingsByDifficulty?.[diff] || [];
      for (const r of rows) {
        if (!healerSpecSet.has(`${r.class}:${r.spec}`)) continue; // só healer de verdade
        if (!r.report_id || !r.encounter_id || !r.character_id) continue;
        parses.push({
          characterId: r.character_id, class: r.class, spec: r.spec,
          effHealing: r.effective_healing, reportId: r.report_id, encounterId: r.encounter_id,
        });
      }
    }
  }
  console.log(`  -> ${parses.length} parses de healer amostrados`);

  // ---------------------------------------------------- resolve tanks por encontro
  const uniqueEncounters = [...new Set(parses.map(p => `${p.reportId}:${p.encounterId}`))];
  console.log(`[tank-focus] ${uniqueEncounters.length} relatórios únicos — resolvendo tanks + cura...`);

  const encounterInfo = await page.evaluate(async ({ keys, tankSpecList }) => {
    const tankSpecSet = new Set(tankSpecList);
    const out = {};
    for (const key of keys) {
      const [reportId, encounterId] = key.split(':');
      try {
        const enc = await fetch(`/api/reports/${reportId}/encounters/${encounterId}?includeParsePercentiles=true`).then(r => r.json());
        if (!enc.success) { out[key] = null; continue; }
        const tankIds = (enc.character_stats || [])
          .filter(c => tankSpecSet.has(`${c.class}:${c.spec}`))
          .map(c => c.character_id);
        const playerCount = enc.encounter?.player_count || (enc.character_stats || []).length;
        if (tankIds.length === 0) { out[key] = { tankIds: [], playerCount, healingToTanks: {} }; continue; }

        const heal = await fetch(
          `/api/reports/${reportId}/character_spell_healing?scope=encounter&format=flat&limit=1000&encounterIds=${encounterId}&participantType=friendlies&targetCharacterIds=${tankIds.join(',')}`
        ).then(r => r.json());
        const healingToTanks = {};
        if (heal.success) {
          for (const row of heal.rows || []) {
            healingToTanks[row.character_id] = (healingToTanks[row.character_id] || 0) + (row.effective_healing || 0);
          }
        }
        out[key] = { tankIds, playerCount, healingToTanks };
      } catch (e) {
        out[key] = null;
      }
    }
    return out;
  }, { keys: uniqueEncounters, tankSpecList: [...tankSpecSet] });

  const resolvedCount = Object.values(encounterInfo).filter(Boolean).length;
  console.log(`  -> ${resolvedCount}/${uniqueEncounters.length} relatórios resolvidos`);

  // -------------------------------------------------------------- agrega por spec
  const bySpec = {}; // "Class:Spec" -> { ratios: [], baselines: [] }
  for (const p of parses) {
    const info = encounterInfo[`${p.reportId}:${p.encounterId}`];
    if (!info || info.tankIds.length === 0 || !p.effHealing || p.effHealing <= 0) continue;
    const toTanks = info.healingToTanks[p.characterId] || 0;
    const ratio = toTanks / p.effHealing;
    if (!Number.isFinite(ratio)) continue;
    const key = `${p.class}:${p.spec}`;
    (bySpec[key] ??= { ratios: [], baselines: [] });
    bySpec[key].ratios.push(Math.min(1, ratio));
    bySpec[key].baselines.push(info.tankIds.length / info.playerCount);
  }

  const summary = {};
  for (const [key, { ratios, baselines }] of Object.entries(bySpec)) {
    if (ratios.length < 3) continue; // amostra mínima pra não virar ruído
    summary[key] = {
      samples: ratios.length,
      medianRatio: Math.round(median(ratios) * 1000) / 1000,
      avgBaselineRatio: Math.round((baselines.reduce((a, b) => a + b, 0) / baselines.length) * 1000) / 1000,
    };
  }

  fs.writeFileSync(path.join(RAW, 'tank-focus-raw.json'), JSON.stringify({
    extractedAt: new Date().toISOString(),
    bySpec: summary,
  }));
  console.log(`[tank-focus] concluído: ${Object.keys(summary).length} specs com dados suficientes.`);

  await browser.close();
}

main().catch(e => {
  console.error('[tank-focus] ERRO:', e);
  process.exit(1);
});
