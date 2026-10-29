// Testes unitários das funções puras de qualidade da vistoria (imagens sintéticas, sem fotos reais)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../js/vistoria-qualidade.js");
global.window = {};
require("../js/vistoria-config.js");
const CFG = global.window.VISTORIA_CONFIG;
const L = CFG.limites;
const slot = (id) => Object.values(CFG.tipos).flatMap((t) => t.slots).find((s) => s.id === id);
const CARRO = CFG.tipos.carro;

// Imagem RGBA a partir de uma função de luminância (x, y) → 0–255
function imagem(w, h, f) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = f(x, y), i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}
// Gerador pseudoaleatório fixo (testes reprodutíveis)
function aleatorio(semente) { let s = semente; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); }
// Cena "detalhada": blocos de 4 px com tons variados (média ~128)
function cena(w = 320, h = 180, semente = 7) {
  const r = aleatorio(semente), blocos = [];
  for (let i = 0; i < (w / 4) * (h / 4); i++) blocos.push(60 + r() * 136);
  return imagem(w, h, (x, y) => blocos[Math.floor(y / 4) * (w / 4) + Math.floor(x / 4)]);
}
function borrar(img, raio) {
  const { width: w, height: h } = img, g = Q.paraCinza(img).g;
  return imagem(w, h, (x, y) => {
    let s = 0, n = 0;
    for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) {
      const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
      s += g[yy * w + xx]; n++;
    }
    return s / n;
  });
}
const espelhar = (img) => { const g = Q.paraCinza(img).g; return imagem(img.width, img.height, (x, y) => g[y * img.width + (img.width - 1 - x)]); };
const medir = (img, extra) => Q.medir(img, { largura: 1920, altura: 1080, ...extra });
const codigos = (r) => r.erros.map((e) => e.codigo);

test("nitidez: cena detalhada passa e a mesma cena borrada (tremida) reprova", () => {
  const nitida = medir(cena()), borrada = medir(borrar(cena(), 3));
  assert.ok(nitida.nitidez > L.nitidez * 3, `nítida: ${nitida.nitidez}`);
  assert.ok(borrada.nitidez < L.nitidez, `borrada: ${borrada.nitidez}`);
  assert.deepEqual(codigos(Q.avaliarQualidade(nitida, slot("frente"), L)), []);
  assert.ok(codigos(Q.avaliarQualidade(borrada, slot("frente"), L)).includes("nitidez"));
});

test("exposição: escura, clara, estourada e contraluz têm motivos próprios", () => {
  const escura = medir(imagem(320, 180, (x, y) => ((x + y) % 2 ? 10 : 40)));
  assert.ok(codigos(Q.avaliarQualidade(escura, slot("frente"), L)).includes("escura"));
  const clara = medir(imagem(320, 180, (x, y) => ((x + y) % 2 ? 215 : 240)));
  assert.ok(codigos(Q.avaliarQualidade(clara, slot("frente"), L)).includes("clara"));
  const estourada = medir(imagem(320, 180, (x, y) => (x < 80 ? 255 : (x + y) % 2 ? 90 : 160)));
  assert.ok(codigos(Q.avaliarQualidade(estourada, slot("frente"), L)).includes("estourados"));
  // Bordas claras e centro escuro: sol atrás do carro
  const contraluz = medir(imagem(320, 180, (x, y) => (x > 80 && x < 240 && y > 45 && y < 135 ? ((x + y) % 2 ? 50 : 70) : (x + y) % 2 ? 200 : 230)));
  assert.ok(contraluz.contraluz < L.contraluzRazao, String(contraluz.contraluz));
  assert.ok(codigos(Q.avaliarQualidade(contraluz, slot("frente"), L)).includes("contraluz"));
});

