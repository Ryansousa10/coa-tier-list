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

if (!ok) {
  console.error('\nSanity check falhou — abortando antes de gerar/commitar dados.');
  process.exit(1);
}
console.log('\nSanity check ok.');
