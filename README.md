# CoA Tier List

Site responsivo (Angular + TypeScript) com a tier list das classes e specs do
**Conquest of Azeroth** (Ascension WoW), com filtros por conteúdo, dificuldade e
função, além do **BIS gear** de cada spec.

## Rodando

```bash
npm install
npm start          # http://localhost:4200
npm run build      # build de produção em dist/coa-tier-list
```

## Fontes de dados

| Fonte | Uso |
| --- | --- |
| [coa.ascensionlogs.gg](https://coa.ascensionlogs.gg) | Estatísticas de DPS/HPS por spec (raids, dungeons, world bosses) — base dos tiers |
| [coa.bisbeard.com](https://coa.bisbeard.com) | Pesos de atributos por spec + banco de itens — base do BIS gear |
| [db.ascension.gg](https://db.ascension.gg) | Ícones e links dos itens |

## Como os dados são gerados

Os dados brutos ficam em `tools/data/raw/`:

- `ascensionlogs-data.json` — estatísticas agregadas extraídas da API interna
  `https://coa.ascensionlogs.gg/api/statistics` (todas as combinações de
  fase/dificuldade/função), mais `class-specs` e `phases`.
- `bisbeard-meta.json` — classes, specs, pesos de atributos (`defaultWeights`),
  regras de equipamento e roles, extraídos do bundle do BisBeard.
- `bisbeard-items-p1.json` — banco de itens da Fase 1 (manifest público em
  `https://gear-planner-api.bisbeard.workers.dev/api/data/manifest?reader=2`).

Scripts (Node ≥ 20):

```bash
node tools/build-data.mjs      # gera public/data/{classes,stats}.json e public/data/bis/*.json
node tools/download-icons.mjs  # baixa os ícones referenciados para public/icons/
```

> As APIs dos sites ficam atrás de Cloudflare e não permitem acesso direto do
> navegador de terceiros (CORS/challenge). Por isso o site consome apenas dados
> estáticos gerados no build. Para atualizar os dados é preciso reextrair os
> arquivos brutos (via navegador logado nos sites) e rodar os scripts acima.

## Cálculo dos tiers

Para cada filtro (conteúdo × dificuldade × função), a pontuação de cada spec é a
**mediana** dos parses (ou o **p95** no modo "Topo"), normalizada pela melhor
spec: S ≥ 85 %, A ≥ 68 %, B ≥ 50 %, C ≥ 32 %, D < 32 %. Specs com menos de 5
parses recebem o aviso ⚠ (amostra pequena).

## Cálculo do BIS

Cada item recebe `soma(atributo × peso da spec)` usando os pesos oficiais do
BisBeard (incluindo DPS de arma, extraído da descrição do item), respeitando as
permissões de armadura/arma de cada classe. Itens de PvP/Bloodforged são
excluídos e variantes (dificuldade/afixo) são agrupadas pela melhor versão.