test("resolução e orientação: baixa resolução e retrato reprovam nos ângulos externos", () => {
  const img = cena();
  assert.ok(codigos(Q.avaliarQualidade(medir(img, { largura: 800, altura: 600 }), slot("frente"), L)).includes("resolucao"));
  const retrato = medir(img, { largura: 1080, altura: 1920 });
  assert.ok(codigos(Q.avaliarQualidade(retrato, slot("frente"), L)).includes("orientacao"));
  assert.ok(!codigos(Q.avaliarQualidade(retrato, slot("painel-odometro"), L)).includes("orientacao"), "painel aceita retrato");
});

test("legibilidade: odômetro exige nitidez no centro, mesmo com bordas nítidas", () => {
  const nitida = cena(), borrada = borrar(cena(), 3);
  const g1 = Q.paraCinza(nitida).g, g2 = Q.paraCinza(borrada).g;
  // Bordas nítidas, centro borrado
  const mista = imagem(320, 180, (x, y) => (x >= 80 && x < 240 && y >= 45 && y < 135 ? g2 : g1)[y * 320 + x]);
  const m = medir(mista);
  assert.ok(m.nitidez >= L.nitidez);
  assert.ok(codigos(Q.avaliarQualidade(m, slot("painel-odometro"), L)).includes("nitidezCentro"));
  assert.ok(!codigos(Q.avaliarQualidade(m, slot("frente"), L)).includes("nitidezCentro"));
});

test("dHash: mesma foto ~0, leve mudança de luz perto, cena diferente longe; duplicada só avisa", () => {
  const a = medir(cena(320, 180, 7));
  const maisClara = medir(imagem(320, 180, (x, y) => Math.min(255, Q.paraCinza(cena(320, 180, 7)).g[y * 320 + x] + 12)));
  const outra = medir(cena(320, 180, 99));
  assert.equal(Q.hamming(a.hash, a.hash), 0);
  assert.ok(Q.hamming(a.hash, maisClara.hash) <= L.duplicadaDist);
  assert.ok(Q.hamming(a.hash, outra.hash) > L.parecidaDist);
  const r = Q.avaliarDuplicada(maisClara.hash, [{ slotId: "frente", nome: "Frente", hash: a.hash }], L);
  assert.equal(r.avisos[0].codigo, "duplicada");
  assert.match(r.avisos[0].texto, /Frente/);
  assert.deepEqual(Q.avaliarDuplicada(outra.hash, [{ slotId: "frente", nome: "Frente", hash: a.hash }], L).avisos, []);
});

test("espelho: hash espelhado de A é o hash de A invertida", () => {
  const a = cena(320, 180, 3);
  assert.equal(Q.medir(a).hashEspelho, Q.medir(espelhar(a)).hash);
});

test("lado repetido: mesma lateral duas vezes avisa; lateral oposta (espelho) não avisa", () => {
  // "Carro" assimétrico: frente (bloco claro) de um lado, traseira escura do outro
  const lateral = imagem(320, 180, (x, y) => (y < 60 || y > 140 ? 120 : x < 100 ? 220 : x < 220 ? 150 : 40));
  const esquerda = medir(lateral);
  const direitaCerta = medir(espelhar(lateral));
  const mesmoLado = medir(imagem(320, 180, (x, y) => (y < 60 || y > 140 ? 125 : x < 104 ? 215 : x < 224 ? 150 : 45)));
  const ok = Q.avaliarEspelho(direitaCerta, esquerda, "Lateral esquerda", L);
  assert.deepEqual(ok.avisos, [], JSON.stringify(ok.comparacao));
  const repetido = Q.avaliarEspelho(mesmoLado, esquerda, "Lateral esquerda", L);
  assert.equal(repetido.avisos[0]?.codigo, "espelho", JSON.stringify(repetido.comparacao));
  assert.equal(repetido.avisos[0].camada, "espelho");
});

