/**
 * SYNTHEA BR — orquestração da aplicação.
 */
import {
  carregarBase, base, filtrar, estatisticas,
  REGIOES, UF_NOME, UF_REGIAO, FAIXAS_ETARIAS, FAIXAS_RENDA,
} from "./data.js";
import { initMapa, renderizar as renderizarMapa, definirModo, aplicarTemaMapa } from "./map.js";
import { atualizarGraficos, renderizarGrafico, aplicarTemaGraficos, redimensionar } from "./charts.js";
import {
  executarPesquisa, temChave, obterChave, salvarChave, excluirChave,
  obterModelo, salvarModelo, limparCache,
} from "./ai.js";
import { exportarExcel, exportarPDF, exportarPPTX } from "./export.js";

const $ = (id) => document.getElementById(id);
const LS_TEMA = "synthea.tema";
const LS_HIST = "synthea.historico";

let indicesFiltrados = [];
let statsAtuais = null;
let ultimaPesquisa = null; // { pergunta, contexto, quant, insights }

// ================================================================ tema
function temaAtual() { return document.documentElement.dataset.theme; }
function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  localStorage.setItem(LS_TEMA, tema);
  aplicarTemaMapa(tema);
  aplicarTemaGraficos(tema);
}

// ================================================================ toast
let toastTimer = null;
function toast(msg, erro = false) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.toggle("error", erro);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4200);
}

// ================================================================ filtros
function preencherSelect(id, opcoes) {
  const sel = $(id);
  sel.innerHTML = opcoes
    .map((o) => `<option value="${o.valor}">${o.rotulo}</option>`)
    .join("");
}

/** (Re)monta o select de estados limitando às regiões selecionadas; preserva seleções ainda válidas. */
function atualizarEstadosPorRegiao() {
  const sel = $("f-estado");
  const regioesSel = new Set(Array.from($("f-regiao").selectedOptions).map((o) => o.value));
  const selecionados = new Set(Array.from(sel.selectedOptions).map((o) => o.value));

  const ufs = Object.keys(UF_NOME).sort().filter((uf) => regioesSel.size === 0 || regioesSel.has(UF_REGIAO[uf]));
  preencherSelect("f-estado", ufs.map((uf) => ({ valor: uf, rotulo: `${uf} — ${UF_NOME[uf]}` })));

  // reaplica seleções que continuam pertencendo às regiões filtradas
  let aindaSelecionado = false;
  Array.from(sel.options).forEach((o) => {
    if (selecionados.has(o.value)) { o.selected = true; aindaSelecionado = true; }
  });
  sel.classList.toggle("has-selection", aindaSelecionado);
}

function montarFiltros() {
  const c = base().catalogos;
  preencherSelect("f-regiao", REGIOES.map((r) => ({ valor: r, rotulo: r })));
  atualizarEstadosPorRegiao();
  preencherSelect("f-idade", FAIXAS_ETARIAS.map((f, i) => ({ valor: i, rotulo: f.rotulo })));
  preencherSelect("f-civil", c.estados_civis.map((e, i) => ({ valor: i, rotulo: e })));
  preencherSelect("f-renda", FAIXAS_RENDA.map((f, i) => ({ valor: i, rotulo: f.rotulo })));
  preencherSelect("f-escolaridade", c.escolaridades.map((e, i) => ({ valor: i, rotulo: e })));
  preencherSelect("f-persona", c.personas.map((p, i) => ({ valor: i, rotulo: p })));
  preencherSelect("f-segmento", c.segmentos.map((s, i) => ({ valor: i, rotulo: s })));

  document.querySelectorAll(".filter select").forEach((sel) => {
    sel.addEventListener("change", () => {
      // ao mudar a região, restringe os estados disponíveis antes de filtrar
      if (sel.id === "f-regiao") atualizarEstadosPorRegiao();
      sel.classList.toggle("has-selection", sel.selectedOptions.length > 0);
      aoMudarFiltros();
    });
  });

  $("btn-clear-filters").addEventListener("click", () => {
    document.querySelectorAll(".filter select").forEach((sel) => {
      Array.from(sel.options).forEach((o) => (o.selected = false));
      sel.classList.remove("has-selection");
    });
    atualizarEstadosPorRegiao(); // repõe a lista completa de estados
    aoMudarFiltros();
  });
}

function lerFiltros() {
  const valores = (id, numerico = false) =>
    new Set(Array.from($(id).selectedOptions).map((o) => (numerico ? Number(o.value) : o.value)));
  return {
    regioes: valores("f-regiao"),
    estados: valores("f-estado"),
    faixasIdade: valores("f-idade", true),
    civis: valores("f-civil", true),
    faixasRenda: valores("f-renda", true),
    escolaridades: valores("f-escolaridade", true),
    personas: valores("f-persona", true),
    segmentos: valores("f-segmento", true),
  };
}

function assinaturaFiltros(f) {
  return Object.values(f).map((set) => [...set].sort().join(",")).join("|");
}

