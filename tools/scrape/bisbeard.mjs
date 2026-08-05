// Extrai dados de coa.bisbeard.com via navegador headless (Playwright).
// Os metadados (pesos de atributo, regras de equipamento) e o banco de itens
// só existem dentro de módulos JS carregados pelo app (não tem API REST
// pública pra isso) — por isso importamos os chunks dinamicamente dentro do
// próprio navegador e lemos os dados sincronizados no IndexedDB deles.
//
// Os nomes dos arquivos (`realmDataCoa-<hash>.js`, `itemDatabaseSync-<hash>.js`)
// mudam a cada deploy do BisBeard, então descobrimos a URL atual observando
// as respostas de rede da página inicial, em vez de fixar o nome. O mesmo
// vale pros nomes das funções exportadas (minificados tipo `O`/`aX`) — como
// hoje conhecemos eles, tentamos por nome primeiro, mas caímos pra uma busca
// heurística se o bundle deles mudar e os nomes não baterem mais.
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

// Nomes conhecidos hoje (podem mudar a cada rebuild do bundle deles).
const KNOWN_SYNC_EXPORT = 'O';
const KNOWN_READ_EXPORT = 'aX';

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
  const items = await page.evaluate(async ({ url, syncName, readName }) => {
    const mod = await import(url);

    // 1) tenta pelo nome minificado conhecido; se não bater, procura uma
    //    função assíncrona que aceite {onProgress} (assinatura da função
    //    de sincronização, estável mesmo se o nome minificado mudar).
    let syncFn = typeof mod[syncName] === 'function' ? mod[syncName] : null;
    if (!syncFn) {
      for (const v of Object.values(mod)) {
        if (typeof v === 'function' && /onProgress/.test(v.toString())) { syncFn = v; break; }
      }
    }
    if (!syncFn) throw new Error('Função de sincronização de itens não encontrada no bundle.');
    await syncFn({});

    // 2) idem pra leitura; se o nome não bater, chama toda função sem
    //    argumento e usa a primeira que devolver uma lista de itens de
    //    verdade (reconhecida pela forma: objetos com name + slot).
    let readFn = typeof mod[readName] === 'function' ? mod[readName] : null;
    let items = readFn ? await readFn() : null;
    const looksLikeItems = (arr) => Array.isArray(arr) && arr.length > 1000 && arr[0] && typeof arr[0].name === 'string' && 'slot' in arr[0];

    if (!looksLikeItems(items)) {
      for (const v of Object.values(mod)) {
        if (typeof v !== 'function') continue;
        try {
          const candidate = await v();
          if (looksLikeItems(candidate)) { items = candidate; break; }
        } catch { /* não é a função certa, ignora */ }
      }
    }
    if (!looksLikeItems(items)) throw new Error('Função de leitura de itens não encontrada ou formato inesperado no bundle.');
    return items;
  }, { url: itemSyncUrl, syncName: KNOWN_SYNC_EXPORT, readName: KNOWN_READ_EXPORT });

  fs.writeFileSync(path.join(RAW, 'bisbeard-items-p1.json'), JSON.stringify(items));
  console.log(`  -> ${items.length} itens`);

  await browser.close();
  console.log('[bisbeard] concluído.');
}

main().catch(e => {
  console.error('[bisbeard] ERRO:', e);
  process.exit(1);
});
