// Testes unitários das regras de posicionamento da vistoria (funções puras, sem navegador)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/vistoria-posicao.js");
global.window = {};
require("../js/vistoria-config.js");
const CFG = global.window.VISTORIA_CONFIG;
const L = CFG.limites;
const slot = (id) => CFG.slots.find((s) => s.id === id);
const perto = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test("inclinação: em pé (retrato e paisagem) fica reto; torto e deitado são detectados", () => {
  const retrato = P.inclinacaoDe(90, 0);
  perto(retrato.pitch, 0); perto(retrato.roll, 0); assert.equal(retrato.paisagem, false);
  const paisagem = P.inclinacaoDe(0, 90);
  perto(paisagem.pitch, 0); perto(paisagem.roll, 0); assert.equal(paisagem.paisagem, true);
  // Em pé, girado 20° no próprio plano da tela: beta = 70, gamma = -90
  const torto = P.inclinacaoDe(70, -90);
  perto(Math.abs(torto.roll), 20);
  assert.equal(P.avaliarInclinacao(torto, slot("frente"), L).erros[0].codigo, "roll");
  // Inclinado para trás 30° (câmera apontando para o chão)
  const paraBaixo = P.inclinacaoDe(60, 0);
  perto(paraBaixo.pitch, 30);
  assert.match(P.avaliarInclinacao(paraBaixo, slot("frente"), L).erros[0].texto, /chão/);
  assert.equal(P.inclinacaoDe(0, 0).deitado, true, "celular na mesa");
  assert.deepEqual(P.avaliarInclinacao(torto, slot("painel-odometro"), L).erros, [], "painel não exige nível");
  assert.equal(P.inclinacaoDe(null, 0), null);
});

test("posição da foto: celular deitado com foto em pé (iPhone + takePhoto) é girada para o lado certo", () => {
  // Topo do celular para a esquerda: céu à direita da imagem do sensor → girar anti-horário
  const esquerda = P.inclinacaoDe(0, -90);
  assert.equal(esquerda.quarto, 1);
  assert.equal(P.rotacaoNecessaria(1080, 1920, esquerda), -90);
  const direita = P.inclinacaoDe(0, 90);
  assert.equal(direita.quarto, -1);
  assert.equal(P.rotacaoNecessaria(1080, 1920, direita), 90);
  // Foto já de lado, celular em pé, sem sensor ou celular deitado na mesa: não mexe
  assert.equal(P.rotacaoNecessaria(1920, 1080, esquerda), 0);
  assert.equal(P.rotacaoNecessaria(1080, 1920, P.inclinacaoDe(90, 0)), 0);
  assert.equal(P.rotacaoNecessaria(1080, 1920, null), 0);
  assert.equal(P.rotacaoNecessaria(1080, 1920, P.inclinacaoDe(0, 0)), 0);
});

const det = (x, y, w, h, extra = {}) => ({ encontrado: true, classe: "car", score: 0.9, caixa: { x, y, w, h }, quadro: { largura: 640, altura: 360 }, ...extra });
const codigos = (r) => r.erros.map((e) => e.codigo);

test("detecção: maior veículo das classes aceitas, caixa normalizada", () => {
  const r = P.principalVeiculo([
    { class: "person", score: 0.99, bbox: [0, 0, 600, 300] },
    { class: "car", score: 0.8, bbox: [100, 50, 200, 100] },
    { class: "truck", score: 0.7, bbox: [64, 36, 448, 216] }
  ], 640, 360, CFG.deteccao.classes);
  assert.equal(r.classe, "truck");
  assert.deepEqual(r.caixa, { x: 0.1, y: 0.1, w: 0.7, h: 0.6 });
  assert.equal(P.principalVeiculo([{ class: "dog", score: 1, bbox: [0, 0, 1, 1] }], 10, 10, CFG.deteccao.classes).encontrado, false);
});

test("enquadramento: sem carro, pequeno, cortado e fora do centro têm motivos próprios", () => {
  const f = slot("frente");
  assert.deepEqual(codigos(P.avaliarEnquadramento(det(0.15, 0.2, 0.7, 0.6), f, L)), []);
  assert.deepEqual(codigos(P.avaliarEnquadramento({ encontrado: false }, f, L)), ["sem_veiculo"]);
  assert.deepEqual(codigos(P.avaliarEnquadramento(det(0.15, 0.2, 0.7, 0.6, { score: 0.3 }), f, L)), ["sem_veiculo"]);
  assert.deepEqual(codigos(P.avaliarEnquadramento(det(0.3, 0.3, 0.4, 0.4), f, L)), ["pequeno"]);
  assert.ok(codigos(P.avaliarEnquadramento(det(0, 0.2, 0.7, 0.6), f, L)).includes("cortado"));
  assert.deepEqual(codigos(P.avaliarEnquadramento(det(0.4, 0.2, 0.56, 0.6), f, L)), ["descentralizado"]);
  assert.deepEqual(P.avaliarEnquadramento({ encontrado: false }, slot("painel-odometro"), L).erros, [], "interno não exige carro");
});

test("ângulo: frente estreita bloqueia na lateral (confiança alta); lateral x diagonal só avisa", () => {
  // 640x360: caixa 0,35 x 0,6 → proporção 1,04 (frente/traseira, alta)
  const frente = P.estimarAngulo(det(0.32, 0.2, 0.35, 0.6), slot("lateral-esquerda"));
  assert.equal(frente.grupo, "frente-traseira");
  assert.equal(frente.confianca, "alta");
  assert.equal(P.avaliarAngulo(frente, slot("lateral-esquerda")).erros[0].codigo, "angulo");
  // Caixa larga (proporção 3,2) no passo "diagonal": subtipo lateral, só aviso
  const larga = P.estimarAngulo(det(0.1, 0.35, 0.8, 0.25), slot("diagonal-frontal-esquerda"));
  assert.equal(larga.grupo, "lateral-ou-diagonal");
  assert.equal(larga.subtipo, "lateral");
  const r = P.avaliarAngulo(larga, slot("diagonal-frontal-esquerda"));
  assert.deepEqual(r.erros, []);
  assert.equal(r.avisos[0].codigo, "angulo_subtipo");
  // Lateral fotografada no passo "frente": confiança média → só aviso, não bloqueia
  const lateralNaFrente = P.avaliarAngulo(P.estimarAngulo(det(0.1, 0.35, 0.8, 0.25), slot("frente")), slot("frente"));
  assert.deepEqual(lateralNaFrente.erros, []);
  assert.equal(lateralNaFrente.avisos[0].codigo, "angulo");
  // Zona indefinida (proporção ~1,8): sem opinião
  const meio = P.estimarAngulo(det(0.2, 0.2, 0.6, 0.6 * 640 / 360 / 1.8), slot("frente"));
  assert.equal(meio.grupo, "indefinido");
  assert.deepEqual(P.avaliarAngulo(meio, slot("frente")), { erros: [], avisos: [] });
  // Moto: confiança sempre baixa
  assert.equal(P.estimarAngulo(det(0.32, 0.2, 0.35, 0.6, { classe: "motorcycle" }), slot("lateral-esquerda")).confianca, "baixa");
  assert.equal(P.estimarAngulo(det(0.3, 0.3, 0.4, 0.4), slot("painel-odometro")), null);
});

test("ponto de extensão analisarFoto existe e, por enquanto, não opina", async () => {
  assert.equal(await P.analisarFoto({}, slot("frente")), null);
});