let debounceFiltro = null;
function aoMudarFiltros() {
  clearTimeout(debounceFiltro);
  debounceFiltro = setTimeout(() => {
    const f = lerFiltros();
    indicesFiltrados = filtrar(f);
    statsAtuais = estatisticas(indicesFiltrados);
    renderizarMapa(indicesFiltrados);
    atualizarResumo();
    atualizarContador();
  }, 120);
}

function atualizarContador() {
  $("map-counter").innerHTML =
    `<strong>${indicesFiltrados.length.toLocaleString("pt-BR")}</strong> de ` +
    `${base().rows.length.toLocaleString("pt-BR")} indivíduos`;
}

// ================================================================ resumo executivo
function atualizarResumo() {
  const s = statsAtuais;
  $("kpi-pop").textContent = s.total.toLocaleString("pt-BR");
  $("kpi-resp").textContent = Math.min(s.total, 400).toLocaleString("pt-BR");
  $("kpi-perfil").textContent = s.total ? `${s.personaPredominante} · ${s.faixaIdadePredominante}` : "—";
  $("kpi-regiao").textContent = s.total ? s.regiaoPredominante : "—";
}

// ================================================================ resultados da pesquisa
function renderizarQuant(pergunta, quant) {
  $("quant-placeholder").hidden = true;
  $("quant-results").hidden = false;
  $("quant-question").textContent = `"${pergunta}"`;
  $("quant-summary").textContent = quant.resumo;

  const lista = $("dist-list");
  lista.innerHTML = quant.distribuicao
    .map((d) => `
      <div class="dist-row">
        <span class="dist-label">${d.rotulo}</span>
        <span class="dist-pct">${d.percentual}%</span>
        <div class="dist-bar-track"><div class="dist-bar-fill" style="width:0%"></div></div>
      </div>`)
    .join("");
  requestAnimationFrame(() => {
    lista.querySelectorAll(".dist-bar-fill").forEach((el, i) => {
      el.style.width = `${quant.distribuicao[i].percentual}%`;
    });
  });

  atualizarGraficos(quant, statsAtuais, temaAtual());
}

function renderizarInsights(ins) {
  $("insights-placeholder").hidden = true;
  $("insights-results").hidden = false;
  const li = (arr) => arr.map((x) => `<li>${x}</li>`).join("");
  $("ins-principais").innerHTML = li(ins.principais_insights);
  $("ins-oportunidades").innerHTML = li(ins.oportunidades);
  $("ins-riscos").innerHTML = li(ins.riscos);
  $("ins-recomendacoes").innerHTML = li(ins.recomendacoes);
  $("ins-narrativa").textContent = ins.narrativa;
}

// ================================================================ histórico
function lerHistorico() {
  try { return JSON.parse(localStorage.getItem(LS_HIST) || "[]"); } catch { return []; }
}
function gravarHistorico(pergunta, contexto) {
  const h = lerHistorico().filter((x) => x.pergunta !== pergunta);
  h.unshift({ pergunta, contexto, quando: Date.now() });
  localStorage.setItem(LS_HIST, JSON.stringify(h.slice(0, 12)));
  renderizarHistorico();
}
function renderizarHistorico() {
  const h = lerHistorico();
  const ul = $("history-list");
  if (!h.length) {
    ul.innerHTML = `<li class="history-empty">Nenhuma consulta executada ainda.</li>`;
    return;
  }
  ul.innerHTML = h.map((x, i) => `<li data-i="${i}" title="${x.pergunta}">${x.pergunta}</li>`).join("");
  ul.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      const item = h[Number(li.dataset.i)];
      $("input-question").value = item.pergunta;
      $("input-context").value = item.contexto || "";
    });
  });
}

// ================================================================ execução da pesquisa
async function aoExecutar() {
  const pergunta = $("input-question").value.trim();
  const contexto = $("input-context").value.trim();
  if (!pergunta) { toast("Escreva uma pergunta de pesquisa.", true); return; }
  if (!indicesFiltrados.length) { toast("Os filtros atuais não selecionam nenhum indivíduo.", true); return; }

  const btn = $("btn-run");
  const label = btn.querySelector(".btn-label");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = true;
  spinner.hidden = false;
  const labelOriginal = label.textContent;

  try {
    const { quant, insights, modo, cacheHit } = await executarPesquisa({
      pergunta,
      contextoExtra: contexto,
      indicesFiltrados,
      stats: statsAtuais,
      assinaturaFiltros: assinaturaFiltros(lerFiltros()),
      aoProgresso: (msg) => (label.textContent = msg),
    });

    ultimaPesquisa = { pergunta, contexto, quant, insights };
    renderizarQuant(pergunta, quant);
    renderizarInsights(insights);
    gravarHistorico(pergunta, contexto);
    habilitarExports(true);

    if (cacheHit) toast("Resultado recuperado do cache local.");
    else if (modo === "demo") toast("Pesquisa executada em modo demonstração (sem IA). Configure a chave em ⚙.");
    else toast("Pesquisa concluída com simulação por IA.");
  } catch (e) {
    console.error(e);
    const msg = String(e?.message || e);
    if (/401|authentication/i.test(msg)) toast("Chave de API inválida. Verifique em ⚙ Configurações.", true);
    else if (/429|rate.?limit/i.test(msg)) toast("Limite de requisições atingido. Tente novamente em instantes.", true);
    else toast("Erro ao executar a pesquisa: " + msg, true);
  } finally {
    btn.disabled = false;
    spinner.hidden = true;
    label.textContent = labelOriginal;
  }
}

