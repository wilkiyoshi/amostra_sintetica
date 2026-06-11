/**
 * Camada de IA (arquitetura RAG):
 *  filtros -> população -> amostra estatística -> contexto -> LLM -> resultados -> insights.
 *
 * Usa o SDK oficial @anthropic-ai/sdk (carregado sob demanda via CDN ESM) com a
 * chave do usuário armazenada no localStorage. Sem chave, executa uma simulação
 * estatística local (modo demonstração) para que a aplicação funcione no GitHub Pages.
 */
import { individuo, amostrar, REGIOES } from "./data.js";

const LS_KEY = "synthea.apikey";
const LS_MODEL = "synthea.model";
const CACHE_PREFIX = "synthea.cache.";
const SDK_URL = "https://esm.sh/@anthropic-ai/sdk@0.78.0";
const TAMANHO_AMOSTRA = 400;   // respondentes simulados
const AMOSTRA_CONTEXTO = 80;   // indivíduos enviados em detalhe ao LLM

let sdkPromise = null;

export function obterChave() { return localStorage.getItem(LS_KEY) || ""; }
export function salvarChave(k) { localStorage.setItem(LS_KEY, k.trim()); }
export function excluirChave() { localStorage.removeItem(LS_KEY); }
export function obterModelo() { return localStorage.getItem(LS_MODEL) || "claude-opus-4-8"; }
export function salvarModelo(m) { localStorage.setItem(LS_MODEL, m); }
export function temChave() { return obterChave().length > 10; }

export function limparCache() {
  const remover = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) remover.push(k);
  }
  remover.forEach((k) => localStorage.removeItem(k));
  return remover.length;
}

function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function chaveCache(pergunta, contexto, assinaturaFiltros, modo) {
  return CACHE_PREFIX + hashString([pergunta, contexto, assinaturaFiltros, modo, obterModelo()].join("|"));
}

async function clienteAnthropic() {
  if (!sdkPromise) sdkPromise = import(SDK_URL);
  const { default: Anthropic } = await sdkPromise;
  return new Anthropic({ apiKey: obterChave(), dangerouslyAllowBrowser: true });
}

// ---------------------------------------------------------------- contexto RAG
function construirContexto(stats, indicesAmostra, pergunta, contextoExtra) {
  const fmtDist = (pares) => {
    const total = pares.reduce((s, [, v]) => s + v, 0) || 1;
    return pares
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${((v / total) * 100).toFixed(1)}%`)
      .join("; ");
  };

  const amostraDetalhada = indicesAmostra.slice(0, AMOSTRA_CONTEXTO).map((i) => {
    const p = individuo(i);
    return `#${p.id} ${p.sexo[0]}${p.idade} ${p.estado_civil} ${p.escolaridade} R$${p.renda_mensal} ` +
      `${p.cidade}/${p.estado} persona=${p.persona} seg=${p.segmento_bancario} ` +
      `dig=${p.score_digital} fin=${p.score_financeiro} prefs=[${p.preferencias.join(", ")}] ` +
      `comp=[${p.comportamentos.join(", ")}]`;
  }).join("\n");

  return `## População sintética selecionada (Brasil)
Total filtrado: ${stats.total.toLocaleString("pt-BR")} indivíduos. Amostra de respondentes: ${Math.min(stats.total, TAMANHO_AMOSTRA)}.
Idade média: ${stats.idadeMedia} | Renda média mensal: R$ ${stats.rendaMedia.toLocaleString("pt-BR")}
Score digital médio: ${stats.scoreDigitalMedio}/1000 | Score financeiro médio: ${stats.scoreFinanceiroMedio}/1000

### Distribuições da população filtrada
Regiões: ${fmtDist(Object.entries(stats.porRegiao))}
Faixas etárias: ${fmtDist(stats.porFaixaIdade)}
Renda: ${fmtDist(stats.porFaixaRenda)}
Estado civil: ${fmtDist(stats.porEstadoCivil)}
Escolaridade: ${fmtDist(stats.porEscolaridade)}
Personas: ${fmtDist(stats.porPersona)}
Segmentos bancários: ${fmtDist(stats.porSegmento)}
Sexo: ${fmtDist(stats.porSexo)}

### Amostra detalhada de indivíduos (${Math.min(indicesAmostra.length, AMOSTRA_CONTEXTO)} de ${indicesAmostra.length})
${amostraDetalhada}

## Pergunta da pesquisa
"${pergunta}"
${contextoExtra ? `\n## Contexto adicional do pesquisador\n${contextoExtra}` : ""}`;
}

