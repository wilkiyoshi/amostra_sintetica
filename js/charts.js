/**
 * Gráficos interativos (ECharts) do painel de resultados.
 */

let chart = null;
let estadoAtual = null; // { resultado, stats, tema }
let tipoAtivo = "bar";

const CORES = ["#29d3c0", "#f2b441", "#e35d6a", "#6ea8fe", "#b07ce8", "#4fc37e", "#f08a4b", "#8b9bab"];

function paleta(tema) {
  const escuro = tema === "dark";
  return {
    texto: escuro ? "#8b9bab" : "#50616f",
    eixo: escuro ? "#2c3a4d" : "#c4ccd5",
    fundoTooltip: escuro ? "#161d26" : "#ffffff",
    bordaTooltip: escuro ? "#2c3a4d" : "#d8dee5",
    textoTooltip: escuro ? "#e6ecf2" : "#16212c",
  };
}

function baseOptions(p) {
  return {
    textStyle: { fontFamily: "IBM Plex Sans, sans-serif" },
    tooltip: {
      trigger: "item",
      backgroundColor: p.fundoTooltip,
      borderColor: p.bordaTooltip,
      textStyle: { color: p.textoTooltip, fontSize: 12 },
    },
    grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
    color: CORES,
  };
}

function optBarras(resultado, p) {
  const dist = resultado.distribuicao;
  return {
    ...baseOptions(p),
    xAxis: {
      type: "value", max: 100,
      axisLabel: { color: p.texto, formatter: "{value}%" },
      splitLine: { lineStyle: { color: p.eixo, opacity: 0.5 } },
    },
    yAxis: {
      type: "category",
      data: dist.map((d) => d.rotulo).reverse(),
      axisLabel: { color: p.texto, width: 110, overflow: "truncate" },
      axisLine: { lineStyle: { color: p.eixo } },
    },
    series: [{
      type: "bar",
      data: dist.map((d) => d.percentual).reverse(),
      barMaxWidth: 22,
      label: { show: true, position: "right", color: p.texto, formatter: "{c}%" },
      itemStyle: { borderRadius: [0, 4, 4, 0] },
    }],
    tooltip: { ...baseOptions(p).tooltip, formatter: (x) => `${x.name}: <b>${x.value}%</b>` },
  };
}

function optPizza(resultado, p) {
  return {
    ...baseOptions(p),
    legend: { bottom: 0, textStyle: { color: p.texto, fontSize: 11 }, itemWidth: 12, itemHeight: 12 },
    series: [{
      type: "pie",
      radius: ["42%", "68%"],
      center: ["50%", "44%"],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "transparent", borderWidth: 2 },
      label: { color: p.texto, fontSize: 11, formatter: "{d}%" },
      data: resultado.distribuicao.map((d) => ({ name: d.rotulo, value: d.percentual })),
    }],
    tooltip: { ...baseOptions(p).tooltip, formatter: (x) => `${x.name}: <b>${x.value}%</b>` },
  };
}

function optHistograma(stats, p) {
  return {
    ...baseOptions(p),
    title: {
      text: "Respondentes por faixa etária", left: 0,
      textStyle: { color: p.texto, fontSize: 11, fontWeight: 500 },
    },
    xAxis: {
      type: "category",
      data: stats.porFaixaIdade.map((x) => x[0]),
      axisLabel: { color: p.texto },
      axisLine: { lineStyle: { color: p.eixo } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: p.texto },
      splitLine: { lineStyle: { color: p.eixo, opacity: 0.5 } },
    },
    series: [{
      type: "bar",
      data: stats.porFaixaIdade.map((x) => x[1]),
      barMaxWidth: 36,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    }],
    tooltip: {
      ...baseOptions(p).tooltip,
      formatter: (x) => `${x.name}: <b>${Number(x.value).toLocaleString("pt-BR")}</b> indivíduos`,
    },
  };
}

