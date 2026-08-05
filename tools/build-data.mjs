// Gera os arquivos de dados estáticos do site a partir dos dados brutos
// extraídos do coa.ascensionlogs.gg e coa.bisbeard.com.
//
// Uso: node tools/build-data.mjs
// Entrada: tools/data/raw/*.json
// Saída:  public/data/*.json  (classes.json, stats.json, bis/<classe>-<spec>.json)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, 'data', 'raw');
const OUT = path.join(__dirname, '..', 'public', 'data');

const logs = JSON.parse(fs.readFileSync(path.join(RAW, 'ascensionlogs-data.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(RAW, 'bisbeard-meta.json'), 'utf8'));
const items = JSON.parse(fs.readFileSync(path.join(RAW, 'bisbeard-items-p1.json'), 'utf8'));

fs.mkdirSync(path.join(OUT, 'bis'), { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- classes.json
// Junta: classes/specs dos logs (roles de combate) + ícones do bisbeard + role fina (melee/ranged/caster).
const classColors = {
  'Barbarian': '#c69b6d', 'Bloodmage': '#c41e3a', 'Chronomancer': '#40c7eb',
  'Cultist': '#8788ee', 'Felsworn': '#a330c9', 'Guardian': '#c8a851',
  'Knight of Xoroth': '#ff4040', 'Necromancer': '#3fc7a5', 'Primalist': '#ff7c0a',
  'Pyromancer': '#ff5a00', 'Ranger': '#abd473', 'Reaper': '#9482c9',
  'Runemaster': '#00b4ff', 'Starcaller': '#c0b3ff', 'Stormbringer': '#0070dd',
  'Sun Cleric': '#ffd100', 'Templar': '#f48cba', 'Tinker': '#a5876a',
  'Venomancer': '#69cc3c', 'Witch Doctor': '#28a745', 'Witch Hunter': '#8b6d3f',
};

// Ícones custom do CoA que não existem no CDN de ícones — substitutos temáticos
const iconOverrides = {
  cthunicon: 'inv_misc_eye_01',
  nzothicon: 'spell_shadow_mindtwisting',
  warpblade: 'inv_sword_61',
  'inv_bow_1h_sid.blp': 'inv_weapon_bow_08',
  custom_garrison_dagger_border: 'inv_weapon_shortblade_25',
  'yogg-saronicon': 'spell_shadow_mindtwisting',
  inv_shield_frostgiant_01: 'inv_shield_09',
  inv_mace_1h_frostgiant_boss: 'inv_mace_51',
  inv_legionrorch: 'inv_torch_lit',
  inv_sid_staff_2h: 'inv_staff_30',
  inv_wand_1h_void_koboldking: 'inv_wand_22',
  inv_reliquarytableshield: 'inv_shield_32',
  weaverform: 'spell_shadow_creepingplague',
};
const fixIcon = (icon) => (icon && iconOverrides[String(icon).toLowerCase()]) || icon;

// Specs com nomes diferentes entre AscensionLogs e BisBeard (mesma spec, nome distinto)
const specNameAliases = {
  'Venomancer:Rot': 'Rotweaver',
};
const bisSpecName = (className, specName) => specNameAliases[`${className}:${specName}`] || specName;

const bisClassByName = {};
for (const [key, cd] of Object.entries(meta.classData)) {
  bisClassByName[cd.name] = { key, ...cd };
}
const roleByClassSpec = meta.specRolesByClassSpec || {};

const classes = [];
for (const [className, info] of Object.entries(logs.classSpecs)) {
  const bis = bisClassByName[className];
  const classKey = bis ? bis.key : slug(className);
  const specs = [];
  for (const specName of info.specs) {
    if (/ DPS$/.test(specName)) continue; // variantes off-role viram flag no spec base
    const bisName = bisSpecName(className, specName);
    const specKeyBis = bis ? Object.keys(bis.specs).find(k => bis.specs[k].name === bisName) : null;
    const specKey = specKeyBis || slug(specName);
    const fineRole = (roleByClassSpec[classKey] || {})[specKey] || null;
    const roles = [];
    if (info.tankSpecs.includes(specName)) roles.push('tank');
    else if (info.healerSpecs.includes(specName)) roles.push('healer');
    else roles.push('dps');
    if (info.supportSpecs.includes(specName)) roles.push('support');
    // specs híbridas tank/healer também têm variante DPS nos logs ("X DPS")
    const hasDpsVariant = info.specs.includes(specName + ' DPS');
    if (hasDpsVariant && !roles.includes('dps')) roles.push('dps');
    specs.push({
      name: specName,
      key: specKey,
      icon: bis && specKeyBis ? fixIcon(bis.specs[specKeyBis].icon) : null,
      roles,
      fineRole,
      logSpecNames: { base: specName, dps: hasDpsVariant ? specName + ' DPS' : specName },
    });
  }
  classes.push({
    name: className,
    key: classKey,
    icon: bis ? bis.icon : null,
    color: classColors[className] || '#aaaaaa',
    specs,
  });
}
classes.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(path.join(OUT, 'classes.json'), JSON.stringify(classes));
console.log('classes.json:', classes.length, 'classes');

// ------------------------------------------------------------------ stats.json
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify({
  extractedAt: logs.extractedAt,
  phases: logs.phases.map(p => ({ phase: p.phase, name: p.name, active: p.active })),
  stats: logs.stats,
}));
console.log('stats.json ok');

// ------------------------------------------------------------- bis/<spec>.json
const ARMOR_TYPES = new Set(['Cloth', 'Leather', 'Mail', 'Plate']);
const ARMOR_SLOTS = new Set(['Head', 'Shoulders', 'Chest', 'Wrists', 'Hands', 'Waist', 'Legs', 'Feet']);
const WEAPON_SLOTS = new Set(['Two-Hand', 'One-Hand', 'Main Hand', 'Ranged', 'Off Hand']);
const EXCLUDED_SOURCES = new Set(['pvp', 'bloodforged', 'enchants', 'gems']);

const singular = (t) => {
  let x = String(t || '').replace('Two-Handed ', '').replace('One-Handed ', '');
  if (x === 'Staves') return 'Staff';
  if (x.endsWith('s') && !x.endsWith('ss')) x = x.slice(0, -1);
  return x;
};

const dpsFromDescription = (item) => {
  const m = /\(([\d.]+) damage per second\)/.exec(item.description || '');
  return m ? parseFloat(m[1]) : 0;
};

const iconUrl = (icon) => {
  if (!icon) return null;
  const base = String(icon).split(/[\\/]/).pop().toLowerCase();
  return fixIcon(base) || null;
};

function scoreItem(item, weights) {
  let score = 0;
  const stats = item.stats || {};
  for (const [k, w] of Object.entries(weights)) {
    if (k === 'weaponDps') {
      if (item.slot === 'Two-Hand' || item.slot === 'One-Hand' || item.slot === 'Main Hand') {
        score += dpsFromDescription(item) * w;
      }
    } else if (k === 'rangedDps') {
      if (item.slot === 'Ranged') score += dpsFromDescription(item) * w;
    } else if (typeof stats[k] === 'number') {
      score += stats[k] * w;
    }
  }
  return score;
}

function allowedForClass(item, className) {
  const cls = item.classes || ['All'];
  if (!cls.includes('All') && !cls.includes(className)) return false;
  if (ARMOR_SLOTS.has(item.slot) && ARMOR_TYPES.has(item.type)) {
    const perm = meta.equipmentRules.armorPermissions[className];
    if (perm && !perm.includes(item.type)) return false;
  }
  return true;
}

function allowedWeapon(item, className, specName) {
  const wp = meta.equipmentRules.weaponPermissions[className];
  if (!wp) return true;
  const t = singular(item.type);
  if (item.type === 'Shield') return !!wp.shield;
  if (item.slot === 'Held In Off-hand') return true;
  if (!wp.allowedTypes.some(a => singular(a) === t)) return false;
  if (item.slot === 'Two-Hand' && (wp.noTwoHanded || []).some(a => singular(a) === t)) return false;
  const sp = (meta.equipmentRules.specWeaponPermissions[className] || {})[specName];
  if (sp && sp.allowedRangedWeaponTypes && item.slot === 'Ranged') {
    const rangedPhysical = ['Bow', 'Crossbow', 'Gun', 'Thrown'];
    if (rangedPhysical.includes(t) && !sp.allowedRangedWeaponTypes.some(a => singular(a) === t)) return false;
  }
  return true;
}

// Slots exibidos na página (agrupamento por slot lógico)
const SLOT_GROUPS = [
  { key: 'head', label: 'Cabeça', match: i => i.slot === 'Head' },
  { key: 'neck', label: 'Pescoço', match: i => i.slot === 'Neck' },
  { key: 'shoulders', label: 'Ombros', match: i => i.slot === 'Shoulders' },
  { key: 'back', label: 'Costas', match: i => i.slot === 'Back' },
  { key: 'chest', label: 'Peito', match: i => i.slot === 'Chest' },
  { key: 'wrists', label: 'Pulsos', match: i => i.slot === 'Wrists' },
  { key: 'hands', label: 'Mãos', match: i => i.slot === 'Hands' },
  { key: 'waist', label: 'Cintura', match: i => i.slot === 'Waist' },
  { key: 'legs', label: 'Pernas', match: i => i.slot === 'Legs' },
  { key: 'feet', label: 'Pés', match: i => i.slot === 'Feet' },
  { key: 'finger', label: 'Anel', match: i => i.slot === 'Finger' },
  { key: 'trinket', label: 'Berloque', match: i => i.slot === 'Trinket' },
  { key: 'twohand', label: 'Arma de Duas Mãos', match: i => i.slot === 'Two-Hand' },
  { key: 'mainhand', label: 'Mão Principal', match: i => i.slot === 'One-Hand' || i.slot === 'Main Hand' },
  { key: 'offhand', label: 'Mão Secundária', match: i => i.slot === 'Off Hand' || i.slot === 'Shield' || i.slot === 'Held In Off-hand' || i.slot === 'One-Hand' },
  { key: 'ranged', label: 'À Distância', match: i => i.slot === 'Ranged' },
];

const usable = items.filter(i =>
  !EXCLUDED_SOURCES.has(i.sourceCategory) &&
  i.slot && i.slot !== 'Unknown' &&
  (ARMOR_SLOTS.has(i.slot) || WEAPON_SLOTS.has(i.slot) ||
   ['Neck', 'Back', 'Finger', 'Trinket', 'Shield', 'Held In Off-hand'].includes(i.slot))
);
console.log('usable items:', usable.length);

let filesWritten = 0;
for (const spec of meta.classSpecs) {
  const { className, specName, defaultWeights } = spec;
  if (!defaultWeights || Object.keys(defaultWeights).length === 0) continue;
  const bisCls = bisClassByName[className];
  const classKey = bisCls ? bisCls.key : slug(className);
  const specKey = (bisCls && Object.keys(bisCls.specs).find(k => bisCls.specs[k].name === specName)) || slug(specName);

  const specPerm = (meta.equipmentRules.specWeaponPermissions[className] || {})[specName] || {};
  const slots = [];
  for (const group of SLOT_GROUPS) {
    // pula grupos de arma sem sentido para a spec
    if (group.key === 'offhand' && specPerm.dualWield === 'none') {
      const wp = meta.equipmentRules.weaponPermissions[className];
      if (!wp || !wp.shield) {
        // ainda pode usar "Held In Off-hand"
      }
    }
    const best = new Map(); // baseItemId -> melhor variante
    for (const item of usable) {
      if (!group.match(item)) continue;
      if (!allowedForClass(item, className)) continue;
      if (WEAPON_SLOTS.has(item.slot) || item.type === 'Shield') {
        if (!allowedWeapon(item, className, specName)) continue;
        if (group.key === 'offhand' && (item.slot === 'One-Hand' || item.slot === 'Main Hand')) {
          if (item.slot === 'Main Hand') continue;
          if (!specPerm.dualWield || specPerm.dualWield === 'none' || specPerm.dualWield === 'twoHand') continue;
        }
      }
      const score = scoreItem(item, defaultWeights);
      if (score <= 0) continue;
      // agrupa por nome: dificuldades/affixes viram uma entrada só (a melhor)
      const baseId = item.name;
      const prev = best.get(baseId);
      if (!prev || score > prev.score) {
        best.set(baseId, {
          id: item.baseItemId || item.id,
          name: item.name,
          quality: item.quality,
          ilvl: item.itemLevel,
          icon: iconUrl(item.icon),
          source: item.source,
          sourceCategory: item.sourceCategory,
          version: item.version,
          dropRate: item.dropRate,
          type: item.type,
          slot: item.slot,
          stats: item.stats,
          score: Math.round(score * 10) / 10,
        });
      }
    }
    const top = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 6);
    if (top.length > 0) slots.push({ key: group.key, label: group.label, items: top });
  }
  if (slots.length === 0) continue;
  const file = `${classKey}-${specKey}.json`;
  fs.writeFileSync(path.join(OUT, 'bis', file), JSON.stringify({
    className, specName, weights: defaultWeights, slots,
  }));
  filesWritten++;
}
console.log('bis files:', filesWritten);
