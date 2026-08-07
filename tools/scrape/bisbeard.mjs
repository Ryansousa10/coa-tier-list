// Extrai dados de coa.bisbeard.com via navegador headless (Playwright).
// Os metadados (pesos de atributo, regras de equipamento) e o banco de itens
// só existem dentro de módulos JS carregados pelo app (não tem API REST
// pública pra isso) — por isso importamos os chunks dinamicamente dentro do
// próprio navegador e lemos os dados sincronizados no IndexedDB deles.
//
// Os nomes dos arquivos (`realmDataCoa-<hash>.js`, `itemDatabaseSync-<hash>.js`)
// mudam a cada deploy do BisBeard, então descobrimos a URL atual observando
// as respostas de rede da página inicial, em vez de fixar o nome.
//
// IMPORTANTE (incidente de 2026-08-07): os nomes minificados das funções
// exportadas (`O`, `aX`, ...) também mudam a cada rebuild do bundle deles —
// mas o pior é que um deploy pode REAPROVEITAR um nome minificado antigo pra
// uma função DIFERENTE (ex.: `O`, que era a função de sync, virou uma função
// de "limpar todos os bancos"). Isso faz o pipeline "funcionar" sem erro,
// só que sincronizando errado (a limpeza esvazia o banco em vez de
// preenchê-lo) — daí o sanity-check pegou uma contagem de itens bem abaixo
// do mínimo, mas não zero, porque sobrava lixo de sincronizações anteriores
// no IndexedDB do navegador.
// Por isso NÃO confiamos mais em nome minificado nenhum: procuramos as
// funções pelo formato do código-fonte delas (uma função async que aceita
// `{onProgress}` é a de sync; uma função que abre uma `transaction` e chama
// `getAll()` é a de leitura por store) — o comportamento é bem mais estável
// entre builds do que o nome que o minificador escolhe.
// Descobrimos também que o schema de armazenamento mudou: antes era um
// array único com todos os itens; agora é uma store do IndexedDB por
// fase+categoria (`items_<fase>_<categoria>`, ex. `items_1_raid`). Lemos a
// lista de categorias diretamente do IndexedDB (não fixamos a lista), e
// juntamos todas as stores da fase 1.
//
// Gera:
//   tools/data/raw/bisbeard-meta.json      (classes, specs, pesos, regras)
//   tools/data/raw/bisbeard-items-p1.json  (banco de itens da Fase 1)
//
// Uso: node tools/scrape/bisbeard.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'data', 'raw');
fs.mkdirSync(RAW, { recursive: true });

