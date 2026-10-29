/*
 * Vistoria (TESTE, Fase 1): validações de QUALIDADE, em funções puras.
 * Recebem uma imagem no formato do canvas ({ data: RGBA, width, height }), já reduzida
 * para o tamanho de análise, e não usam DOM: rodam no navegador e no Node (testes).
 * Medir (medir) e decidir (avaliar*) são separados: o painel dev muda os limites e
 * reavalia na hora, sem medir de novo.
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.VistoriaQualidade = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  // RGBA → luminância 0–255 (BT.601)
  function paraCinza(img) {
    const { data, width, height } = img;
    const g = new Float32Array(width * height);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    return { g, w: width, h: height };
  }

  // Região normalizada { x, y, w, h } (0–1) → retângulo em pixels; sem região = imagem toda
  function retangulo(c, r) {
    if (!r) return { x0: 0, y0: 0, x1: c.w, y1: c.h };
    const x0 = limitar(Math.floor(r.x * c.w), 0, c.w - 1);
    const y0 = limitar(Math.floor(r.y * c.h), 0, c.h - 1);
    return { x0, y0, x1: limitar(Math.ceil((r.x + r.w) * c.w), x0 + 1, c.w), y1: limitar(Math.ceil((r.y + r.h) * c.h), y0 + 1, c.h) };
  }

  // Nitidez: variância do Laplaciano (4 vizinhos). Foto tremida ou fora de foco = valor baixo.
  function nitidez(c, regiao) {
    const { x0, y0, x1, y1 } = retangulo(c, regiao);
    let soma = 0, soma2 = 0, n = 0;
    for (let y = Math.max(1, y0); y < Math.min(c.h - 1, y1); y++) {
      for (let x = Math.max(1, x0); x < Math.min(c.w - 1, x1); x++) {
        const i = y * c.w + x;
        const l = c.g[i - 1] + c.g[i + 1] + c.g[i - c.w] + c.g[i + c.w] - 4 * c.g[i];
        soma += l; soma2 += l * l; n++;
      }
    }
    if (!n) return 0;
    const m = soma / n;
    return soma2 / n - m * m;
  }

  // Exposição: média, fração estourada (> 245) e escura (< 15), e centro x bordas (contraluz)
  const CENTRO = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  function exposicao(c) {
    const { x0, y0, x1, y1 } = retangulo(c, CENTRO);
    let soma = 0, est = 0, esc = 0, somaC = 0, nC = 0;
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const v = c.g[y * c.w + x];
        soma += v;
        if (v > 245) est++;
        if (v < 15) esc++;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) { somaC += v; nC++; }
      }
    }
    const n = c.w * c.h;
    const centro = nC ? somaC / nC : 0;
    const borda = n - nC ? (soma - somaC) / (n - nC) : centro;
    return { media: soma / n, estourados: est / n, escuros: esc / n, centro, borda, contraluz: borda > 0 ? centro / borda : 1 };
  }

  // dHash de 64 bits (8 linhas x 9 colunas, compara vizinhos), em hexadecimal.
  // espelhar: calcula o hash da imagem invertida na horizontal (comparação de laterais).
  function dHash(c, { regiao, espelhar = false } = {}) {
    const { x0, y0, x1, y1 } = retangulo(c, regiao);
    const W = 9, H = 8, amostra = new Float32Array(W * H);
    const lw = (x1 - x0) / W, lh = (y1 - y0) / H;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const xa = Math.floor(x0 + i * lw), xb = Math.max(xa + 1, Math.floor(x0 + (i + 1) * lw));
        const ya = Math.floor(y0 + j * lh), yb = Math.max(ya + 1, Math.floor(y0 + (j + 1) * lh));
        let s = 0, n = 0;
        for (let y = ya; y < Math.min(yb, y1); y++) {
          for (let x = xa; x < Math.min(xb, x1); x++) {
            // Espelhado: lê o pixel simétrico dentro da região (igual a inverter a imagem)
            s += c.g[y * c.w + (espelhar ? x0 + x1 - 1 - x : x)]; n++;
          }
        }
        amostra[j * W + i] = n ? s / n : 0;
      }
    }
    let hex = "";
    for (let j = 0; j < H; j++) {
      let byte = 0;
      for (let i = 0; i < 8; i++) byte = (byte << 1) | (amostra[j * W + i] < amostra[j * W + i + 1] ? 1 : 0);
      hex += byte.toString(16).padStart(2, "0");
    }
    return hex;
  }

  function hamming(a, b) {
    if (!a || !b || a.length !== b.length) return null;
    let d = 0;
    for (let i = 0; i < a.length; i++) {
      let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
      while (x) { d += x & 1; x >>= 1; }
    }
    return d;
  }

  // Todas as medidas de uma foto. largura/altura = resolução ORIGINAL da captura.
  function medir(img, { largura, altura } = {}) {
    const c = paraCinza(img);
    const e = exposicao(c);
    return {
      largura: largura || img.width,
      altura: altura || img.height,
      nitidez: nitidez(c),
      nitidezCentro: nitidez(c, CENTRO),
      media: e.media,
      estourados: e.estourados,
      escuros: e.escuros,
      contraluz: e.contraluz,
      hash: dHash(c),
      hashEspelho: dHash(c, { espelhar: true })
    };
  }

  // Mensagens específicas e acionáveis (PERSONALIZAR: textos)
  const MSG = {
    resolucao: (m) => `Resolução baixa (${m.largura}×${m.altura}). Use a câmera traseira e limpe a lente.`,
    orientacao: () => "Gire o celular de lado (paisagem) para caber o veículo inteiro.",
    nitidez: () => "Foto tremida ou desfocada: apoie o celular, toque na tela para focar e tente de novo.",
    nitidezCentro: () => "Os números no centro não estão nítidos: aproxime um pouco e espere o foco.",
    escura: () => "Muito escuro: afaste-se da sombra ou acenda a luz.",
    clara: () => "Muito claro: evite o sol direto na lente.",
    estourados: () => "Reflexo forte (partes brancas): mude de posição até o brilho sumir.",
    escuros: () => "Muitas áreas pretas: falta luz em parte da foto.",
    contraluz: () => "Contraluz: o sol está atrás do veículo. Fotografe do outro lado ou com o sol às suas costas.",
    duplicada: (nome) => `Parece a mesma foto de “${nome}”. Confira se você mudou de ângulo.`,
    parecida: (nome) => `Muito parecida com “${nome}”. Confira se você mudou de ângulo.`,
    espelho: (nome) => `Parece o mesmo lado de “${nome}”. Confira se fotografou o outro lado do veículo.`,
    outraCor: () => "A cor do veículo nesta foto não bate com as outras: confira se é o mesmo veículo.",
    outraClasse: () => "Esta foto parece de outro tipo de veículo (moto x carro ou caminhão) que as anteriores.",
    longe: (m) => `Esta foto foi tirada a uns ${m} m das outras: confira se é o mesmo veículo e o mesmo local.`,
    demorou: (min) => `Esta foto foi tirada ${min} min depois da primeira: confira se é o mesmo veículo.`
  };

  const erro = (codigo, texto, camada = "qualidade") => ({ codigo, texto, camada });

  // Qualidade: devolve erros (reprovam) e avisos (não reprovam)
  function avaliarQualidade(m, slot, L) {
    const erros = [], avisos = [];
    const maior = Math.max(m.largura, m.altura), menor = Math.min(m.largura, m.altura);
    if (maior < L.resolucaoMaior || menor < L.resolucaoMenor) erros.push(erro("resolucao", MSG.resolucao(m)));
    if (slot.orientacao === "paisagem" && m.largura < m.altura) erros.push(erro("orientacao", MSG.orientacao()));
    if (m.nitidez < L.nitidez) erros.push(erro("nitidez", MSG.nitidez()));
    if (slot.legibilidade && m.nitidezCentro < L.nitidezCentro) erros.push(erro("nitidezCentro", MSG.nitidezCentro()));
    if (m.media < L.lumMin) erros.push(erro("escura", MSG.escura()));
    else if (m.media > L.lumMax) erros.push(erro("clara", MSG.clara()));
    if (m.estourados > L.estouradosMax) erros.push(erro("estourados", MSG.estourados()));
    if (m.escuros > L.escurosMax && m.media >= L.lumMin) erros.push(erro("escuros", MSG.escuros()));
    // Contraluz só nos ângulos externos: no painel é comum o céu claro atrás (2º teste com moto)
    if (slot.externo && m.contraluz < L.contraluzRazao && m.media >= L.lumMin) erros.push(erro("contraluz", MSG.contraluz()));
    return { erros, avisos };
  }

  // Duplicada ou quase: compara com as fotos já aceitas. Só AVISA (decisão do projeto).
  function avaliarDuplicada(hash, outras, L) {
    const avisos = [];
    let maisPerto = null;
    for (const o of outras) {
      const d = hamming(hash, o.hash);
      if (d == null) continue;
      if (!maisPerto || d < maisPerto.distancia) maisPerto = { slot: o.slotId, nome: o.nome, distancia: d };
    }
    if (maisPerto && maisPerto.distancia <= L.duplicadaDist) avisos.push(erro("duplicada", MSG.duplicada(maisPerto.nome), "duplicada"));
    else if (maisPerto && maisPerto.distancia <= L.parecidaDist) avisos.push(erro("parecida", MSG.parecida(maisPerto.nome), "duplicada"));
    return { avisos, maisPerto };
  }

  /*
   * Lado repetido (laterais e diagonais). O carro é simétrico: a lateral direita parece
   * a esquerda espelhada. Se a foto se parece mais com a do par SEM espelhar do que
   * espelhada, provavelmente é o mesmo lado fotografado duas vezes. Só AVISA.
   * Usa o hash do recorte do veículo quando os dois têm caixa (menos fundo na conta).
   * foto/par: { hash, hashEspelho, hashCaixa?, hashCaixaEspelho? }
   */
  function avaliarEspelho(foto, par, nomePar, L) {
    if (!foto || !par) return { avisos: [], comparacao: null };
    const caixa = foto.hashCaixa && par.hashCaixa;
    const a = caixa ? foto.hashCaixa : foto.hash;
    const direto = hamming(a, caixa ? par.hashCaixa : par.hash);
    const espelhado = hamming(a, caixa ? par.hashCaixaEspelho : par.hashEspelho);
    const comparacao = { direto, espelhado, usouCaixa: Boolean(caixa) };
    if (direto == null || espelhado == null) return { avisos: [], comparacao };
    const repetido = direto + L.espelhoMargem <= espelhado;
    return { avisos: repetido ? [erro("espelho", MSG.espelho(nomePar), "espelho")] : [], comparacao: { ...comparacao, repetido } };
  }

  /* ---------- Mesmo veículo em todas as fotos ----------
   * Sinais independentes, todos só AVISAM: cor da carroceria, tipo detectado (moto x 4 rodas),
   * distância entre os pontos de GPS e tempo desde a primeira foto. Nenhum pega dois veículos
   * iguais (mesma cor, mesmo lugar); para isso, só lendo a placa (possibilidade futura).
   */

  // Histograma de cor da faixa da carroceria abaixo dos vidros (45–85% da altura da caixa):
  // 5 tons neutros (preto → branco) + 8 matizes x 2 brilhos = 21 caixas, somando 1.
  function assinaturaCor(img, caixa) {
    if (!caixa) return null;
    const { data, width, height } = img;
    const x0 = Math.max(0, Math.floor((caixa.x + caixa.w * 0.15) * width)), x1 = Math.min(width, Math.ceil((caixa.x + caixa.w * 0.85) * width));
    const y0 = Math.max(0, Math.floor((caixa.y + caixa.h * 0.45) * height)), y1 = Math.min(height, Math.ceil((caixa.y + caixa.h * 0.85) * height));
    const h = new Array(21).fill(0);
    let n = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b), v = max / 255, sat = max ? (max - min) / max : 0;
        if (sat < 0.22 || v < 0.15) h[Math.min(4, Math.floor(v * 5))]++;
        else {
          const d = max - min;
          let matiz = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
          matiz = (matiz * 60 + 360) % 360;
          h[5 + Math.floor(matiz / 45) * 2 + (v > 0.6 ? 1 : 0)]++;
        }
        n++;
      }
    }
    return n ? h.map((c) => Math.round((c / n) * 1000) / 1000) : null;
  }

  // Semelhança 0–1 (interseção de histogramas). Tons neutros vizinhos também contam:
  // branco na sombra vira cinza-claro e não deve parecer outro carro.
  function semelhancaCor(a, b) {
    if (!a || !b) return null;
    const suave = (h) => h.map((v, i) => (i < 5 ? v + (h[i - 1] || 0) * (i > 0) + (h[i + 1] || 0) * (i < 4) : v));
    const sa = suave(a), sb = suave(b);
    const total = (h) => h.reduce((s, v) => s + v, 0);
    const ta = total(sa), tb = total(sb);
    return sa.reduce((s, v, i) => s + Math.min(v / ta, sb[i] / tb), 0);
  }

  // Distância em metros entre dois pontos { lat, lon } (haversine)
  function distanciaM(a, b) {
    if (!a || !b) return null;
    const r = (g) => (g * Math.PI) / 180, R = 6371000;
    const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const mediana = (v) => { const s = [...v].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const grupoClasse = (c) => (c ? (c === "motorcycle" ? "moto" : "4rodas") : null);

  /*
   * atual/outras: { nome, cor, classe, geo: { lat, lon }, em: ms }
   * Devolve avisos (camada "mesmoVeiculo") e as medidas usadas, para o relatório.
   */
  function avaliarMesmoVeiculo(atual, outras, L) {
    const avisos = [], comparacao = {};
    const aviso = (codigo, texto) => avisos.push(erro(codigo, texto, "mesmoVeiculo"));
    const sims = outras.map((o) => semelhancaCor(atual.cor, o.cor)).filter((v) => v != null);
    if (sims.length) {
      comparacao.corMediana = Math.round(mediana(sims) * 100) / 100;
      if (comparacao.corMediana < L.corSemelhancaMin) aviso("cor", MSG.outraCor());
    }
    const grupos = outras.map((o) => grupoClasse(o.classe)).filter(Boolean);
    const g = grupoClasse(atual.classe);
    if (g && grupos.length && grupos.filter((x) => x !== g).length > grupos.length / 2) aviso("classe", MSG.outraClasse());
    const comGeo = outras.filter((o) => o.geo);
    if (atual.geo && comGeo.length) {
      const centro = { lat: mediana(comGeo.map((o) => o.geo.lat)), lon: mediana(comGeo.map((o) => o.geo.lon)) };
      comparacao.distanciaM = Math.round(distanciaM(atual.geo, centro));
      if (comparacao.distanciaM > L.distanciaMaxM) aviso("distancia", MSG.longe(comparacao.distanciaM));
    }
    const tempos = outras.map((o) => o.em).filter(Number.isFinite);
    if (Number.isFinite(atual.em) && tempos.length) {
      comparacao.intervaloMin = Math.round(Math.abs(atual.em - Math.min(...tempos)) / 60000);
      if (comparacao.intervaloMin > L.intervaloMaxMin) aviso("tempo", MSG.demorou(comparacao.intervaloMin));
    }
    return { avisos, comparacao };
  }

  return { paraCinza, nitidez, exposicao, dHash, hamming, medir, avaliarQualidade, avaliarDuplicada, avaliarEspelho, assinaturaCor, semelhancaCor, distanciaM, avaliarMesmoVeiculo, MSG, CENTRO };
});
