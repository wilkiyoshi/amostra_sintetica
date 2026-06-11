#!/usr/bin/env node
/**
 * Gerador da população sintética brasileira (100.000 indivíduos).
 * Saída: data/populacao.json em formato colunar compacto (catálogos + linhas).
 *
 * Uso: node scripts/gerar_populacao.mjs [quantidade]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOTAL = Number(process.argv[2] || 100000);

// ---------------------------------------------------------------- PRNG seedado
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260611);
const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function pickWeighted(items, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------- Catálogos
const NOMES_M = ["Miguel","Arthur","Heitor","Bernardo","Davi","Lucas","Gabriel","Pedro","Matheus","Rafael","Enzo","Guilherme","Gustavo","Felipe","Nicolas","Samuel","João","Vitor","Daniel","Henrique","Murilo","Eduardo","Caio","Bruno","Leonardo","Vinícius","Thiago","André","Carlos","Paulo","Marcos","Antônio","Francisco","Roberto","Ricardo","Fernando","Rodrigo","Marcelo","Alexandre","Diego","Sérgio","Cláudio","José","Luiz","Otávio","Renato","Igor","Fábio","Júlio","Wagner"];
const NOMES_F = ["Helena","Alice","Laura","Manuela","Valentina","Sophia","Isabella","Heloísa","Luiza","Júlia","Lorena","Lívia","Maria","Cecília","Eloá","Giovanna","Beatriz","Mariana","Gabriela","Rafaela","Camila","Amanda","Letícia","Larissa","Natália","Bruna","Carolina","Fernanda","Patrícia","Aline","Juliana","Vanessa","Priscila","Renata","Simone","Adriana","Cristina","Mônica","Sandra","Tatiane","Débora","Elaine","Rosana","Silvia","Vera","Clara","Marina","Bianca","Paula","Tereza"];
const SOBRENOMES = ["Silva","Santos","Oliveira","Souza","Rodrigues","Ferreira","Alves","Pereira","Lima","Gomes","Costa","Ribeiro","Martins","Carvalho","Almeida","Lopes","Soares","Fernandes","Vieira","Barbosa","Rocha","Dias","Nascimento","Andrade","Moreira","Nunes","Marques","Machado","Mendes","Freitas","Cardoso","Ramos","Gonçalves","Santana","Teixeira","Araújo","Castro","Correia","Cavalcanti","Monteiro","Moura","Batista","Campos","Duarte","Farias","Pinto","Rezende","Tavares","Sales","Aguiar"];

const SEXOS = ["Masculino", "Feminino"];
const ESTADOS_CIVIS = ["Solteiro", "Casado", "Divorciado", "Viúvo"];
const ESCOLARIDADES = ["Fundamental", "Médio", "Técnico", "Superior", "Pós-graduação", "Mestrado", "Doutorado"];
const PERSONAS = ["Conservador", "Investidor", "Digital", "Empreendedor", "Família", "Agro", "Jovem Profissional", "Alta Renda"];
const SEGMENTOS = ["IA", "IU", "IP", "Private", "Agro", "Aposentado", "Servidor Público"];

const COMPORTAMENTOS = [
  "Usa app bancário diariamente", "Prefere atendimento presencial", "Compra online frequentemente",
  "Poupa mensalmente", "Usa cartão de crédito como principal meio", "Acompanha investimentos semanalmente",
  "Usa Pix intensivamente", "Possui dívidas em renegociação", "Contrata seguros regularmente",
  "Usa crédito consignado", "Participa de programas de pontos", "Faz orçamento familiar mensal"
];
const PREFERENCIAS = [
  "Investimentos de baixo risco", "Renda variável", "Crédito imobiliário", "Previdência privada",
  "Cartões com benefícios", "Atendimento 100% digital", "Atendimento humano personalizado",
  "Educação financeira", "Produtos de seguro", "Consórcios", "Crédito para empreender", "Cashback"
];

// Municípios: [nome, uf, lat, lng, pesoPopulacional, perfilAgro(0/1)]
const CIDADES = [
  // Norte
  ["Rio Branco","AC",-9.97,-67.81,41,0],["Cruzeiro do Sul","AC",-7.63,-72.67,9,0],
  ["Macapá","AP",0.03,-51.07,51,0],["Santana","AP",-0.06,-51.18,12,0],
  ["Manaus","AM",-3.12,-60.02,220,0],["Parintins","AM",-2.63,-56.74,11,0],["Itacoatiara","AM",-3.14,-58.44,10,0],
  ["Belém","PA",-1.46,-48.49,150,0],["Ananindeua","PA",-1.37,-48.37,53,0],["Santarém","PA",-2.44,-54.70,31,0],["Marabá","PA",-5.37,-49.12,29,0],["Castanhal","PA",-1.29,-47.92,20,0],
  ["Porto Velho","RO",-8.76,-63.90,55,1],["Ji-Paraná","RO",-10.88,-61.95,13,1],
  ["Boa Vista","RR",2.82,-60.67,44,0],
  ["Palmas","TO",-10.18,-48.33,31,1],["Araguaína","TO",-7.19,-48.21,19,1],
  // Nordeste
  ["Maceió","AL",-9.67,-35.74,103,0],["Arapiraca","AL",-9.75,-36.66,23,0],
  ["Salvador","BA",-12.97,-38.50,290,0],["Feira de Santana","BA",-12.27,-38.97,62,0],["Vitória da Conquista","BA",-14.86,-40.84,34,0],["Camaçari","BA",-12.70,-38.32,31,0],["Itabuna","BA",-14.79,-39.28,21,0],["Juazeiro","BA",-9.42,-40.50,22,1],["Ilhéus","BA",-14.79,-39.05,16,0],["Barreiras","BA",-12.15,-44.99,16,1],
  ["Fortaleza","CE",-3.72,-38.54,270,0],["Caucaia","CE",-3.74,-38.65,37,0],["Juazeiro do Norte","CE",-7.21,-39.32,28,0],["Sobral","CE",-3.69,-40.35,21,0],
  ["São Luís","MA",-2.53,-44.30,111,0],["Imperatriz","MA",-5.53,-47.48,26,0],["Caxias","MA",-4.86,-43.36,16,0],
  ["João Pessoa","PB",-7.12,-34.86,84,0],["Campina Grande","PB",-7.23,-35.88,41,0],
  ["Recife","PE",-8.05,-34.88,165,0],["Jaboatão dos Guararapes","PE",-8.11,-35.01,70,0],["Olinda","PE",-8.01,-34.85,39,0],["Caruaru","PE",-8.28,-35.98,37,0],["Petrolina","PE",-9.39,-40.50,36,1],
  ["Teresina","PI",-5.09,-42.80,87,0],["Parnaíba","PI",-2.90,-41.78,16,0],
  ["Natal","RN",-5.79,-35.21,90,0],["Mossoró","RN",-5.19,-37.34,30,0],
  ["Aracaju","SE",-10.91,-37.07,67,0],["Nossa Senhora do Socorro","SE",-10.85,-37.13,19,0],
  // Centro-Oeste
  ["Brasília","DF",-15.79,-47.88,310,0],
  ["Goiânia","GO",-16.69,-49.26,152,0],["Aparecida de Goiânia","GO",-16.82,-49.24,60,0],["Anápolis","GO",-16.33,-48.95,40,1],["Rio Verde","GO",-17.79,-50.92,25,1],["Luziânia","GO",-16.25,-47.95,22,0],
  ["Cuiabá","MT",-15.60,-56.10,65,1],["Várzea Grande","MT",-15.65,-56.13,30,1],["Rondonópolis","MT",-16.47,-54.64,25,1],["Sinop","MT",-11.86,-55.50,18,1],["Sorriso","MT",-12.55,-55.71,11,1],
  ["Campo Grande","MS",-20.44,-54.65,92,1],["Dourados","MS",-22.22,-54.81,25,1],["Três Lagoas","MS",-20.75,-51.68,13,1],
  // Sudeste
  ["Vitória","ES",-20.32,-40.34,37,0],["Vila Velha","ES",-20.33,-40.29,52,0],["Serra","ES",-20.12,-40.31,55,0],["Cariacica","ES",-20.26,-40.42,38,0],
  ["Belo Horizonte","MG",-19.92,-43.94,250,0],["Uberlândia","MG",-18.92,-48.28,72,1],["Contagem","MG",-19.93,-44.05,67,0],["Juiz de Fora","MG",-21.76,-43.35,58,0],["Betim","MG",-19.97,-44.20,44,0],["Montes Claros","MG",-16.74,-43.86,42,0],["Uberaba","MG",-19.75,-47.93,34,1],["Governador Valadares","MG",-18.85,-41.95,28,0],["Ipatinga","MG",-19.47,-42.55,23,0],["Sete Lagoas","MG",-19.46,-44.25,24,0],["Divinópolis","MG",-20.14,-44.89,24,0],["Poços de Caldas","MG",-21.78,-46.56,17,0],
  ["Rio de Janeiro","RJ",-22.91,-43.17,670,0],["São Gonçalo","RJ",-22.83,-43.05,92,0],["Duque de Caxias","RJ",-22.79,-43.31,92,0],["Nova Iguaçu","RJ",-22.76,-43.45,82,0],["Niterói","RJ",-22.88,-43.10,52,0],["Campos dos Goytacazes","RJ",-21.75,-41.32,52,0],["Petrópolis","RJ",-22.51,-43.18,31,0],["Volta Redonda","RJ",-22.52,-44.10,27,0],
  ["São Paulo","SP",-23.55,-46.63,1230,0],["Guarulhos","SP",-23.46,-46.53,140,0],["Campinas","SP",-22.91,-47.06,122,0],["São Bernardo do Campo","SP",-23.69,-46.56,85,0],["Santo André","SP",-23.66,-46.53,72,0],["Osasco","SP",-23.53,-46.79,70,0],["São José dos Campos","SP",-23.22,-45.90,74,0],["Ribeirão Preto","SP",-21.17,-47.81,72,1],["Sorocaba","SP",-23.50,-47.46,69,0],["Santos","SP",-23.96,-46.33,43,0],["Mauá","SP",-23.67,-46.46,48,0],["São José do Rio Preto","SP",-20.82,-49.38,48,1],["Piracicaba","SP",-22.72,-47.65,42,1],["Bauru","SP",-22.31,-49.06,38,0],["Jundiaí","SP",-23.19,-46.88,43,0],["Franca","SP",-20.54,-47.40,36,1],["Limeira","SP",-22.56,-47.40,31,0],["Presidente Prudente","SP",-22.13,-51.39,23,1],
  // Sul
  ["Curitiba","PR",-25.43,-49.27,195,0],["Londrina","PR",-23.31,-51.16,58,1],["Maringá","PR",-23.42,-51.93,44,1],["Ponta Grossa","PR",-25.09,-50.16,36,1],["Cascavel","PR",-24.96,-53.46,34,1],["Foz do Iguaçu","PR",-25.55,-54.59,26,0],["São José dos Pinhais","PR",-25.53,-49.21,33,0],
  ["Porto Alegre","RS",-30.03,-51.23,148,0],["Caxias do Sul","RS",-29.17,-51.18,52,1],["Pelotas","RS",-31.77,-52.34,34,1],["Canoas","RS",-29.92,-51.18,35,0],["Santa Maria","RS",-29.68,-53.81,29,1],["Gravataí","RS",-29.94,-50.99,29,0],["Novo Hamburgo","RS",-29.68,-51.13,25,0],["Passo Fundo","RS",-28.26,-52.41,21,1],
  ["Florianópolis","SC",-27.60,-48.55,54,0],["Joinville","SC",-26.30,-48.85,62,0],["Blumenau","SC",-26.92,-49.07,37,0],["Chapecó","SC",-27.10,-52.62,23,1],["Itajaí","SC",-26.91,-48.66,22,0],["Criciúma","SC",-28.68,-49.37,22,0],
];

const cidadeIdx = CIDADES.map((_, i) => i);
const cidadePesos = CIDADES.map((c) => c[4]);

// ---------------------------------------------------------------- Geração
function gerarIdade() {
  // distribuição adulta brasileira aproximada
  return pickWeighted(
    [ri(18, 25), ri(26, 35), ri(36, 45), ri(46, 60), ri(61, 85)],
    [17, 23, 21, 23, 16]
  );
}

function gerarEscolaridade(idade) {
  // mais jovens → mais escolarizados
  const jovem = idade < 40;
  return pickWeighted(
    [0, 1, 2, 3, 4, 5, 6],
    jovem ? [8, 32, 14, 30, 11, 4, 1] : [22, 34, 10, 22, 8, 3, 1]
  );
}

function gerarEstadoCivil(idade) {
  if (idade < 26) return pickWeighted([0, 1, 2, 3], [82, 16, 2, 0.2]);
  if (idade < 40) return pickWeighted([0, 1, 2, 3], [38, 52, 9, 1]);
  if (idade < 60) return pickWeighted([0, 1, 2, 3], [18, 58, 19, 5]);
  return pickWeighted([0, 1, 2, 3], [9, 52, 17, 22]);
}

function gerarRenda(esc, idade) {
  const base = [1500, 2300, 3200, 5200, 8200, 11500, 16500][esc];
  const expFactor = 1 + Math.min(Math.max(idade - 22, 0), 28) * 0.018;
  // ruído log-normal-ish
  const noise = Math.exp((rnd() + rnd() + rnd() - 1.5) * 0.55);
  let renda = base * expFactor * noise;
  if (rnd() < 0.025) renda *= ri(2, 5); // cauda de alta renda
  return Math.max(800, Math.round(renda / 10) * 10);
}

function gerarPersona(idade, esc, renda, casado, agroCidade, scoreDig) {
  const w = [10, 4, 6, 7, 8, 2, 4, 0.5]; // base
  if (renda > 20000) w[7] += 50;
  if (renda > 8000 && esc >= 3) w[1] += 25;
  if (scoreDig > 700 && idade < 45) w[2] += 30;
  if (idade >= 22 && idade <= 32 && esc >= 3) w[6] += 35;
  if (casado && idade >= 30 && idade <= 55) w[4] += 28;
  if (agroCidade) w[5] += 40;
  if (idade > 55) w[0] += 30;
  if (renda < 3000) { w[1] *= 0.2; w[7] = 0; }
  return pickWeighted([0, 1, 2, 3, 4, 5, 6, 7], w);
}

function gerarSegmento(idade, renda, persona) {
  if (persona === 5 && rnd() < 0.8) return 4;             // Agro
  if (renda > 25000 && rnd() < 0.85) return 3;            // Private
  if (idade >= 62 && rnd() < 0.6) return 5;               // Aposentado
  if (rnd() < 0.08) return 6;                             // Servidor Público
  if (renda < 4000) return 0;                             // IA
  if (renda < 10000) return 1;                            // IU
  return 2;                                               // IP
}

function gerarMask(catalogoLen, qtd, biasIdx) {
  let mask = 0, tries = 0;
  while (qtd > 0 && tries < 60) {
    tries++;
    let i;
    if (biasIdx.length && rnd() < 0.55) i = pick(biasIdx);
    else i = ri(0, catalogoLen - 1);
    if (!(mask & (1 << i))) { mask |= 1 << i; qtd--; }
  }
  return mask;
}

// vieses de comportamento/preferência por persona
const COMP_BIAS = [[1,3,11],[5,3,10],[0,6,2],[4,10,2],[11,3,8],[1,9,8],[0,6,10],[5,8,10]];
const PREF_BIAS = [[0,8,7],[1,3,7],[5,11,4],[10,4,11],[2,3,8],[9,2,0],[5,11,1],[1,3,6]];

const rows = new Array(TOTAL);
for (let n = 0; n < TOTAL; n++) {
  const sexo = rnd() < 0.515 ? 1 : 0;
  const nomeIdx = sexo === 1 ? ri(0, NOMES_F.length - 1) : ri(0, NOMES_M.length - 1);
  const sobIdx = ri(0, SOBRENOMES.length - 1);
  const idade = gerarIdade();
  const esc = gerarEscolaridade(idade);
  const ec = gerarEstadoCivil(idade);
  const renda = gerarRenda(esc, idade);
  const cIdx = pickWeighted(cidadeIdx, cidadePesos);
  const cidade = CIDADES[cIdx];
  const scoreDig = Math.max(0, Math.min(1000, Math.round(
    650 - (idade - 18) * 6 + esc * 35 + (rnd() + rnd()) * 220 - 110
  )));
  const scoreFin = Math.max(0, Math.min(1000, Math.round(
    200 + Math.log10(renda) * 170 + (rnd() + rnd()) * 160 - 160
  )));
  const persona = gerarPersona(idade, esc, renda, ec === 1, cidade[5] === 1, scoreDig);
  const seg = gerarSegmento(idade, renda, persona);
  // jitter geográfico (~ até 0.12 graus) em inteiros de 1e-4 grau
  const latJ = ri(-1200, 1200);
  const lngJ = ri(-1200, 1200);
  const comp = gerarMask(COMPORTAMENTOS.length, ri(2, 4), COMP_BIAS[persona]);
  const pref = gerarMask(PREFERENCIAS.length, ri(2, 4), PREF_BIAS[persona]);
  rows[n] = [nomeIdx, sobIdx, idade, sexo, ec, esc, renda, cIdx, persona, seg, scoreDig, scoreFin, latJ, lngJ, comp, pref];
}

const payload = {
  meta: {
    versao: 1,
    gerado_em: new Date().toISOString().slice(0, 10),
    total: TOTAL,
    descricao: "População sintética brasileira para pesquisa quantitativa. Formato: rows[i] = [nomeIdx, sobrenomeIdx, idade, sexoIdx, estadoCivilIdx, escolaridadeIdx, rendaMensal, cidadeIdx, personaIdx, segmentoIdx, scoreDigital, scoreFinanceiro, latJitter1e4, lngJitter1e4, comportamentosMask, preferenciasMask]",
  },
  catalogos: {
    nomes_m: NOMES_M, nomes_f: NOMES_F, sobrenomes: SOBRENOMES,
    sexos: SEXOS, estados_civis: ESTADOS_CIVIS, escolaridades: ESCOLARIDADES,
    personas: PERSONAS, segmentos: SEGMENTOS,
    comportamentos: COMPORTAMENTOS, preferencias: PREFERENCIAS,
    cidades: CIDADES.map((c) => [c[0], c[1], c[2], c[3]]),
  },
  rows,
};

const outDir = join(__dirname, "..", "data");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "populacao.json");
writeFileSync(outFile, JSON.stringify(payload));
console.log(`OK: ${TOTAL} indivíduos -> ${outFile} (${(JSON.stringify(payload).length / 1048576).toFixed(1)} MB)`);
