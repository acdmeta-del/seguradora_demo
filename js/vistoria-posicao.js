/*
 * Vistoria (TESTE, Fase 1): validações de POSICIONAMENTO / ÂNGULO, em camadas.
 *   1. Inclinação do celular (DeviceOrientationEvent; no iOS exige permissão por toque)
 *   2. Detecção do veículo (TensorFlow.js + COCO-SSD, LOCAL em js/vendor e assets/modelos)
 *   3. Estimativa de ângulo pela proporção da caixa do veículo (heurística, com confiança)
 *   4. Ponto de extensão analisarFoto(imagem, slot) para um modelo melhor no futuro
 * As funções de decisão são puras (testáveis no Node); só o detector e a inclinação usam o navegador.
 */
(function (raiz, fabrica) {
  const api = fabrica(raiz);
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.VistoriaPosicao = api;
})(typeof self !== "undefined" ? self : this, function (raiz) {
  "use strict";

  const erro = (codigo, texto, camada) => ({ codigo, texto, camada });
  const graus = (rad) => (rad * 180) / Math.PI;
  const rad = (g) => (g * Math.PI) / 180;

  /* ---------- 1. Inclinação ---------- */

  // beta/gamma (graus) → vetor "para cima" no referencial do aparelho → pitch e roll.
  // pitch: 0 = tela na vertical (câmera olhando para a frente); + = câmera apontando para baixo.
  // roll: inclinação do horizonte, em qualquer orientação de tela (retrato ou paisagem).
  function inclinacaoDe(beta, gamma) {
    if (beta == null || gamma == null) return null;
    const b = rad(beta), g = rad(gamma);
    const ux = -Math.cos(b) * Math.sin(g), uy = Math.sin(b), uz = Math.cos(b) * Math.cos(g);
    const pitch = graus(Math.asin(Math.max(-1, Math.min(1, uz))));
    const angulo = graus(Math.atan2(ux, uy));            // 0 = topo do celular para cima
    const quarto = Math.round(angulo / 90);
    let roll = angulo - quarto * 90;
    if (roll > 45) roll -= 90;
    // quarto: 0 = em pé; +1 = topo do celular virado para a esquerda; -1 = para a direita; ±2 = de cabeça para baixo
    return { pitch, roll, quarto, paisagem: Math.abs(quarto) % 2 === 1, deitado: Math.abs(pitch) > 60 };
  }

  /*
   * Quantos graus girar a foto para ela ficar na posição em que o celular estava.
   * Alguns navegadores (ex.: Safari no iPhone com ImageCapture.takePhoto) entregam a imagem
   * na posição do sensor (sempre em pé), mesmo com o celular deitado: o carro sai de lado.
   * Só corrige quando a foto e o celular discordam (paisagem x retrato) e o sensor diz o lado.
   *   -90 = girar no sentido anti-horário (topo do celular estava à esquerda)
   *   +90 = girar no sentido horário (topo do celular estava à direita)
   */
  function rotacaoNecessaria(largura, altura, incl) {
    if (!incl || incl.deitado || incl.paisagem === largura > altura) return 0;
    if (incl.quarto === 1) return -90;
    if (incl.quarto === -1) return 90;
    return 0;
  }

  function avaliarInclinacao(incl, slot, L) {
    if (!slot.externo || !incl) return { erros: [], avisos: [] };
    const erros = [];
    if (incl.deitado || Math.abs(incl.pitch) > L.pitchMax) {
      erros.push(erro("pitch", incl.pitch > 0 ? "Celular apontado para o chão: deixe-o em pé, reto, na altura do peito." : "Celular apontado para cima: deixe-o em pé, reto, na altura do peito.", "inclinacao"));
    }
    if (!incl.deitado && Math.abs(incl.roll) > L.rollMax) erros.push(erro("roll", "Celular torto: alinhe o horizonte com a linha do nível.", "inclinacao"));
    return { erros, avisos: [] };
  }

  // Escuta o sensor. No iOS 13+, pedirPermissao() precisa ser chamado num toque do usuário.
  function criarInclinacao() {
    let ultimo = null, ouvindo = false;
    const ouvintes = new Set();
    // Leituras nulas (aparelho sem sensor, ou o navegador avisando que não há sensor) são ignoradas
    const aoMudar = (e) => {
      const v = inclinacaoDe(e.beta, e.gamma);
      if (!v) return;
      ultimo = v;
      ouvintes.forEach((f) => f(ultimo));
    };
    const disponivel = () => typeof raiz.DeviceOrientationEvent !== "undefined";
    const precisaPermissao = () => disponivel() && typeof raiz.DeviceOrientationEvent.requestPermission === "function";
    function ouvir() {
      if (ouvindo || !disponivel()) return;
      raiz.addEventListener("deviceorientation", aoMudar);
      ouvindo = true;
    }
    async function pedirPermissao() {
      if (!precisaPermissao()) { ouvir(); return disponivel() ? "granted" : "indisponivel"; }
      try {
        const r = await raiz.DeviceOrientationEvent.requestPermission();
        if (r === "granted") ouvir();
        return r;
      } catch { return "denied"; }
    }
    return {
      disponivel, precisaPermissao, pedirPermissao, ouvir,
      get ultimo() { return ultimo; },
      get ativo() { return ouvindo && ultimo != null; },
      aoAtualizar: (f) => { ouvintes.add(f); return () => ouvintes.delete(f); }
    };
  }

  /* ---------- 2. Detecção do veículo ---------- */

  // Maior veículo das classes aceitas; caixa normalizada (0–1) pelo tamanho do quadro
  function principalVeiculo(predicoes, largura, altura, classes) {
    let melhor = null;
    for (const p of predicoes || []) {
      if (!classes.includes(p.class)) continue;
      const [x, y, w, h] = p.bbox;
      if (!melhor || w * h > melhor.area) melhor = { area: w * h, classe: p.class, score: p.score, caixa: { x: x / largura, y: y / altura, w: w / largura, h: h / altura } };
    }
    return melhor
      ? { encontrado: true, classe: melhor.classe, score: melhor.score, caixa: melhor.caixa, quadro: { largura, altura } }
      : { encontrado: false, quadro: { largura, altura } };
  }

  // Nome das classes do detector, para as mensagens
  const NOME_CLASSE = { car: "um carro", truck: "um caminhão ou utilitário", bus: "um ônibus", motorcycle: "uma moto" };

  /*
   * Enquadramento do veículo. slot.largura = [mín, máx] (padrão: L.larguraMin/L.larguraMax);
   * slot.medida "maior" usa o maior lado da caixa (moto de frente: alta e estreita).
   * tipo (opcional): { classes, artigo } do VISTORIA_CONFIG.tipos; outra classe detectada só avisa.
   */
  function avaliarEnquadramento(det, slot, L, tipo) {
    if (!slot.externo || !det) return { erros: [], avisos: [] };
    const erros = [], avisos = [];
    const add = (codigo, texto) => erros.push(erro(codigo, texto, "deteccao"));
    const nome = (tipo && tipo.artigo) || "o veículo";
    if (!det.encontrado || det.score < L.deteccaoScore) {
      add("sem_veiculo", `Não encontrei ${nome} na foto: afaste-se até caber inteiro e tente de novo.`);
      return { erros, avisos };
    }
    if (tipo && tipo.classes && !tipo.classes.includes(det.classe)) {
      avisos.push(erro("outro_tipo", `A foto parece de ${NOME_CLASSE[det.classe] || det.classe}, mas esta vistoria é de ${nome.replace(/^(o|a) /, "")}.`, "deteccao"));
    }
    const c = det.caixa;
    const [min, max] = slot.largura || [L.larguraMin, L.larguraMax];
    const tamanho = slot.medida === "maior" ? Math.max(c.w, c.h) : c.w;
    const cortado = c.x < L.margemBorda || c.y < L.margemBorda || c.x + c.w > 1 - L.margemBorda || c.y + c.h > 1 - L.margemBorda;
    const Nome = nome[0].toUpperCase() + nome.slice(1);
    if (tamanho < min) add("pequeno", `${Nome} está pequeno na foto: chegue um pouco mais perto.`.replace(/^A (.*) pequeno/, "A $1 pequena"));
    else if (tamanho > max || cortado) add("cortado", `${Nome} está cortado na borda: afaste-se um pouco até caber inteiro.`.replace(/^A (.*) cortado/, "A $1 cortada"));
    const dx = Math.abs(c.x + c.w / 2 - 0.5), dy = Math.abs(c.y + c.h / 2 - 0.5);
    if (Math.max(dx, dy) > L.centroMax) add("descentralizado", `Centralize ${nome} no quadro.`);
    return { erros, avisos };
  }

  /*
   * Detector COCO-SSD, carregado só quando preciso. Biblioteca e modelo são arquivos do
   * próprio site: a imagem é analisada no aparelho e nunca é enviada.
   * estado: desligado | carregando | pronto | erro (com mensagem visível na página)
   */
  function criarDetector(cfgDeteccao, { carregarScript } = {}) {
    let modelo = null, promessa = null;
    const det = { estado: "desligado", erro: "", tempoCargaMs: null, backend: null };
    const scripts = ["js/vendor/tf-4.22.0.min.js", "js/vendor/coco-ssd-2.2.3.min.js"];
    const injetar = carregarScript || ((src) => new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => falha(new Error(`não carregou ${src}`));
      document.head.appendChild(s);
    }));

    det.carregar = function () {
      if (promessa) return promessa;
      det.estado = "carregando";
      const t0 = Date.now();
      promessa = (async () => {
        try {
          // O tf.min.js 4.22 traz um regenerator antigo: se a global não existir, ele cai em
          // Function("r", ...), que a CSP (sem 'unsafe-eval') bloqueia e derruba a biblioteca.
          if (!("regeneratorRuntime" in raiz)) raiz.regeneratorRuntime = undefined;
          for (const src of scripts) if (!(src.includes("tf-") ? raiz.tf : raiz.cocoSsd)) await injetar(src);
          if (!raiz.tf || !raiz.cocoSsd) throw new Error("biblioteca de detecção ausente em js/vendor");
          modelo = await raiz.cocoSsd.load({ base: cfgDeteccao.base, modelUrl: cfgDeteccao.modelUrl });
          det.backend = raiz.tf.getBackend ? raiz.tf.getBackend() : null;
          det.estado = "pronto";
          det.tempoCargaMs = Date.now() - t0;
        } catch (e) {
          det.estado = "erro";
          det.erro = `O detector de veículo não carregou (${e && e.message ? e.message : "erro desconhecido"}). As fotos seguem só com as outras validações.`;
          promessa = null; // permite tentar de novo
        }
        return det;
      })();
      return promessa;
    };

    // canvas/imagem → { encontrado, classe, score, caixa, quadro, tempoMs }
    det.detectar = async function (fonte, largura, altura) {
      if (det.estado !== "pronto") return null;
      const t0 = Date.now();
      const predicoes = await modelo.detect(fonte, 10, 0.2);
      return { ...principalVeiculo(predicoes, largura, altura, cfgDeteccao.classes), tempoMs: Date.now() - t0 };
    };
    return det;
  }

  /* ---------- 3. Estimativa de ângulo (heurística) ----------
   * Só olha a proporção largura/altura da caixa do veículo, em pixels, com as faixas de cada
   * tipo (vistoria-config.js). Carro calibrado no 1º teste real (hatch, iPhone, ~3 passos):
   * frente 1,31, traseira 1,37, diagonais 1,46–1,58, laterais 2,36–2,45. Moto e caminhão:
   * estimativa inicial, sempre confiança baixa até calibrar (o relatório traz a proporção).
   * O que NÃO dá para saber assim: frente x traseira, esquerda x direita.
   */
  // faixas: VISTORIA_CONFIG.tipos[tipo].faixasAngulo = [{ ate, grupo, alta: [de, ate], media: [de, ate] }]
  const dentro = (p, f) => Boolean(f) && p >= f[0] && p < f[1];
  function estimarAngulo(det, slot, faixas, tipo) {
    if (!slot.externo || !slot.anguloEsperado || !det || !det.encontrado || !faixas) return null;
    const c = det.caixa, q = det.quadro;
    const proporcao = (c.w * q.largura) / Math.max(1, c.h * q.altura);
    const faixa = faixas.find((f) => proporcao < f.ate) || faixas[faixas.length - 1];
    let confianca = dentro(proporcao, faixa.alta) ? "alta" : dentro(proporcao, faixa.media) ? "media" : "baixa";
    // Outro tipo de veículo na foto: as faixas não valem para ele
    if (tipo && tipo.classes && !tipo.classes.includes(det.classe)) confianca = "baixa";
    const compativel = faixa.grupo === "indefinido" ? null : faixa.grupo === slot.anguloEsperado;
    return { proporcao: Math.round(proporcao * 100) / 100, grupo: faixa.grupo, confianca, compativel };
  }

  // Bloqueia só com confiança ALTA; média e baixa apenas avisam
  const NOMES = { "frente-traseira": "frente ou traseira", lateral: "lateral", diagonal: "diagonal" };
  function avaliarAngulo(est, slot) {
    if (!est || est.compativel !== false) return { erros: [], avisos: [] };
    const texto = `O enquadramento parece de ${NOMES[est.grupo]} (confiança ${est.confianca}). Este passo pede: ${slot.nome}.`;
    const item = erro("angulo", texto, "angulo");
    return est.confianca === "alta" ? { erros: [item], avisos: [] } : { erros: [], avisos: [item] };
  }

  /* ---------- 4. Ponto de extensão ----------
   * analisarFoto(imagem, slot): plugue aqui um modelo de visão mais robusto (ex.: classificador
   * de ângulo treinado com fotos de vistoria) ou, na Fase 2, um serviço externo.
   *   imagem: { canvas, largura, altura, blob }   slot: item de VISTORIA_CONFIG.slots
   *   retorno: null (sem opinião) ou { erros: [...], avisos: [...], metricas: {...} },
   *            com itens no formato { codigo, texto, camada: "extensao" }.
   * Atenção: serviço externo = enviar a foto para fora do aparelho (fora do escopo da Fase 1).
   */
  async function analisarFoto(imagem, slot) { // eslint-disable-line no-unused-vars
    return null;
  }

  return { inclinacaoDe, rotacaoNecessaria, avaliarInclinacao, criarInclinacao, principalVeiculo, avaliarEnquadramento, criarDetector, estimarAngulo, avaliarAngulo, analisarFoto };
});
