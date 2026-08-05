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
- `ascensionlogs-data2.json` — as mesmas combinações, mas com o parâmetro
  `damageMode` (`boss-only`/`trash`), usado para separar dano single-target de
  dano em área (AoE) no filtro "Perfil de Dano".
- `boss-stats-raw.json` + `zg-bosses-meta.json` — desempenho médio por boss
  individual de Zul'Gurub (parâmetro `bossId` da mesma API), nas 4
  dificuldades, usado na seção "Desempenho por Boss" da página de cada spec.
  Atenção: a API usa `role=healer` inválido — pra métrica de cura (`avg_hps`)
  o parâmetro `role` deve ser omitido, não vale `role=healer`.
- `bisbeard-meta.json` — classes, specs, pesos de atributos (`defaultWeights`),
  regras de equipamento e roles, extraídos do bundle do BisBeard.
- `bisbeard-items-p1.json` — banco de itens da Fase 1 (manifest público em
  `https://gear-planner-api.bisbeard.workers.dev/api/data/manifest?reader=2`).

Scripts (Node ≥ 20):

```bash
node tools/scrape/ascension-logs.mjs  # reextrai tools/data/raw/{ascensionlogs-data,boss-stats-raw,zg-bosses-meta}.json
node tools/scrape/bisbeard.mjs        # reextrai tools/data/raw/{bisbeard-meta,bisbeard-items-p1}.json
node tools/scrape/sanity-check.mjs    # confere se a extração veio completa antes de gerar/publicar
node tools/build-data.mjs             # gera public/data/{classes,stats}.json, public/data/bis/*.json e public/data/boss-stats/*.json
node tools/download-icons.mjs         # baixa os ícones referenciados para public/icons/
```

### Atualização automática

As APIs dos sites ficam atrás de Cloudflare e bloqueiam clientes HTTP simples
(curl, fetch de servidor) — só funcionam executando `fetch()` de dentro do
próprio domínio. Os scripts em `tools/scrape/` resolvem isso rodando um
Chromium headless (Playwright) que navega até cada site e roda a extração de
dentro do navegador.

O workflow [`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml)
roda esse pipeline completo automaticamente **a cada 2 dias** (ou a qualquer
momento via aba *Actions* → *Atualizar dados do site* → *Run workflow*):
extrai os dois sites → checa se os dados vieram completos (`sanity-check.mjs`,
aborta sem commitar se algo vier muito incompleto) → gera `public/data/` →
baixa ícones novos → builda o site como verificação final → commita e envia
pro `main` só se algo realmente mudou. Cada push no `main` já dispara o
redeploy automático na Vercel, então a atualização fica de ponta a ponta sem
intervenção manual.

> Os nomes dos arquivos JS do BisBeard mudam a cada deploy deles
> (`realmDataCoa-<hash>.js` etc.) — `tools/scrape/bisbeard.mjs` descobre a URL
> atual observando a rede da página em vez de fixar o nome. As funções
> internas que ele chama (sincronizar itens, ler itens) também têm nomes
> minificados que podem mudar; o script tenta pelo nome conhecido hoje e cai
> pra uma busca heurística (por assinatura/formato do retorno) se não bater.
> Se o BisBeard mudar a estrutura do app de um jeito mais profundo, o
> workflow falha alto (não commita dado quebrado) e precisa de ajuste manual
> no script.

## Cálculo dos tiers

Para cada filtro (conteúdo × dificuldade × função), a pontuação de cada spec é a
**mediana** dos parses (ou o **p95** no modo "Topo"), normalizada pela melhor
spec: S ≥ 85 %, A ≥ 68 %, B ≥ 50 %, C ≥ 32 %, D < 32 %. Specs com menos de 5
parses recebem o aviso ⚠ (amostra pequena).

O filtro "Perfil de Dano" (Geral/Single-Alvo/AoE) usa o parâmetro `damageMode`
da API do AscensionLogs pra isolar dano só-no-boss de dano em adds/trash —
specs cujo p95 é muito maior que a mediana no perfil "Geral" (≥ 2,5×, geralmente
por causa de fases com AoE) recebem o aviso 🔥.

## Cálculo do BIS

Cada item recebe `soma(atributo × peso da spec)` usando os pesos oficiais do
BisBeard (incluindo DPS de arma, extraído da descrição do item), respeitando as
permissões de armadura/arma de cada classe. Itens de PvP/Bloodforged são
excluídos e variantes (dificuldade/afixo) são agrupadas pela melhor versão.