// ================================================================ exports
function habilitarExports(on) {
  ["btn-export-xlsx", "btn-export-pdf", "btn-export-pptx"].forEach((id) => ($(id).disabled = !on));
}

function dadosExport() {
  return {
    pergunta: ultimaPesquisa.pergunta,
    contexto: ultimaPesquisa.contexto,
    stats: statsAtuais,
    resultado: ultimaPesquisa.quant,
    insights: ultimaPesquisa.insights,
    indicesFiltrados,
    tema: temaAtual(),
  };
}

// ================================================================ modal de configurações
function atualizarStatusChave() {
  const status = $("key-status");
  const modeEl = $("ai-mode");
  if (temChave()) {
    status.textContent = "Chave configurada — as pesquisas usam o modelo Claude via API Anthropic.";
    status.classList.add("ok");
    modeEl.classList.add("live");
    $("ai-mode-text").textContent = `IA ativa · ${obterModelo()}`;
  } else {
    status.textContent = "Nenhuma chave configurada — a aplicação funciona em modo demonstração com simulação estatística local.";
    status.classList.remove("ok");
    modeEl.classList.remove("live");
    $("ai-mode-text").textContent = "Modo demonstração (sem chave de API)";
  }
}

function montarModal() {
  const modal = $("modal-settings");
  $("btn-settings").addEventListener("click", () => {
    $("input-apikey").value = obterChave();
    $("select-model").value = obterModelo();
    modal.hidden = false;
  });
  $("btn-close-settings").addEventListener("click", () => (modal.hidden = true));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

  $("btn-toggle-key").addEventListener("click", () => {
    const inp = $("input-apikey");
    inp.type = inp.type === "password" ? "text" : "password";
  });

  $("btn-save-key").addEventListener("click", () => {
    const k = $("input-apikey").value.trim();
    if (!k) { toast("Informe uma chave válida ou use o botão Excluir.", true); return; }
    salvarChave(k);
    salvarModelo($("select-model").value);
    atualizarStatusChave();
    modal.hidden = true;
    toast("Chave salva no navegador. IA ativada.");
  });

  $("btn-delete-key").addEventListener("click", () => {
    excluirChave();
    $("input-apikey").value = "";
    atualizarStatusChave();
    toast("Chave removida do navegador.");
  });

  $("btn-clear-cache").addEventListener("click", () => {
    const n = limparCache();
    toast(`${n} resultado(s) removido(s) do cache.`);
  });
}

// ================================================================ inicialização
async function init() {
  const temaSalvo = localStorage.getItem(LS_TEMA) || "dark";
  document.documentElement.dataset.theme = temaSalvo;

  initMapa(temaSalvo);
  montarModal();
  atualizarStatusChave();
  renderizarHistorico();
  habilitarExports(false);

  // tema
  $("btn-theme").addEventListener("click", () => {
    aplicarTema(temaAtual() === "dark" ? "light" : "dark");
  });

  // modos do mapa
  document.querySelectorAll(".map-mode-btn").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".map-mode-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      definirModo(b.dataset.mode);
    });
  });

  // abas dos gráficos
  document.querySelectorAll(".chart-tab").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".chart-tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      renderizarGrafico(b.dataset.chart);
    });
  });

  // sugestões de pergunta
  document.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => ($("input-question").value = c.dataset.q));
  });

  $("btn-run").addEventListener("click", aoExecutar);
  $("input-question").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) aoExecutar();
  });

  $("btn-clear-history").addEventListener("click", () => {
    localStorage.removeItem(LS_HIST);
    renderizarHistorico();
  });

  $("btn-export-xlsx").addEventListener("click", () => {
    try { exportarExcel(dadosExport()); } catch (e) { toast("Erro no export Excel: " + e.message, true); }
  });
  $("btn-export-pdf").addEventListener("click", () => {
    try { exportarPDF(dadosExport()); } catch (e) { toast("Erro no export PDF: " + e.message, true); }
  });
  $("btn-export-pptx").addEventListener("click", async () => {
    try { await exportarPPTX(dadosExport()); } catch (e) { toast("Erro no export PPTX: " + e.message, true); }
  });

  window.addEventListener("resize", redimensionar);

  // carga da base
  try {
    await carregarBase();
    $("status-dataset-text").textContent =
      `Base carregada · ${base().rows.length.toLocaleString("pt-BR")} indivíduos sintéticos`;
    document.querySelector(".pulse-dot").classList.add("ready");
    montarFiltros();
    aoMudarFiltros();
  } catch (e) {
    console.error(e);
    $("status-dataset-text").textContent = "Falha ao carregar a base de dados";
    toast("Não foi possível carregar data/populacao.json. Verifique a publicação.", true);
  }
}

init();
