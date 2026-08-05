// Baixa localmente todos os ícones referenciados em public/data/ (specs + itens BIS).
// Fonte primária: db.ascension.gg — fallback: wow.zamimg.com.
//
// Uso: node tools/download-icons.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'public', 'data');
const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const icons = new Set();

const classes = JSON.parse(fs.readFileSync(path.join(DATA, 'classes.json'), 'utf8'));
for (const cls of classes) for (const spec of cls.specs) if (spec.icon) icons.add(spec.icon);

for (const file of fs.readdirSync(path.join(DATA, 'bis'))) {
  const bis = JSON.parse(fs.readFileSync(path.join(DATA, 'bis', file), 'utf8'));
  for (const slot of bis.slots) {
    for (const item of slot.items) if (item.icon) icons.add(item.icon);
    if (slot.enchant?.icon) icons.add(slot.enchant.icon);
  }
}

const list = [...icons].filter(i => !fs.existsSync(path.join(OUT, i + '.jpg')));
console.log(`ícones: ${icons.size} no total, ${list.length} para baixar`);

let ok = 0, fail = 0;
const queue = [...list];
async function worker() {
  while (queue.length) {
    const name = queue.pop();
    const dest = path.join(OUT, name + '.jpg');
    for (const base of [
      'https://db.ascension.gg/static/images/wow/icons/large/',
      'https://wow.zamimg.com/images/wow/icons/large/',
    ]) {
      try {
        const res = await fetch(base + name + '.jpg');
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 500) continue; // páginas de erro
        fs.writeFileSync(dest, buf);
        ok++;
        break;
      } catch { /* tenta a próxima fonte */ }
    }
    if (!fs.existsSync(dest)) { fail++; console.warn('falhou:', name); }
    if ((ok + fail) % 100 === 0) console.log(`progresso: ${ok + fail}/${list.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`concluído: ${ok} baixados, ${fail} falharam`);
