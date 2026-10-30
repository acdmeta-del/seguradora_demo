// Testes unitários das regras de posicionamento da vistoria (funções puras, sem navegador)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/vistoria-posicao.js");
global.window = {};
require("../js/vistoria-config.js");
const CFG = global.window.VISTORIA_CONFIG;
const L = CFG.limites;
const slot = (id) => Object.values(CFG.tipos).flatMap((t) => t.slots).find((s) => s.id === id);
const CARRO = CFG.tipos.carro;
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
  // Inclinado para trás 40° (câmera apontando para o chão; limite 35°)
  const paraBaixo = P.inclinacaoDe(50, 0);
  perto(paraBaixo.pitch, 40);
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

test("ângulo: faixas do 1º teste real; bloqueia só com confiança alta", () => {
  const caixa = (prop, extra) => det(0.1, 0.2, 0.6, (0.6 * 640) / 360 / prop, extra); // caixa com a proporção pedida
  const est = (d, s) => P.estimarAngulo(d, s, CARRO.faixasAngulo, CARRO);
  // Valores medidos no 1º teste: frente 1,31, traseira 1,37, diagonais 1,46–1,58, laterais 2,36–2,45
  assert.equal(est(caixa(1.31), slot("frente")).grupo, "frente-traseira");
  assert.equal(est(caixa(1.37), slot("traseira")).compativel, true);
  for (const p of [1.46, 1.53, 1.58]) assert.equal(est(caixa(p), slot("diagonal-frontal-esquerda")).grupo, "diagonal", String(p));
  for (const p of [2.36, 2.45]) assert.equal(est(caixa(p), slot("lateral-esquerda")).compativel, true, String(p));
  // Frente bem estreita no passo da lateral: confiança alta, bloqueia
  const frente = est(caixa(1.1), slot("lateral-esquerda"));
  assert.equal(frente.confianca, "alta");
  assert.equal(P.avaliarAngulo(frente, slot("lateral-esquerda")).erros[0].codigo, "angulo");
  // Lateral (2,4, média) no passo da diagonal: só aviso
  const r = P.avaliarAngulo(est(caixa(2.4), slot("diagonal-frontal-esquerda")), slot("diagonal-frontal-esquerda"));
  assert.deepEqual(r.erros, []);
  assert.equal(r.avisos[0].codigo, "angulo");
  // Lateral bem comprida (2,8) no passo da frente: alta, bloqueia
  assert.equal(P.avaliarAngulo(est(caixa(2.8), slot("frente")), slot("frente")).erros.length, 1);
  // Zona indefinida (~1,95): sem opinião
  const meio = est(caixa(1.95), slot("frente"));
  assert.equal(meio.grupo, "indefinido");
  assert.deepEqual(P.avaliarAngulo(meio, slot("frente")), { erros: [], avisos: [] });
  // Moto detectada num carro: as faixas não valem, confiança baixa; ângulo interno: sem estimativa
  assert.equal(est(caixa(1.1, { classe: "motorcycle" }), slot("lateral-esquerda")).confianca, "baixa");
  // Tipo ainda sem calibrar (moto): nunca bloqueia
  for (const t of ["moto"]) {
    const s0 = CFG.tipos[t].slots.find((s) => s.anguloEsperado === "lateral");
    const e = P.estimarAngulo(caixa(0.5, { classe: CFG.tipos[t].classes[0] }), s0, CFG.tipos[t].faixasAngulo, CFG.tipos[t]);
    assert.equal(e.confianca, "baixa", t);
    assert.deepEqual(P.avaliarAngulo(e, s0).erros, [], t);
  }
  assert.equal(est(det(0.3, 0.3, 0.4, 0.4), slot("painel-odometro")), null);
});