// ---------------------------------------------------------------- schemas
const SCHEMA_QUANT = {
  type: "object",
  properties: {
    opcoes: {
      type: "array",
      description: "3 a 6 opções de resposta mutuamente exclusivas adequadas à pergunta",
      items: { type: "string" },
    },
    distribuicao: {
      type: "array",
      description: "Percentual de respondentes por opção; soma deve ser 100",
      items: {
        type: "object",
        properties: { rotulo: { type: "string" }, percentual: { type: "number" } },
        required: ["rotulo", "percentual"],
        additionalProperties: false,
      },
    },
    por_regiao: {
      type: "array",
      description: "Distribuição percentual por região brasileira presente na população",
      items: {
        type: "object",
        properties: {
          regiao: { type: "string" },
          distribuicao: {
            type: "array",
            items: {
              type: "object",
              properties: { rotulo: { type: "string" }, percentual: { type: "number" } },
              required: ["rotulo", "percentual"],
              additionalProperties: false,
            },
          },
        },
        required: ["regiao", "distribuicao"],
        additionalProperties: false,
      },
    },
    resumo: { type: "string", description: "Síntese de 2-3 frases dos resultados quantitativos" },
  },
  required: ["opcoes", "distribuicao", "por_regiao", "resumo"],
  additionalProperties: false,
};

const SCHEMA_INSIGHTS = {
  type: "object",
  properties: {
    principais_insights: { type: "array", description: "Top 5 descobertas", items: { type: "string" } },
    oportunidades: { type: "array", description: "Oportunidades de produtos e serviços", items: { type: "string" } },
    riscos: { type: "array", description: "Principais riscos observados", items: { type: "string" } },
    recomendacoes: { type: "array", description: "Ações para marketing, CRM e produtos", items: { type: "string" } },
    narrativa: { type: "string", description: "Narrativa executiva de 1 parágrafo" },
  },
  required: ["principais_insights", "oportunidades", "riscos", "recomendacoes", "narrativa"],
  additionalProperties: false,
};

function extrairJson(resposta) {
  if (resposta.stop_reason === "refusal") {
    throw new Error("O modelo recusou a solicitação. Reformule a pergunta da pesquisa.");
  }
  const bloco = resposta.content.find((b) => b.type === "text");
  if (!bloco) throw new Error("Resposta do modelo sem conteúdo de texto.");
  return JSON.parse(bloco.text);
}

// ---------------------------------------------------------------- chamadas LLM
async function pesquisaQuantitativaLLM(contextoRag) {
  const client = await clienteAnthropic();
  const resposta = await client.messages.create({
    model: obterModelo(),
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "Você é um motor de simulação de pesquisa quantitativa. Recebe o perfil estatístico de uma " +
      "população sintética brasileira e uma pergunta de pesquisa. Simule como essa população " +
      "responderia, respeitando rigorosamente as distribuições demográficas, socioeconômicas e " +
      "comportamentais fornecidas. As respostas devem ser plausíveis para o contexto brasileiro " +
      "e coerentes entre regiões (variações regionais realistas, não aleatórias). " +
      "Os percentuais da distribuição geral devem somar 100.",
    messages: [{ role: "user", content: contextoRag }],
    output_config: { format: { type: "json_schema", schema: SCHEMA_QUANT } },
  });
  return extrairJson(resposta);
}

