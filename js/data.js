/**
 * Camada de dados: carrega data/populacao.json (formato colunar),
 * decodifica indivíduos sob demanda, aplica filtros e calcula estatísticas.
 */

export const REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

export const UF_REGIAO = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export const UF_NOME = {
  AC: "Acre", AP: "Amapá", AM: "Amazonas", PA: "Pará", RO: "Rondônia", RR: "Roraima", TO: "Tocantins",
  AL: "Alagoas", BA: "Bahia", CE: "Ceará", MA: "Maranhão", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", RN: "Rio Grande do Norte", SE: "Sergipe",
  DF: "Distrito Federal", GO: "Goiás", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  ES: "Espírito Santo", MG: "Minas Gerais", RJ: "Rio de Janeiro", SP: "São Paulo",
  PR: "Paraná", RS: "Rio Grande do Sul", SC: "Santa Catarina",
};

export const FAIXAS_ETARIAS = [
  { rotulo: "18-25", min: 18, max: 25 },
  { rotulo: "26-35", min: 26, max: 35 },
  { rotulo: "36-45", min: 36, max: 45 },
  { rotulo: "46-60", min: 46, max: 60 },
  { rotulo: "60+", min: 61, max: 200 },
];

export const FAIXAS_RENDA = [
  { rotulo: "Até R$ 2 mil", min: 0, max: 2000 },
  { rotulo: "R$ 2 mil a R$ 5 mil", min: 2000.01, max: 5000 },
  { rotulo: "R$ 5 mil a R$ 10 mil", min: 5000.01, max: 10000 },
  { rotulo: "R$ 10 mil a R$ 20 mil", min: 10000.01, max: 20000 },
  { rotulo: "Acima de R$ 20 mil", min: 20000.01, max: Infinity },
];

// índices das colunas em rows[i]
export const COL = {
  NOME: 0, SOBRENOME: 1, IDADE: 2, SEXO: 3, CIVIL: 4, ESC: 5, RENDA: 6,
  CIDADE: 7, PERSONA: 8, SEGMENTO: 9, SCORE_DIG: 10, SCORE_FIN: 11,
  LAT_J: 12, LNG_J: 13, COMP: 14, PREF: 15,
};

let db = null; // { meta, catalogos, rows }

export async function carregarBase() {
  const resp = await fetch("data/populacao.json");
  if (!resp.ok) throw new Error(`Falha ao carregar a base (HTTP ${resp.status})`);
  db = await resp.json();
  return db;
}

export function base() { return db; }

export function faixaEtariaIdx(idade) {
  for (let i = 0; i < FAIXAS_ETARIAS.length; i++) {
    if (idade <= FAIXAS_ETARIAS[i].max) return i;
  }
  return FAIXAS_ETARIAS.length - 1;
}

export function faixaRendaIdx(renda) {
  for (let i = 0; i < FAIXAS_RENDA.length; i++) {
    if (renda <= FAIXAS_RENDA[i].max) return i;
  }
  return FAIXAS_RENDA.length - 1;
}

/** Decodifica um indivíduo completo a partir do índice da linha. */
export function individuo(i) {
  const r = db.rows[i];
  const c = db.catalogos;
  const cid = c.cidades[r[COL.CIDADE]];
  const nomes = r[COL.SEXO] === 1 ? c.nomes_f : c.nomes_m;
  const comp = [], pref = [];
  for (let b = 0; b < c.comportamentos.length; b++) if (r[COL.COMP] & (1 << b)) comp.push(c.comportamentos[b]);
  for (let b = 0; b < c.preferencias.length; b++) if (r[COL.PREF] & (1 << b)) pref.push(c.preferencias[b]);
  return {
    id: i + 1,
    nome_sintetico: `${nomes[r[COL.NOME]]} ${c.sobrenomes[r[COL.SOBRENOME]]}`,
    idade: r[COL.IDADE],
    sexo: c.sexos[r[COL.SEXO]],
    estado_civil: c.estados_civis[r[COL.CIVIL]],
    escolaridade: c.escolaridades[r[COL.ESC]],
    renda_mensal: r[COL.RENDA],
    cidade: cid[0],
    estado: cid[1],
    regiao: UF_REGIAO[cid[1]],
    persona: c.personas[r[COL.PERSONA]],
    segmento_bancario: c.segmentos[r[COL.SEGMENTO]],
    score_digital: r[COL.SCORE_DIG],
    score_financeiro: r[COL.SCORE_FIN],
    lat: cid[2] + r[COL.LAT_J] / 1e4,
    lng: cid[3] + r[COL.LNG_J] / 1e4,
    comportamentos: comp,
    preferencias: pref,
  };
}

export function coordenadas(i) {
  const r = db.rows[i];
  const cid = db.catalogos.cidades[r[COL.CIDADE]];
  return [cid[2] + r[COL.LAT_J] / 1e4, cid[3] + r[COL.LNG_J] / 1e4];
}

/**
 * Aplica filtros e devolve os índices das linhas correspondentes.
 * filtros: { regioes:Set, estados:Set, faixasIdade:Set, civis:Set,
 *            faixasRenda:Set, escolaridades:Set, personas:Set, segmentos:Set }
 * Conjuntos vazios = sem restrição naquela dimensão.
 */
