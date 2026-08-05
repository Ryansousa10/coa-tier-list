// Confere se os dados brutos recém-extraídos têm um volume minimamente
// razoável, antes de deixar o pipeline gerar public/data/ e commitar.
// Existe pra pegar extrações parciais/quebradas (ex.: site fora do ar,
// mudança de estrutura não detectada) sem publicar dados incompletos.
//
// Uso: node tools/scrape/sanity-check.mjs  (sai com código != 0 se falhar)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'data', 'raw');

const MIN = {
  classSpecsCount: 15,
  statsCombosWithData: 80,   // de 120
  bossCombosWithData: 25,    // de 52
  bisbeardClassSpecs: 50,    // de 70
  items: 15000,              // de ~24k
};

let ok = true;
function check(label, actual, min) {
  const pass = actual >= min;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}: ${actual} (mínimo ${min})`);
  if (!pass) ok = false;
}

const logs = JSON.parse(fs.readFileSync(path.join(RAW, 'ascensionlogs-data.json'), 'utf8'));
check('classSpecs (AscensionLogs)', Object.keys(logs.classSpecs || {}).length, MIN.classSpecsCount);
check('combos de stats com dados', Object.values(logs.stats || {}).filter(Boolean).length, MIN.statsCombosWithData);

const bossRaw = JSON.parse(fs.readFileSync(path.join(RAW, 'boss-stats-raw.json'), 'utf8'));
check('combos de boss com dados', Object.values(bossRaw.out || {}).filter(Boolean).length, MIN.bossCombosWithData);

const meta = JSON.parse(fs.readFileSync(path.join(RAW, 'bisbeard-meta.json'), 'utf8'));
check('class/spec entries (BisBeard)', (meta.classSpecs || []).length, MIN.bisbeardClassSpecs);

const items = JSON.parse(fs.readFileSync(path.join(RAW, 'bisbeard-items-p1.json'), 'utf8'));
check('itens (BisBeard)', items.length, MIN.items);

// Foco de cura em tanks: soft-check (não bloqueia o pipeline) — é uma
// amostra bem mais pesada e nova, não deveria travar a atualização dos
// dados principais do site se vier fraca ou faltando.
const tankFocusPath = path.join(RAW, 'tank-focus-raw.json');
if (fs.existsSync(tankFocusPath)) {
  const tankFocus = JSON.parse(fs.readFileSync(tankFocusPath, 'utf8'));
  const n = Object.keys(tankFocus.bySpec || {}).length;
  console.log(`INFO specs com foco de cura em tank: ${n}${n < 4 ? ' (baixo, mas não bloqueia)' : ''}`);
} else {
  console.log('INFO tank-focus-raw.json ausente (não bloqueia)');
}

if (!ok) {
  console.error('\nSanity check falhou — abortando antes de gerar/commitar dados.');
  process.exit(1);
}
console.log('\nSanity check ok.');