async function insightsLLM(contextoRag, resultadoQuant) {
  const client = await clienteAnthropic();
  const resposta = await client.messages.create({
    model: obterModelo(),
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "Você é um estrategista sênior de uma consultoria (perfil McKinsey/BCG) especializado em " +
      "serviços financeiros no Brasil. A partir dos resultados de uma pesquisa quantitativa com " +
      "população sintética, produza insights acionáveis, específicos e não genéricos, " +
      "citando números da pesquisa sempre que possível. Escreva em português do Brasil.",
    messages: [{
      role: "user",
      content: `${contextoRag}\n\n## Resultados quantitativos da pesquisa\n${JSON.stringify(resultadoQuant, null, 2)}\n\nGere a análise estratégica.`,
    }],
    output_config: { format: { type: "json_schema", schema: SCHEMA_INSIGHTS } },
  });
  return extrairJson(resposta);
}

// ---------------------------------------------------------------- simulação local (demo)
function rngDeterministico(semente) {
  let s = 0;
  for (let i = 0; i < semente.length; i++) s = (s * 31 + semente.charCodeAt(i)) | 0;
  s = s >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function opcoesParaPergunta(pergunta) {
  const q = pergunta.toLowerCase();
  if (/(intenção|pretende|planeja|vai (investir|comprar|contratar))/.test(q))
    return ["Sim, com certeza", "Provavelmente sim", "Indeciso", "Provavelmente não", "Não pretende"];
  if (/(desafio|dificuldade|problema|barreira)/.test(q))
    return ["Endividamento", "Renda insuficiente", "Falta de reserva de emergência", "Custo de moradia", "Educação financeira"];
  if (/(confia|confiança|segurança)/.test(q))
    return ["Confia totalmente", "Confia parcialmente", "Neutro", "Desconfia", "Não confia"];
  return ["Concorda", "Parcialmente de acordo", "Neutro", "Discorda"];
}

function normalizar100(valores) {
  const soma = valores.reduce((a, b) => a + b, 0);
  const pct = valores.map((v) => Math.round((v / soma) * 1000) / 10);
  const diff = Math.round((100 - pct.reduce((a, b) => a + b, 0)) * 10) / 10;
  pct[0] = Math.round((pct[0] + diff) * 10) / 10;
  return pct;
}

function simulacaoLocal(pergunta, contextoExtra, stats) {
  const rng = rngDeterministico(pergunta + "|" + contextoExtra + "|" + stats.total);
  const opcoes = opcoesParaPergunta(pergunta);

  // pesos influenciados pelo perfil da população (renda/score deslocam o otimismo)
  const otimismo = Math.min(1.6, Math.max(0.5, stats.scoreFinanceiroMedio / 520));
  const pesos = opcoes.map((_, i) => {
    const decaimento = Math.pow(otimismo, opcoes.length - 1 - i);
    return (0.6 + rng() * 1.3) * decaimento + 0.25;
  });
  const pct = normalizar100(pesos);
  const distribuicao = opcoes.map((rotulo, i) => ({ rotulo, percentual: pct[i] }));

  const regioesPresentes = REGIOES.filter((r) => stats.porRegiao[r] > 0);
  const por_regiao = regioesPresentes.map((regiao) => {
    const variados = pct.map((v) => Math.max(1, v * (0.78 + rng() * 0.45)));
    const pctR = normalizar100(variados);
    return { regiao, distribuicao: opcoes.map((rotulo, i) => ({ rotulo, percentual: pctR[i] })) };
  });

  const lider = distribuicao.slice().sort((a, b) => b.percentual - a.percentual)[0];
  return {
    opcoes,
    distribuicao,
    por_regiao,
    resumo:
      `Na simulação local (modo demonstração), "${lider.rotulo}" lidera com ${lider.percentual}% das respostas. ` +
      `O perfil da população filtrada (renda média R$ ${stats.rendaMedia.toLocaleString("pt-BR")}, ` +
      `idade média ${stats.idadeMedia} anos) influencia diretamente esta distribuição. ` +
      `Configure uma chave da API Anthropic para respostas simuladas por IA.`,
  };
}

function insightsLocais(pergunta, stats, resultado) {
  const lider = resultado.distribuicao.slice().sort((a, b) => b.percentual - a.percentual)[0];
  const persona = stats.personaPredominante;
  const regiao = stats.regiaoPredominante;
  return {
    principais_insights: [
      `"${lider.rotulo}" concentra ${lider.percentual}% das respostas na população filtrada.`,
      `O perfil predominante é "${persona}" na faixa ${stats.faixaIdadePredominante}, concentrado na região ${regiao}.`,
      `A renda média de R$ ${stats.rendaMedia.toLocaleString("pt-BR")} posiciona o grupo no segmento ${stats.segmentoPredominante}.`,
      `Score digital médio de ${stats.scoreDigitalMedio}/1000 indica o grau de maturidade digital do público.`,
      `Score financeiro médio de ${stats.scoreFinanceiroMedio}/1000 sugere o apetite de crédito e investimento do grupo.`,
    ],
    oportunidades: [
      `Desenhar oferta dirigida à persona "${persona}" com comunicação regionalizada para ${regiao}.`,
      `Explorar canais digitais ${stats.scoreDigitalMedio > 550 ? "como canal principal" : "com apoio de atendimento humano"} dado o score digital do grupo.`,
      `Criar jornada específica para o segmento ${stats.segmentoPredominante}, que domina a base filtrada.`,
    ],
    riscos: [
      `Generalizar os resultados sem considerar variações regionais pode distorcer decisões de portfólio.`,
      `Modo demonstração: distribuição gerada por heurística local, sem inferência de IA — use apenas para explorar a ferramenta.`,
    ],
    recomendacoes: [
      `Refinar a pesquisa com filtros mais específicos (persona + faixa de renda) antes de decisões de produto.`,
      `Configurar a chave da API Anthropic para obter simulação por IA e insights estratégicos completos.`,
      `Exportar o relatório executivo (PDF/PPTX) para discussão com as áreas de marketing e CRM.`,
    ],
    narrativa:
      `Pesquisa executada em modo demonstração sobre ${stats.total.toLocaleString("pt-BR")} indivíduos sintéticos. ` +
      `A população filtrada é majoritariamente da região ${regiao}, com perfil "${persona}" e renda média de ` +
      `R$ ${stats.rendaMedia.toLocaleString("pt-BR")}. Para a pergunta "${pergunta}", a opção "${lider.rotulo}" ` +
      `lidera com ${lider.percentual}%. Os números desta simulação local servem para demonstrar o fluxo da ` +
      `plataforma; com a chave de API configurada, as respostas passam a ser simuladas pelo modelo Claude ` +
      `considerando todo o contexto demográfico e comportamental da amostra.`,
  };
}

// ---------------------------------------------------------------- orquestração
/**
 * Executa o fluxo completo da pesquisa.
 * @returns {Promise<{quant, insights, modo: "llm"|"demo", cacheHit: boolean}>}
 */
export async function executarPesquisa({ pergunta, contextoExtra, indicesFiltrados, stats, assinaturaFiltros, aoProgresso }) {
  const modo = temChave() ? "llm" : "demo";
  const kCache = chaveCache(pergunta, contextoExtra, assinaturaFiltros, modo);

  const emCache = localStorage.getItem(kCache);
  if (emCache) {
    try { return { ...JSON.parse(emCache), modo, cacheHit: true }; }
    catch { localStorage.removeItem(kCache); }
  }

  const indicesAmostra = amostrar(indicesFiltrados, TAMANHO_AMOSTRA);

  let quant, insights;
  if (modo === "llm") {
    const contextoRag = construirContexto(stats, indicesAmostra, pergunta, contextoExtra);
    aoProgresso?.("Simulando respostas da população (1/2)…");
    quant = await pesquisaQuantitativaLLM(contextoRag);
    aoProgresso?.("Gerando insights estratégicos (2/2)…");
    insights = await insightsLLM(contextoRag, quant);
  } else {
    aoProgresso?.("Executando simulação local (demo)…");
    await new Promise((r) => setTimeout(r, 600)); // feedback visual
    quant = simulacaoLocal(pergunta, contextoExtra, stats);
    insights = insightsLocais(pergunta, stats, quant);
  }

  const payload = { quant, insights };
  try { localStorage.setItem(kCache, JSON.stringify(payload)); } catch { /* quota cheia: ignora */ }
  return { ...payload, modo, cacheHit: false };
}