const ITEMS_PHASE = 1;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  let realmDataUrl = null;
  let itemSyncUrl = null;
  page.on('response', (resp) => {
    const url = resp.url();
    if (/\/assets\/realmDataCoa-.*\.js$/.test(url)) realmDataUrl = url;
    if (/\/assets\/itemDatabaseSync-.*\.js$/.test(url)) itemSyncUrl = url;
  });

  console.log('[bisbeard] abrindo coa.bisbeard.com...');
  await page.goto('https://coa.bisbeard.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  if (!realmDataUrl || !itemSyncUrl) {
    throw new Error(`Não achou os chunks esperados (realmData=${realmDataUrl}, itemSync=${itemSyncUrl}). O site pode ter mudado de estrutura.`);
  }
  console.log('[bisbeard] realmData:', realmDataUrl);
  console.log('[bisbeard] itemSync:', itemSyncUrl);

  // ------------------------------------------------------------- meta
  console.log('[bisbeard] lendo metadados (pesos, regras de equipamento)...');
  const meta = await page.evaluate(async (url) => {
    const mod = await import(url);
    const rd = mod.coaRealmData;
    return {
      classData: rd.classData,
      classSpecs: rd.classSpecs,
      equipmentRules: rd.equipmentRules,
      specRoleMeta: rd.coaTalentData?.specRoleMeta,
      specRolesByClassSpec: rd.coaTalentData?.specRolesByClassSpec,
    };
  }, realmDataUrl);
  if (!meta.classSpecs || !meta.equipmentRules) {
    throw new Error('coaRealmData não tem o formato esperado — o bundle do BisBeard pode ter mudado.');
  }
  fs.writeFileSync(path.join(RAW, 'bisbeard-meta.json'), JSON.stringify(meta));
  console.log(`  -> ${meta.classSpecs.length} class/spec entries`);

  // ------------------------------------------------------------ itens
  console.log('[bisbeard] sincronizando banco de itens (pode levar ~15s)...');
  const { items, dbName, progress } = await page.evaluate(async ({ url, phase }) => {
    const mod = await import(url);

    // Função de sync: identificada pelo FORMATO (aceita {onProgress}), não
    // pelo nome minificado — nomes se repetem entre builds pra funções
    // diferentes (ver comentário grande no topo do arquivo).
    let syncFn = null;
    for (const v of Object.values(mod)) {
      if (typeof v === 'function' && /onProgress/.test(v.toString())) { syncFn = v; break; }
    }
    if (!syncFn) throw new Error('Função de sincronização de itens não encontrada no bundle (nenhuma função aceita {onProgress}).');

    const dbsBefore = await indexedDB.databases();
    const namesBefore = new Set(dbsBefore.map(d => d.name));

    const progress = [];
    await syncFn({ onProgress: (p) => progress.push(p) });

    // Função de leitura por store: identificada por abrir uma `transaction`
    // e chamar `getAll()` dentro dela — é a única com essa forma no bundle.
    let readFn = null;
    for (const v of Object.values(mod)) {
      if (typeof v !== 'function') continue;
      const src = v.toString();
      if (/objectStoreNames/.test(src) && /getAll\(\)/.test(src)) { readFn = v; break; }
    }
    if (!readFn) throw new Error('Função de leitura por store não encontrada no bundle (nenhuma função usa transaction+getAll).');

    // O banco (IndexedDB) recém-criado pelo sync é o que muda entre o "antes"
    // e o "depois" — assim não fixamos o nome do banco, que também pode
    // mudar entre deploys.
    const dbsAfter = await indexedDB.databases();
    const newDbs = dbsAfter.filter(d => !namesBefore.has(d.name));
    const dbName = (newDbs[0] ?? dbsAfter[0])?.name;
    if (!dbName) throw new Error('Nenhum IndexedDB encontrado depois do sync.');

    const storeNames = await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => { const names = [...req.result.objectStoreNames]; req.result.close(); resolve(names); };
      req.onerror = () => reject(req.error);
    });

    // Schema atual: uma store por fase+categoria (`items_<fase>_<categoria>`).
    // Lemos a lista de categorias do próprio IndexedDB em vez de fixá-la, pra
    // não quebrar de novo se uma categoria for adicionada/removida.
    const prefix = `items_${phase}_`;
    const categories = storeNames.filter(n => n.startsWith(prefix)).map(n => n.slice(prefix.length));
    if (categories.length === 0) throw new Error(`Nenhuma store "${prefix}*" encontrada (stores: ${storeNames.join(', ')}).`);

    const looksLikeItems = (arr) => Array.isArray(arr) && arr.length > 0 && arr[0] && typeof arr[0].name === 'string' && 'slot' in arr[0];
    let items = [];
    for (const cat of categories) {
      const rows = await readFn(phase, cat);
      if (rows.length > 0 && !looksLikeItems(rows)) {
        throw new Error(`Store "${prefix}${cat}" não tem o formato esperado de item (name/slot).`);
      }
      items = items.concat(rows);
    }
    return { items, dbName, progress };
  }, { url: itemSyncUrl, phase: ITEMS_PHASE });

  console.log(`  -> banco "${dbName}" sincronizado (${progress.at(-1) ?? '?'})`);
  fs.writeFileSync(path.join(RAW, 'bisbeard-items-p1.json'), JSON.stringify(items));
  console.log(`  -> ${items.length} itens`);

  await browser.close();
  console.log('[bisbeard] concluído.');
}

main().catch(e => {
  console.error('[bisbeard] ERRO:', e);
  process.exit(1);
});
