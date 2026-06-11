# SYNTHEA BR — Pesquisa Quantitativa com População Sintética Georreferenciada do Brasil

WebApp corporativo (estilo Palantir/BCG) para pesquisa quantitativa sobre uma **população sintética de 100.000 indivíduos brasileiros**, com mapa interativo, simulação de respostas por IA (Claude) e geração automática de insights estratégicos.

> 100% estático — funciona direto no **GitHub Pages**, sem backend e sem banco de dados.

## Funcionalidades

| Painel | Conteúdo |
|---|---|
| **Esquerdo (25%)** | Pergunta em linguagem natural, contexto adicional, histórico de consultas |
| **Central (45%)** | Mapa do Brasil (Leaflet) com **clusters, heatmap e pontos**; zoom nacional → estadual → municipal; card completo do indivíduo ao clicar; 8 filtros combináveis acima do mapa |
| **Direito (30%)** | S1 Resumo Executivo (KPIs) · S2 Pesquisa Quantitativa (distribuição % + gráficos interativos: barras, pizza, histograma, treemap, geografia) · S3 Insights de IA (top 5 insights, oportunidades, riscos, recomendações, narrativa executiva) |

Extras: dark/light mode, cache local de consultas, exportação **Excel / PDF / PowerPoint**, modo demonstração sem chave de API.

## Modelo de dados

`data/populacao.json` (≈5 MB) contém 100.000 indivíduos em formato colunar compacto (catálogos + linhas), gerados deterministicamente por `scripts/gerar_populacao.mjs`. Cada indivíduo possui:

```
id, nome_sintetico, idade, sexo, estado_civil, escolaridade, renda_mensal,
regiao, estado, cidade (com lat/lng), persona, segmento_bancario,
score_digital, score_financeiro, comportamentos[], preferencias[]
```

As distribuições são correlacionadas de forma plausível (idade × escolaridade × renda × persona × segmento; personas Agro concentradas em municípios de perfil agro etc.). Para regenerar:

```bash
node scripts/gerar_populacao.mjs           # 100.000 (padrão)
node scripts/gerar_populacao.mjs 250000    # outra quantidade
```

## Camada de IA (arquitetura RAG)

Fluxo: **filtros → população → amostra estatística (400) → contexto (estatísticas agregadas + 80 indivíduos detalhados) → LLM → distribuição quantitativa → segunda chamada → insights**.

- Usa o SDK oficial `@anthropic-ai/sdk` (carregado via CDN) com *structured outputs* (JSON Schema) e *adaptive thinking*.
- Modelo padrão: `claude-opus-4-8` (configurável: Sonnet 4.6 / Haiku 4.5).
- **A chave da API fica somente no `localStorage` do navegador** — configurável e excluível no menu ⚙. Nada é exposto no repositório ou no Pages.
- **Sem chave**, a aplicação roda em **modo demonstração**: uma simulação estatística local gera distribuições e insights ilustrativos, para que o fluxo completo seja navegável.
- Resultados são cacheados no `localStorage` (chave = pergunta + contexto + filtros + modelo).

## Como publicar no GitHub Pages

1. Em **Settings → Pages**, selecione *Deploy from a branch*, branch `main` (ou a branch desejada), pasta `/ (root)`.
2. Acesse `https://<usuario>.github.io/amostra_sintetica/`.

Para rodar localmente (o `fetch` do JSON exige servidor HTTP):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Stack

- [Leaflet](https://leafletjs.com) + markercluster + leaflet.heat — mapa (tiles CARTO/OSM, sem chave)
- [ECharts](https://echarts.apache.org) — gráficos interativos
- [SheetJS](https://sheetjs.com), [jsPDF](https://github.com/parallax/jsPDF), [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) — exportações
- [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) — camada de IA
- JavaScript puro (ES Modules), sem build step

## Estrutura

```
index.html              # layout de 3 painéis
css/styles.css          # design system (dark/light)
js/app.js               # orquestração
js/data.js              # carga, decodificação, filtros, estatísticas, amostragem
js/map.js               # mapa, clusters, heatmap, popups
js/charts.js            # gráficos ECharts
js/ai.js                # camada RAG + SDK Anthropic + simulação demo + cache
js/export.js            # XLSX / PDF / PPTX
scripts/gerar_populacao.mjs  # gerador determinístico da população
data/populacao.json     # base sintética (100k indivíduos)
```

## Aviso

Todos os indivíduos, nomes e atributos são **integralmente sintéticos**, gerados por algoritmo determinístico. Nenhum dado pessoal real é utilizado. Os resultados das pesquisas são simulações estatísticas e não representam opiniões de pessoas reais.
