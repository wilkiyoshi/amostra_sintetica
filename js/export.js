/**
 * Exportações: Excel (SheetJS), PDF (jsPDF) e PowerPoint (PptxGenJS).
 */
import { individuo } from "./data.js";
import { imagemGrafico } from "./charts.js";

const fmtBRL = (v) => "R$ " + Number(v).toLocaleString("pt-BR");
const agora = () => new Date().toLocaleString("pt-BR");

function nomeArquivo(ext) {
  const d = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `cxsi-pesquisa-${d}.${ext}`;
}

// ---------------------------------------------------------------- Excel
export function exportarExcel({ pergunta, contexto, stats, resultado, insights, indicesFiltrados }) {
  const wb = XLSX.utils.book_new();

  const resumo = [
    ["CXSI — Relatório de Pesquisa Quantitativa"],
    ["Gerado em", agora()],
    [],
    ["Pergunta", pergunta],
    ["Contexto adicional", contexto || "—"],
    [],
    ["População selecionada", stats.total],
    ["Respondentes (amostra)", Math.min(stats.total, 400)],
    ["Perfil predominante", `${stats.personaPredominante} · ${stats.faixaIdadePredominante}`],
    ["Região predominante", stats.regiaoPredominante],
    ["Renda média mensal", fmtBRL(stats.rendaMedia)],
    ["Idade média", stats.idadeMedia],
    ["Score digital médio", stats.scoreDigitalMedio],
    ["Score financeiro médio", stats.scoreFinanceiroMedio],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo Executivo");

  if (resultado) {
    const dist = [["Opção de resposta", "Percentual (%)"]];
    resultado.distribuicao.forEach((d) => dist.push([d.rotulo, d.percentual]));
    dist.push([]);
    dist.push(["Distribuição por região"]);
    (resultado.por_regiao || []).forEach((r) => {
      dist.push([r.regiao]);
      r.distribuicao.forEach((d) => dist.push(["  " + d.rotulo, d.percentual]));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dist), "Distribuição");
  }

  if (insights) {
    const ins = [["Categoria", "Item"]];
    insights.principais_insights.forEach((x) => ins.push(["Insight", x]));
    insights.oportunidades.forEach((x) => ins.push(["Oportunidade", x]));
    insights.riscos.forEach((x) => ins.push(["Risco", x]));
    insights.recomendacoes.forEach((x) => ins.push(["Recomendação", x]));
    ins.push(["Narrativa", insights.narrativa]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ins), "Insights IA");
  }

  const amostra = [[
    "id", "nome_sintetico", "idade", "sexo", "estado_civil", "escolaridade", "renda_mensal",
    "regiao", "estado", "cidade", "persona", "segmento_bancario", "score_digital", "score_financeiro",
    "comportamentos", "preferencias",
  ]];
  const limite = Math.min(indicesFiltrados.length, 2000);
  for (let k = 0; k < limite; k++) {
    const p = individuo(indicesFiltrados[k]);
    amostra.push([
      p.id, p.nome_sintetico, p.idade, p.sexo, p.estado_civil, p.escolaridade, p.renda_mensal,
      p.regiao, p.estado, p.cidade, p.persona, p.segmento_bancario, p.score_digital, p.score_financeiro,
      p.comportamentos.join("; "), p.preferencias.join("; "),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(amostra), "Amostra População");

  XLSX.writeFile(wb, nomeArquivo("xlsx"));
}

// ---------------------------------------------------------------- PDF
export function exportarPDF({ pergunta, contexto, stats, resultado, insights, tema }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16;
  let y = 0;

  const quebra = (alt = 8) => {
    if (y > 280 - alt) { doc.addPage(); y = 18; }
  };
  const titulo = (txt) => {
    quebra(12);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(236, 112, 0);
    doc.text(txt, M, y); y += 7;
    doc.setTextColor(40);
  };
  const paragrafo = (txt, tam = 10) => {
    doc.setFont("helvetica", "normal").setFontSize(tam).setTextColor(60);
    const linhas = doc.splitTextToSize(txt, W - 2 * M);
    for (const l of linhas) { quebra(6); doc.text(l, M, y); y += 5; }
    y += 2;
  };
  const lista = (itens) => {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
    for (const item of itens) {
      const linhas = doc.splitTextToSize("•  " + item, W - 2 * M - 4);
      for (let i = 0; i < linhas.length; i++) {
        quebra(6);
        doc.text(linhas[i], M + (i === 0 ? 0 : 4), y); y += 5;
      }
      y += 1;
    }
    y += 2;
  };

  // capa
  doc.setFillColor(6, 18, 31); doc.rect(0, 0, W, 64, "F");
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(236, 112, 0);
  doc.text("CXSI", M, 26);
  doc.setFontSize(13).setTextColor(230);
  doc.text("Relatório Executivo de Pesquisa Quantitativa", M, 36);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(150);
  doc.text(`População Sintética Georreferenciada do Brasil · ${agora()}`, M, 46);
  y = 78;

  titulo("Pergunta de pesquisa");
  paragrafo(`"${pergunta}"`, 11);
  if (contexto) { titulo("Contexto"); paragrafo(contexto); }

  titulo("Resumo executivo");
  lista([
    `População selecionada: ${stats.total.toLocaleString("pt-BR")} indivíduos sintéticos`,
    `Respondentes (amostra): ${Math.min(stats.total, 400)}`,
    `Perfil predominante: ${stats.personaPredominante} · faixa ${stats.faixaIdadePredominante}`,
    `Região predominante: ${stats.regiaoPredominante}`,
    `Renda média mensal: ${fmtBRL(stats.rendaMedia)} · Idade média: ${stats.idadeMedia} anos`,
  ]);

  if (resultado) {
    titulo("Distribuição das respostas");
    lista(resultado.distribuicao.map((d) => `${d.rotulo}: ${d.percentual}%`));
    paragrafo(resultado.resumo);

    const img = imagemGrafico("bar", tema);
    if (img) {
      quebra(86);
      doc.addImage(img, "PNG", M, y, W - 2 * M, 78);
      y += 84;
    }
    const imgGeo = imagemGrafico("geo", tema);
    if (imgGeo) {
      quebra(86);
      doc.addImage(imgGeo, "PNG", M, y, W - 2 * M, 78);
      y += 84;
    }
  }

  if (insights) {
    titulo("Principais insights");
    lista(insights.principais_insights);
    titulo("Oportunidades");
    lista(insights.oportunidades);
    titulo("Riscos");
    lista(insights.riscos);
    titulo("Recomendações");
    lista(insights.recomendacoes);
    titulo("Narrativa executiva");
    paragrafo(insights.narrativa);
  }

  doc.save(nomeArquivo("pdf"));
}

// ---------------------------------------------------------------- PowerPoint
export async function exportarPPTX({ pergunta, stats, resultado, insights, tema }) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";

  const ESCURO = "06121F", ACENTO = "EC7000", TEXTO = "E9EEF5", DIM = "93A5BA";

  // slide 1: capa
  let s = pptx.addSlide();
  s.background = { color: ESCURO };
  s.addText("CXSI", { x: 0.6, y: 2.2, w: 12, h: 1, fontSize: 44, bold: true, color: ACENTO, fontFace: "Arial" });
  s.addText("Pesquisa Quantitativa · População Sintética Georreferenciada do Brasil", { x: 0.6, y: 3.3, w: 12, h: 0.6, fontSize: 18, color: TEXTO });
  s.addText(`"${pergunta}"`, { x: 0.6, y: 4.2, w: 12, h: 1, fontSize: 16, italic: true, color: DIM });
  s.addText(agora(), { x: 0.6, y: 6.6, w: 6, h: 0.4, fontSize: 11, color: DIM });

  // slide 2: resumo executivo
  s = pptx.addSlide();
  s.background = { color: ESCURO };
  s.addText("Resumo Executivo", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: ACENTO });
  const kpis = [
    [stats.total.toLocaleString("pt-BR"), "População selecionada"],
    [String(Math.min(stats.total, 400)), "Respondentes (amostra)"],
    [`${stats.personaPredominante} · ${stats.faixaIdadePredominante}`, "Perfil predominante"],
    [stats.regiaoPredominante, "Região predominante"],
  ];
  kpis.forEach(([valor, rotulo], i) => {
    const x = 0.6 + (i % 2) * 6.2, yy = 1.5 + Math.floor(i / 2) * 1.7;
    s.addShape(pptx.ShapeType.roundRect, { x, y: yy, w: 5.9, h: 1.45, fill: { color: "102742" }, line: { color: "25496E" }, rectRadius: 0.08 });
    s.addText(valor, { x: x + 0.25, y: yy + 0.12, w: 5.4, h: 0.7, fontSize: 22, bold: true, color: ACENTO });
    s.addText(rotulo.toUpperCase(), { x: x + 0.25, y: yy + 0.85, w: 5.4, h: 0.4, fontSize: 10, color: DIM });
  });
  s.addText(
    `Renda média: ${fmtBRL(stats.rendaMedia)}   ·   Idade média: ${stats.idadeMedia} anos   ·   ` +
    `Score digital: ${stats.scoreDigitalMedio}/1000   ·   Score financeiro: ${stats.scoreFinanceiroMedio}/1000`,
    { x: 0.6, y: 5.2, w: 12, h: 0.5, fontSize: 13, color: TEXTO }
  );

  // slide 3: distribuição (gráfico)
  if (resultado) {
    s = pptx.addSlide();
    s.background = { color: ESCURO };
    s.addText("Distribuição das Respostas", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: ACENTO });
    const img = imagemGrafico("bar", tema);
    if (img) s.addImage({ data: img, x: 0.8, y: 1.3, w: 7.4, h: 4.9 });
    s.addText(
      resultado.distribuicao.map((d) => `${d.rotulo}: ${d.percentual}%`).join("\n"),
      { x: 8.5, y: 1.5, w: 4.3, h: 4, fontSize: 13, color: TEXTO, lineSpacing: 22 }
    );
    s.addText(resultado.resumo, { x: 0.8, y: 6.3, w: 12, h: 0.9, fontSize: 11, italic: true, color: DIM });
  }

  // slide 4: geografia
  if (resultado?.por_regiao?.length) {
    s = pptx.addSlide();
    s.background = { color: ESCURO };
    s.addText("Visão Regional", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: ACENTO });
    const imgGeo = imagemGrafico("geo", tema);
    if (imgGeo) s.addImage({ data: imgGeo, x: 1.6, y: 1.3, w: 10.1, h: 5.4 });
  }

  // slides 5+: insights
  if (insights) {
    const blocos = [
      ["Principais Insights", insights.principais_insights],
      ["Oportunidades", insights.oportunidades],
      ["Riscos e Recomendações", [...insights.riscos.map((r) => "Risco — " + r), ...insights.recomendacoes.map((r) => "Ação — " + r)]],
    ];
    for (const [tituloSlide, itens] of blocos) {
      s = pptx.addSlide();
      s.background = { color: ESCURO };
      s.addText(tituloSlide, { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: ACENTO });
      s.addText(
        itens.map((t) => ({ text: t, options: { bullet: { code: "25B8" }, color: TEXTO, fontSize: 14, paraSpaceAfter: 10 } })),
        { x: 0.8, y: 1.4, w: 11.8, h: 5.6, valign: "top" }
      );
    }
    s = pptx.addSlide();
    s.background = { color: ESCURO };
    s.addText("Narrativa Executiva", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: ACENTO });
    s.addText(insights.narrativa, { x: 0.8, y: 1.5, w: 11.8, h: 4.5, fontSize: 15, color: TEXTO, lineSpacing: 26 });
  }

  await pptx.writeFile({ fileName: nomeArquivo("pptx") });
}