test("enquadramento por tipo: moto de frente usa o maior lado; outro tipo de veículo só avisa", () => {
  const moto = CFG.tipos.moto, frenteMoto = moto.slots[0];
  // Moto de frente: caixa estreita (25% da largura) mas alta (75%): enquadrada
  const m = det(0.38, 0.12, 0.25, 0.75, { classe: "motorcycle" });
  assert.deepEqual(P.avaliarEnquadramento(m, frenteMoto, L, moto), { erros: [], avisos: [] });
  // Moto pequena: mensagem no feminino
  assert.match(P.avaliarEnquadramento(det(0.45, 0.35, 0.1, 0.3, { classe: "motorcycle" }), frenteMoto, L, moto).erros[0].texto, /^A moto está pequena/);
  // Carro numa vistoria de moto: aviso, não erro
  const r = P.avaliarEnquadramento(det(0.15, 0.2, 0.7, 0.6), CFG.tipos.moto.slots[2], L, moto);
  assert.equal(r.avisos[0].codigo, "outro_tipo");
  assert.match(r.avisos[0].texto, /um carro, mas esta vistoria é de moto/);
});

test("continuidade: trilha contínua não avisa; veículo perdido, salto e pausa se comportam", () => {
  const caixa = (x, y = 0.3, w = 0.4, h = 0.4) => ({ x, y, w, h });
  const A = "0123456789abcdef", B = "fedcba9876543210"; // aparências bem diferentes (dHash)
  // Gera a trilha a partir de quadros [ms, [[caixa, hash]...], aspecto?] usando passoTrilha
  const trilha = (quadros) => {
    let estado = null;
    return quadros.map(([t, vs, aspecto = 16 / 9]) => {
      const r = P.passoTrilha(estado, vs.map(([c, h = A]) => ({ classe: "car", score: 0.9, caixa: c, hash: h })), t, aspecto, L);
      estado = r.estado;
      return r.amostra;
    });
  };
  const de = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const avaliar = (am, fim, pausas) => P.avaliarContinuidade(am, 0, fim, "Frente", L, pausas);
  // Andando em volta: a caixa se desloca aos poucos
  const ok = avaliar(trilha(de(16, (i) => [i * 500, [[caixa(0.1 + i * 0.03)]]])), 8000);
  assert.deepEqual(ok.avisos, []);
  assert.equal(ok.metricas.visivelPct, 100);
  assert.match(ok.metricas.linha, /^\|+$/);
  // Veículo fora da câmera por 8 s (limite 6 s)
  const perdido = avaliar(trilha([...de(4, (i) => [i * 500, [[caixa(0.3)]]]), ...de(14, (i) => [2000 + i * 500, []]), [9500, [[caixa(0.3)]]]]), 10000);
  assert.deepEqual(perdido.avisos.map((a) => a.codigo), ["lacuna"]);
  assert.match(perdido.avisos[0].texto, /saiu da câmera por 8 s entre “Frente”/);
  // Salto para OUTRO veículo: some num canto, aparece no outro e se firma, com outra aparência
  const salto = avaliar(trilha([...de(6, (i) => [i * 500, [[caixa(0.02, 0.3, 0.3, 0.3)]]]), ...de(6, (i) => [3000 + i * 500, [[caixa(0.68, 0.3, 0.3, 0.3), B]]])]), 6000);
  assert.deepEqual(salto.avisos.map((a) => a.codigo), ["salto"]);
  assert.match(salto.metricas.linha, /\?\?x/);
  // Olhadas com intervalo irregular (o detector às vezes demora): o salto continua sendo pego
  const irregular = avaliar(trilha([...de(4, (i) => [i * 500, [[caixa(0.02, 0.3, 0.3, 0.3)]]]), [1900, [[caixa(0.68, 0.3, 0.3, 0.3), B]]], [2500, [[caixa(0.68, 0.3, 0.3, 0.3), B]]], [3300, [[caixa(0.69, 0.3, 0.3, 0.3), B]]]]), 4000);
  assert.deepEqual(irregular.avisos.map((a) => a.codigo), ["salto"], irregular.metricas.linha);
  // Mesmo salto, mas com a MESMA aparência (giro rápido do celular): retoma, sem aviso
  const giro = avaliar(trilha([...de(6, (i) => [i * 500, [[caixa(0.02, 0.3, 0.3, 0.3)]]]), ...de(6, (i) => [3000 + i * 500, [[caixa(0.68, 0.3, 0.3, 0.3), A]]])]), 6000);
  assert.deepEqual(giro.avisos, []);
  assert.match(giro.metricas.linha, /r/);
  // 2º teste com moto: o detector perde a moto por 1–2 olhadas e só vê uma moto ao fundo: não é salto
  const fundo = [caixa(0.75, 0.1, 0.12, 0.15), B];
  const vulto = avaliar(trilha(de(16, (i) => [i * 500, i === 5 || i === 9 || i === 10 ? [fundo] : [[caixa(0.25 + i * 0.01)], fundo]])), 8000);
  assert.deepEqual(vulto.avisos, [], vulto.metricas.linha);
  assert.equal(vulto.metricas.saltos, 0);
  // Celular girou (retrato <-> paisagem): recomeça a trilha, sem salto
  const girou = avaliar(trilha([...de(6, (i) => [i * 500, [[caixa(0.3, 0.2, 0.4, 0.6)]], 9 / 16]), ...de(6, (i) => [3000 + i * 500, [[caixa(0.05, 0.1, 0.3, 0.8), B]], 16 / 9])]), 6000);
  assert.equal(girou.metricas.saltos, 0);
  // Com dois veículos no quadro, a trilha segue o que continua (maior sobreposição)
  assert.equal(avaliar(trilha(de(8, (i) => [i * 500, [[caixa(0.7, 0.3, 0.2, 0.2), B], [caixa(0.1 + i * 0.02)]]])), 4000).metricas.saltos, 0);
  // Pausa (olhando o resultado de uma tentativa): o tempo sem olhadas não conta
  const comPausa = trilha([...de(4, (i) => [i * 500, [[caixa(0.3)]]]), [11000, [[caixa(0.32)]]], [11500, [[caixa(0.33)]]]]);
  assert.deepEqual(avaliar(comPausa, 12000, [[1600, 10900]]).avisos, []);
  assert.equal(avaliar(comPausa, 12000).avisos[0].codigo, "lacuna");
  // Trajeto curto demais: sem opinião
  assert.equal(P.avaliarContinuidade([], 0, 1000, "Frente", L), null);
  assert.ok(Math.abs(P.iou(caixa(0.1), caixa(0.1)) - 1) < 1e-9);
  assert.equal(P.iou(caixa(0), caixa(0.6)), 0);
});

test("moto: tamanho pelo maior lado em todos os ângulos externos (2º teste: diagonal traseira 36% x 88%)", () => {
  const moto = CFG.tipos.moto;
  for (const s of moto.slots.filter((x) => x.externo)) assert.equal(s.medida, "maior", s.id);
  const diag = moto.slots.find((x) => x.id === "moto-diagonal-traseira-direita");
  const d = det(0.338, 0.103, 0.36, 0.876, { classe: "motorcycle" });
  assert.deepEqual(P.avaliarEnquadramento(d, diag, L, moto).erros, []);
  // Proporção medida (0,73) cai em "diagonal"
  const e = P.estimarAngulo({ ...d, quadro: { largura: 640, altura: 360 } }, diag, moto.faixasAngulo, moto);
  assert.equal(e.grupo, "diagonal");
  // Inclinação de 28,6° (moto mais baixa) passa
  assert.deepEqual(P.avaliarInclinacao({ pitch: 28.6, roll: 2.1, paisagem: true, quarto: 1, deitado: false }, diag, L).erros, []);
});

test("ponto de extensão analisarFoto existe e, por enquanto, não opina", async () => {
  assert.equal(await P.analisarFoto({}, slot("frente")), null);
});