export function filtrar(f) {
  const rows = db.rows;
  const cidades = db.catalogos.cidades;
  const out = [];
  const usaRegiao = f.regioes.size > 0;
  const usaEstado = f.estados.size > 0;
  const usaIdade = f.faixasIdade.size > 0;
  const usaCivil = f.civis.size > 0;
  const usaRenda = f.faixasRenda.size > 0;
  const usaEsc = f.escolaridades.size > 0;
  const usaPersona = f.personas.size > 0;
  const usaSeg = f.segmentos.size > 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const uf = cidades[r[COL.CIDADE]][1];
    if (usaEstado && !f.estados.has(uf)) continue;
    if (usaRegiao && !f.regioes.has(UF_REGIAO[uf])) continue;
    if (usaIdade && !f.faixasIdade.has(faixaEtariaIdx(r[COL.IDADE]))) continue;
    if (usaCivil && !f.civis.has(r[COL.CIVIL])) continue;
    if (usaRenda && !f.faixasRenda.has(faixaRendaIdx(r[COL.RENDA]))) continue;
    if (usaEsc && !f.escolaridades.has(r[COL.ESC])) continue;
    if (usaPersona && !f.personas.has(r[COL.PERSONA])) continue;
    if (usaSeg && !f.segmentos.has(r[COL.SEGMENTO])) continue;
    out.push(i);
  }
  return out;
}

/** Estatísticas agregadas de um conjunto de índices (para resumo + contexto do LLM). */
export function estatisticas(indices) {
  const c = db.catalogos;
  const rows = db.rows;
  const contagem = (n) => new Array(n).fill(0);
  const porRegiao = {}; REGIOES.forEach((r) => (porRegiao[r] = 0));
  const porEstado = {};
  const porPersona = contagem(c.personas.length);
  const porSegmento = contagem(c.segmentos.length);
  const porFaixaIdade = contagem(FAIXAS_ETARIAS.length);
  const porFaixaRenda = contagem(FAIXAS_RENDA.length);
  const porCivil = contagem(c.estados_civis.length);
  const porEsc = contagem(c.escolaridades.length);
  const porSexo = contagem(2);
  let somaRenda = 0, somaIdade = 0, somaDig = 0, somaFin = 0;

  for (const i of indices) {
    const r = rows[i];
    const uf = c.cidades[r[COL.CIDADE]][1];
    porRegiao[UF_REGIAO[uf]]++;
    porEstado[uf] = (porEstado[uf] || 0) + 1;
    porPersona[r[COL.PERSONA]]++;
    porSegmento[r[COL.SEGMENTO]]++;
    porFaixaIdade[faixaEtariaIdx(r[COL.IDADE])]++;
    porFaixaRenda[faixaRendaIdx(r[COL.RENDA])]++;
    porCivil[r[COL.CIVIL]]++;
    porEsc[r[COL.ESC]]++;
    porSexo[r[COL.SEXO]]++;
    somaRenda += r[COL.RENDA];
    somaIdade += r[COL.IDADE];
    somaDig += r[COL.SCORE_DIG];
    somaFin += r[COL.SCORE_FIN];
  }

  const n = indices.length || 1;
  const modaIdx = (arr) => arr.indexOf(Math.max(...arr));
  const regiaoPred = Object.entries(porRegiao).sort((a, b) => b[1] - a[1])[0];

  return {
    total: indices.length,
    rendaMedia: Math.round(somaRenda / n),
    idadeMedia: Math.round(somaIdade / n),
    scoreDigitalMedio: Math.round(somaDig / n),
    scoreFinanceiroMedio: Math.round(somaFin / n),
    porRegiao, porEstado,
    porPersona: c.personas.map((p, i) => [p, porPersona[i]]),
    porSegmento: c.segmentos.map((s, i) => [s, porSegmento[i]]),
    porFaixaIdade: FAIXAS_ETARIAS.map((f, i) => [f.rotulo, porFaixaIdade[i]]),
    porFaixaRenda: FAIXAS_RENDA.map((f, i) => [f.rotulo, porFaixaRenda[i]]),
    porEstadoCivil: c.estados_civis.map((e, i) => [e, porCivil[i]]),
    porEscolaridade: c.escolaridades.map((e, i) => [e, porEsc[i]]),
    porSexo: c.sexos.map((s, i) => [s, porSexo[i]]),
    personaPredominante: c.personas[modaIdx(porPersona)],
    segmentoPredominante: c.segmentos[modaIdx(porSegmento)],
    faixaIdadePredominante: FAIXAS_ETARIAS[modaIdx(porFaixaIdade)].rotulo,
    regiaoPredominante: regiaoPred ? regiaoPred[0] : "—",
  };
}

/** Amostra estatística reproduzível (estratificação implícita por embaralhamento determinístico). */
export function amostrar(indices, tamanho) {
  if (indices.length <= tamanho) return [...indices];
  // LCG determinístico para reprodutibilidade da amostra
  let seed = 1234567 + indices.length;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const copia = [...indices];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, tamanho);
}
