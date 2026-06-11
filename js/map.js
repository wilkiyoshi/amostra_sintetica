/**
 * Mapa do Brasil (Leaflet): clusters, heatmap e pontos, com popup por indivíduo.
 */
import { individuo, coordenadas } from "./data.js";

const TILES = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MAX_CLUSTER_POINTS = 40000;
const MAX_HEAT_POINTS = 60000;
const MAX_PLAIN_POINTS = 8000;

let map, tileLayer, clusterLayer, heatLayer, pointsLayer;
let modo = "clusters";
let indicesAtuais = [];

export function initMapa(tema) {
  map = L.map("map", {
    center: [-14.5, -53.0],
    zoom: 4,
    minZoom: 3,
    maxZoom: 17,
    zoomControl: true,
    preferCanvas: true,
    worldCopyJump: false,
  });
  tileLayer = L.tileLayer(TILES[tema] || TILES.dark, { attribution: ATTR, maxZoom: 19 }).addTo(map);
  return map;
}

export function aplicarTemaMapa(tema) {
  if (tileLayer) tileLayer.setUrl(TILES[tema] || TILES.dark);
}

export function definirModo(novoModo) {
  modo = novoModo;
  renderizar(indicesAtuais);
}

function amostraVisual(indices, max) {
  if (indices.length <= max) return indices;
  const passo = indices.length / max;
  const out = new Array(max);
  for (let i = 0; i < max; i++) out[i] = indices[Math.floor(i * passo)];
  return out;
}

function popupHtml(i) {
  const p = individuo(i);
  const fmtBRL = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return `
    <div class="ind-card">
      <h4>${p.nome_sintetico}</h4>
      <div class="ind-sub">ID ${String(p.id).padStart(6, "0")} · ${p.cidade}/${p.estado} · ${p.regiao}</div>
      <table>
        <tr><td>Idade</td><td>${p.idade} anos · ${p.sexo}</td></tr>
        <tr><td>Estado civil</td><td>${p.estado_civil}</td></tr>
        <tr><td>Escolaridade</td><td>${p.escolaridade}</td></tr>
        <tr><td>Renda</td><td>${fmtBRL(p.renda_mensal)}/mês</td></tr>
        <tr><td>Persona</td><td>${p.persona}</td></tr>
        <tr><td>Segmento</td><td>${p.segmento_bancario}</td></tr>
        <tr><td>Scores</td><td>Digital ${p.score_digital} · Financeiro ${p.score_financeiro}</td></tr>
      </table>
      <div class="ind-badges">
        ${p.preferencias.slice(0, 3).map((x) => `<span class="ind-badge">${x}</span>`).join("")}
      </div>
    </div>`;
}

function limparCamadas() {
  if (clusterLayer) { map.removeLayer(clusterLayer); clusterLayer = null; }
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  if (pointsLayer) { map.removeLayer(pointsLayer); pointsLayer = null; }
}

export function renderizar(indices) {
  indicesAtuais = indices;
  if (!map) return;
  limparCamadas();

  if (modo === "heat") {
    const amostra = amostraVisual(indices, MAX_HEAT_POINTS);
    const pts = amostra.map((i) => {
      const [lat, lng] = coordenadas(i);
      return [lat, lng, 0.6];
    });
    heatLayer = L.heatLayer(pts, {
      radius: 16, blur: 22, maxZoom: 11, minOpacity: 0.25,
      gradient: { 0.2: "#1d4e89", 0.45: "#5ba8ff", 0.65: "#ffa64d", 0.85: "#ec7000", 1: "#c2333f" },
    }).addTo(map);
    return;
  }

  if (modo === "points") {
    const amostra = amostraVisual(indices, MAX_PLAIN_POINTS);
    pointsLayer = L.layerGroup();
    for (const i of amostra) {
      const [lat, lng] = coordenadas(i);
      const m = L.circleMarker([lat, lng], {
        radius: 3.5, weight: 1, color: "#ec7000", fillColor: "#ec7000", fillOpacity: 0.55,
      });
      m.bindPopup(() => popupHtml(i), { maxWidth: 320 });
      pointsLayer.addLayer(m);
    }
    pointsLayer.addTo(map);
    return;
  }

  // clusters (padrão)
  const amostra = amostraVisual(indices, MAX_CLUSTER_POINTS);
  clusterLayer = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 80,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 15,
    maxClusterRadius: 56,
    iconCreateFunction: (cluster) => {
      const n = cluster.getChildCount();
      const size = n > 5000 ? 52 : n > 500 ? 44 : 36;
      const texto = n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
      return L.divIcon({
        html: `<div class="cluster-icon" style="width:${size}px;height:${size}px;font-size:${size > 44 ? 13 : 11}px">${texto}</div>`,
        className: "", iconSize: [size, size],
      });
    },
  });

  const markers = new Array(amostra.length);
  for (let k = 0; k < amostra.length; k++) {
    const i = amostra[k];
    const [lat, lng] = coordenadas(i);
    const m = L.circleMarker([lat, lng], {
      radius: 4, weight: 1, color: "#ec7000", fillColor: "#ec7000", fillOpacity: 0.6,
    });
    m.bindPopup(() => popupHtml(i), { maxWidth: 320 });
    markers[k] = m;
  }
  clusterLayer.addLayers(markers);
  map.addLayer(clusterLayer);
}

export function obterModo() { return modo; }