test("configuração: três tipos, ids únicos, silhueta existente e codigoTipoSgaPendente nulo", () => {
  global.self = {};
  require("../js/vistoria-silhuetas.js");
  const SIL = global.self.VistoriaSilhuetas;
  assert.deepEqual(Object.keys(CFG.tipos), ["carro", "moto", "caminhao"]);
  assert.equal(CARRO.slots.length, 11);
  const ids = Object.values(CFG.tipos).flatMap((t) => t.slots.map((s) => s.id));
  assert.equal(new Set(ids).size, ids.length, "ids únicos entre os tipos (IndexedDB)");
  for (const [nome, t] of Object.entries(CFG.tipos)) {
    for (const s of t.slots) {
      assert.equal(s.codigoTipoSgaPendente, null, s.id);
      assert.ok(SIL[s.silhueta], `silhueta ${s.silhueta} (${nome})`);
      if (s.externo) assert.ok(["frente-traseira", "lateral", "diagonal"].includes(s.anguloEsperado), s.id);
    }
    for (const par of t.espelhos) for (const id of par) assert.ok(t.slots.some((s) => s.id === id), `${nome}: ${id}`);
    assert.ok(t.classes.length && t.faixasAngulo.length, nome);
  }
  for (const [chave] of CFG.ajustes) assert.ok(chave in L, chave);
});

test("mesmo veículo: cor diferente, moto x carro, longe e muito depois avisam; o mesmo carro não", () => {
  // Assinatura de cor de uma "carroceria" sintética
  const corDe = (r, g, b) => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < data.length; i += 4) { const v = (i / 4) % 7 ? 0 : 12; data[i] = r - v; data[i + 1] = g - v; data[i + 2] = b - v; data[i + 3] = 255; }
    return Q.assinaturaCor({ data, width: 100, height: 100 }, { x: 0, y: 0, w: 1, h: 1 });
  };
  const branco = corDe(235, 235, 235), brancoSombra = corDe(190, 192, 195), vermelho = corDe(180, 30, 30);
  assert.ok(Q.semelhancaCor(branco, brancoSombra) >= L.corSemelhancaMin, "branco no sol x na sombra = mesma cor");
  assert.ok(Q.semelhancaCor(branco, vermelho) < 0.3);
  const base = { geo: { lat: -15.7939, lon: -47.8828 }, em: Date.UTC(2026, 9, 29, 14, 0), classe: "car" };
  const outras = [{ ...base, cor: branco }, { ...base, cor: brancoSombra, em: base.em + 60000 }];
  const codigos = (r) => r.avisos.map((a) => a.codigo);
  assert.deepEqual(codigos(Q.avaliarMesmoVeiculo({ ...base, cor: branco, em: base.em + 120000 }, outras, L)), []);
  assert.deepEqual(codigos(Q.avaliarMesmoVeiculo({ ...base, cor: vermelho }, outras, L)), ["cor"]);
  assert.deepEqual(codigos(Q.avaliarMesmoVeiculo({ ...base, cor: branco, classe: "motorcycle" }, outras, L)), ["classe"]);
  // ~1,1 km ao norte
  const longe = Q.avaliarMesmoVeiculo({ ...base, cor: branco, geo: { lat: -15.7839, lon: -47.8828 } }, outras, L);
  assert.deepEqual(codigos(longe), ["distancia"]);
  assert.ok(Math.abs(longe.comparacao.distanciaM - 1112) < 10, String(longe.comparacao.distanciaM));
  assert.match(longe.avisos[0].texto, /1112 m/);
  assert.deepEqual(codigos(Q.avaliarMesmoVeiculo({ ...base, cor: branco, em: base.em + 90 * 60000 }, outras, L)), ["tempo"]);
  assert.equal(longe.avisos[0].camada, "mesmoVeiculo");
  // Sem outras fotos: nada a comparar
  assert.deepEqual(Q.avaliarMesmoVeiculo({ ...base, cor: branco }, [], L).avisos, []);
});

test("carimbo: data e hora de Brasília no formato DD-MM-AAAA HH:MM:SS", () => {
  const K = require("../js/vistoria-carimbo.js");
  assert.equal(K.formatarDataHora(Date.UTC(2026, 9, 29, 14, 32, 5)), "29-10-2026 11:32:05");
  assert.equal(K.formatarDataHora(Date.UTC(2027, 0, 1, 2, 3, 4)), "31-12-2026 23:03:04", "virada do dia em UTC-3");
});