function optTreemap(stats, p) {
  return {
    ...baseOptions(p),
    title: {
      text: "Composição por persona", left: 0,
      textStyle: { color: p.texto, fontSize: 11, fontWeight: 500 },
    },
    series: [{
      type: "treemap",
      top: 26, left: 0, right: 0, bottom: 0,
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { fontSize: 11, formatter: "{b}" },
      itemStyle: { borderColor: "transparent", gapWidth: 2, borderRadius: 4 },
      data: stats.porPersona
        .filter((x) => x[1] > 0)
        .map((x, i) => ({ name: x[0], value: x[1], itemStyle: { color: CORES[i % CORES.length] } })),
    }],
    tooltip: {
      ...baseOptions(p).tooltip,
      formatter: (x) => `${x.name}: <b>${Number(x.value).toLocaleString("pt-BR")}</b>`,
    },
  };
}

function optGeo(resultado, stats, p) {
  // distribuição da resposta dominante por região, ou fallback: população por região
  const porRegiao = resultado.por_regiao;
  if (porRegiao && porRegiao.length) {
    const regioes = porRegiao.map((r) => r.regiao);
    const rotulos = resultado.distribuicao.map((d) => d.rotulo);
    return {
      ...baseOptions(p),
      title: {
        text: "Distribuição das respostas por região", left: 0,
        textStyle: { color: p.texto, fontSize: 11, fontWeight: 500 },
      },
      legend: { bottom: 0, textStyle: { color: p.texto, fontSize: 10 }, itemWidth: 12, itemHeight: 12 },
      tooltip: { ...baseOptions(p).tooltip, trigger: "axis" },
      grid: { left: 8, right: 16, top: 30, bottom: 36, containLabel: true },
      xAxis: {
        type: "category", data: regioes,
        axisLabel: { color: p.texto, fontSize: 10 },
        axisLine: { lineStyle: { color: p.eixo } },
      },
      yAxis: {
        type: "value", max: 100,
        axisLabel: { color: p.texto, formatter: "{value}%" },
        splitLine: { lineStyle: { color: p.eixo, opacity: 0.5 } },
      },
      series: rotulos.map((rot) => ({
        name: rot, type: "bar", stack: "total", barMaxWidth: 34,
        data: porRegiao.map((r) => {
          const item = r.distribuicao.find((d) => d.rotulo === rot);
          return item ? item.percentual : 0;
        }),
      })),
    };
  }
  const dados = Object.entries(stats.porRegiao);
  return {
    ...baseOptions(p),
    title: {
      text: "População selecionada por região", left: 0,
      textStyle: { color: p.texto, fontSize: 11, fontWeight: 500 },
    },
    xAxis: { type: "category", data: dados.map((x) => x[0]), axisLabel: { color: p.texto, fontSize: 10 }, axisLine: { lineStyle: { color: p.eixo } } },
    yAxis: { type: "value", axisLabel: { color: p.texto }, splitLine: { lineStyle: { color: p.eixo, opacity: 0.5 } } },
    series: [{ type: "bar", data: dados.map((x) => x[1]), barMaxWidth: 34, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
  };
}

export function renderizarGrafico(tipo) {
  if (!estadoAtual) return;
  tipoAtivo = tipo;
  const { resultado, stats, tema } = estadoAtual;
  const p = paleta(tema);
  const el = document.getElementById("chart-main");
  if (!chart) chart = echarts.init(el, null, { renderer: "canvas" });

  let opt;
  switch (tipo) {
    case "pie": opt = optPizza(resultado, p); break;
    case "hist": opt = optHistograma(stats, p); break;
    case "treemap": opt = optTreemap(stats, p); break;
    case "geo": opt = optGeo(resultado, stats, p); break;
    default: opt = optBarras(resultado, p);
  }
  chart.setOption(opt, true);
  // garante que o canvas acompanhe a largura real do contêiner ao trocar de tipo
  chart.resize();
}

export function atualizarGraficos(resultado, stats, tema) {
  estadoAtual = { resultado, stats, tema };
  renderizarGrafico(tipoAtivo);
}

export function aplicarTemaGraficos(tema) {
  if (estadoAtual) { estadoAtual.tema = tema; renderizarGrafico(tipoAtivo); }
}

export function redimensionar() { if (chart) chart.resize(); }

/** Exporta o gráfico atual como dataURL PNG (para PDF/PPTX). */
export function imagemGrafico(tipo, tema) {
  if (!estadoAtual) return null;
  const anterior = tipoAtivo;
  renderizarGrafico(tipo);
  const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: tema === "dark" ? "#11161d" : "#ffffff" });
  renderizarGrafico(anterior);
  return url;
}
