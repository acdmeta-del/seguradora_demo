/*
 * Vistoria (TESTE, Fase 1): carimbo no rodapé da foto (data e hora de Brasília + logo).
 * O carimbo vai numa FAIXA ABAIXO da imagem (não cobre nenhuma parte do veículo) e é
 * aplicado só na foto guardada/exportada: as medições usam a imagem sem carimbo.
 * Atenção: a hora vem do relógio do aparelho (pode ser alterada pelo usuário). A Fase 2
 * deve conferir com a hora do servidor; o relatório já guarda a hora do GPS para comparar.
 */
(function (raiz, fabrica) {
  const api = fabrica(raiz);
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.VistoriaCarimbo = api;
})(typeof self !== "undefined" ? self : this, function (raiz) {
  "use strict";

  // ms → "DD-MM-AAAA HH:MM:SS" no fuso pedido (Brasília = America/Sao_Paulo, sem horário de verão)
  function formatarDataHora(ms, fuso = "America/Sao_Paulo") {
    const partes = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", {
      timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return `${partes.day}-${partes.month}-${partes.year} ${partes.hour}:${partes.minute}:${partes.second}`;
  }

  // Logo carregado uma vez (mesma origem: não "suja" o canvas)
  let logo = null;
  function carregarLogo(url) {
    if (!logo) {
      logo = new Promise((ok) => {
        const img = new raiz.Image();
        img.onload = () => ok(img);
        img.onerror = () => ok(null); // sem logo, o carimbo sai só com o texto
        img.src = url;
      });
    }
    return logo;
  }

  /*
   * Desenha a foto com a faixa do carimbo embaixo. Devolve um canvas novo.
   *   fonte: canvas/imagem da foto; quando: ms da captura; cfg: VISTORIA_CONFIG.carimbo
   */
  async function carimbar(fonte, largura, altura, quando, cfg) {
    const faixa = Math.max(36, Math.round(Math.max(largura, altura) * cfg.alturaRelativa));
    const c = raiz.document.createElement("canvas");
    c.width = largura;
    c.height = altura + faixa;
    const g = c.getContext("2d");
    g.drawImage(fonte, 0, 0, largura, altura);
    g.fillStyle = "#111111";
    g.fillRect(0, altura, largura, faixa);
    const margem = Math.round(faixa * 0.35);
    const texto = `${formatarDataHora(quando, cfg.fuso)}  ·  ${cfg.rotuloFuso}`;
    g.fillStyle = "#FFFFFF";
    g.textBaseline = "middle";
    g.font = `700 ${Math.round(faixa * 0.42)}px Nunito, "Helvetica Neue", Arial, sans-serif`;
    g.fillText(texto, margem, altura + faixa / 2);
    const img = await carregarLogo(cfg.logo);
    if (img && img.naturalWidth) {
      const h = Math.round(faixa * 0.62), w = Math.round((img.naturalWidth / img.naturalHeight) * h);
      g.drawImage(img, largura - margem - w, altura + (faixa - h) / 2, w, h);
    }
    return { canvas: c, texto, faixa };
  }

  return { formatarDataHora, carimbar, carregarLogo };
});
