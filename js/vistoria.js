/*
 * Vistoria (TESTE, Fase 1): interface da captura guiada.
 * Câmera ao vivo → medição (vistoria-qualidade.js) e posicionamento (vistoria-posicao.js)
 * → aceitar ou refazer → revisão → relatório local (JSON/ZIP).
 * NENHUMA chamada de rede com fotos ou dados: tudo fica no aparelho (memória + IndexedDB,
 * com expiração automática). A Fase 2 troca o "aceitar" por envio ao servidor.
 */
(function () {
  "use strict";

  const CFG = window.VISTORIA_CONFIG, Q = window.VistoriaQualidade, P = window.VistoriaPosicao, K = window.VistoriaCarimbo;
  if (!CFG || !Q || !P || !K) return;

  /* ---------- Utilidades ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const arred = (v, casas = 2) => (typeof v === "number" ? Math.round(v * 10 ** casas) / 10 ** casas : v);
  const vibrar = (padrao) => { try { if (navigator.vibrate) navigator.vibrate(padrao); } catch { /* sem vibração */ } };
  const hora = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // FASE 2: REMOVER (modo desenvolvedor: envio de arquivo, "forçar aceitar", painel e sliders)
  const DEV = new URLSearchParams(location.search).get("dev") === "1";

  // Limites e camadas em uso (o painel dev ajusta ao vivo; o ajuste fica só neste navegador)
  const PADRAO = JSON.parse(JSON.stringify({ limites: CFG.limites, camadas: CFG.camadas }));
  const L = { ...CFG.limites };
  const camadas = { ...CFG.camadas };
  if (DEV) {
    try {
      const salvo = JSON.parse(localStorage.getItem("vistoria-ajustes") || "null");
      if (salvo) { Object.assign(L, salvo.limites); Object.assign(camadas, salvo.camadas); }
    } catch { /* sem armazenamento: usa o padrão */ }
  }
  const salvarAjustes = () => { try { localStorage.setItem("vistoria-ajustes", JSON.stringify({ limites: L, camadas })); } catch { /* ignora */ } };

  // Tipo de veículo (carro ou moto): define ângulos, silhuetas e classes esperadas
  let tipoId = CFG.tipoPadrao, tipo = CFG.tipos[tipoId], slots = tipo.slots;
  function definirTipo(id) {
    if (!CFG.tipos[id]) return;
    tipoId = id;
    tipo = CFG.tipos[id];
    slots = tipo.slots;
    const radio = document.querySelector(`input[name="tipo"][value="${id}"]`);
    if (radio) radio.checked = true;
  }
  const estado = {
    indice: 0,
    fotos: new Map(),     // slotId → foto aceita (ou pulada)
    pendente: null,       // foto em análise / aguardando aceitar
    tentativas: {},       // slotId → nº de capturas
    inicioSlot: {},       // slotId → início do passo (tempo de captura)
    historico: [],        // cada tentativa: camadas que reprovaram/avisaram (para comparar camadas)
    geoAtual: null,       // última posição do GPS (obrigatória para tirar foto)
    geoErro: null,
    trilha: null,         // continuidade: { inicio, deNome, amostras, ultimo, pausas, pausaDesde }
    capturando: false,
    especial: null,       // passo fora da lista de ângulos (foto de perto de avaria)
    avarias: new Map(),   // id → avaria salva
    rascunho: null,       // avaria em edição
    declaracaoAvarias: null, // null (não respondeu) | "sem" | "com"
    stream: null
  };
  const CLOSE = CFG.avarias.close;
  // Passo atual: o ângulo da lista ou o passo especial (foto de perto de avaria)
  const slotAtual = () => estado.especial || slots[estado.indice];
  const slotDe = (id) => (id === CLOSE.id ? CLOSE : slots.find((s) => s.id === id));
  const incl = P.criarInclinacao();
  const detector = P.criarDetector(CFG.deteccao);

  const el = {
    aviso: $("#v-aviso"),
    telas: { inicio: $("#v-inicio"), captura: $("#v-captura"), resultado: $("#v-resultado"), revisao: $("#v-revisao"), avarias: $("#v-avarias"), avaria: $("#v-avaria") },
    video: $("#v-video"), guia: $("#v-guia"), silhueta: $("#v-silhueta"), camErro: $("#v-camera-erro"),
    nivel: $("#v-nivel"), nivelLinha: $("#v-nivel-linha"), nivelTexto: $("#v-nivel-texto"),
    geoStatus: $("#v-geo-status"), geoErro: $("#v-geo-erro"), trilhaStatus: $("#v-trilha-status"),
    capturar: $("#v-capturar"), pular: $("#v-pular"), arquivo: $("#v-arquivo"), arquivoRotulo: $("#v-arquivo-rotulo"),
    orientacao: $("#v-orientacao-permitir"),
    previa: $("#v-previa-img"), caixa: $("#v-caixa"), status: $("#v-status"), metricas: $("#v-metricas"),
    aceitar: $("#v-aceitar"), refazer: $("#v-refazer"), forcar: $("#v-forcar")
  };

  function avisar(texto) {
    el.aviso.textContent = texto || "";
    el.aviso.hidden = !texto;
  }
  function mostrar(nome) {
    for (const [k, t] of Object.entries(el.telas)) t.hidden = k !== nome;
    document.body.classList.toggle("v-modo-camera", nome === "captura");
    if (nome !== "captura" && nome !== "resultado") pararCamera();
    // Troca de tela vai direto ao topo (o site usa rolagem suave, que aqui só atrasa)
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  /* ---------- Armazenamento local (IndexedDB) com expiração ----------
   * Guarda as fotos para não perder se o navegador recarregar a aba (comum no iOS).
   * Cada registro expira em CFG.armazenamento.expiraHoras e é apagado sozinho.
   */
  const EXPIRA_MS = CFG.armazenamento.expiraHoras * 3600 * 1000;
  const banco = (() => {
    let db = null;
    const abrir = () => new Promise((ok) => {
      try {
        const r = indexedDB.open(CFG.armazenamento.banco, 1);
        r.onupgradeneeded = () => {
          r.result.createObjectStore("fotos", { keyPath: "slotId" });
          r.result.createObjectStore("meta");
        };
        r.onsuccess = () => { db = r.result; ok(db); };
        r.onerror = () => ok(null);
      } catch { ok(null); }
    });
    const pedir = (loja, modo, fazer) => new Promise((ok) => {
      if (!db) return ok(null);
      try {
        const tx = db.transaction(loja, modo);
        const r = fazer(tx.objectStore(loja));
        tx.oncomplete = () => ok(r && r.result !== undefined ? r.result : true);
        tx.onerror = tx.onabort = () => ok(null);
      } catch { ok(null); }
    });
    return {
      abrir,
      salvarFoto: (f) => pedir("fotos", "readwrite", (s) => s.put(paraGuardar(f))),
      apagarFoto: (id) => pedir("fotos", "readwrite", (s) => s.delete(id)),
      fotos: () => pedir("fotos", "readonly", (s) => s.getAll()),
      salvarMeta: () => pedir("meta", "readwrite", (s) => s.put({ salvaEm: Date.now(), tipo: tipoId, tentativas: estado.tentativas, historico: estado.historico, inicioSlot: estado.inicioSlot, declaracaoAvarias: estado.declaracaoAvarias }, "estado")),
      salvarAvaria: (a) => pedir("fotos", "readwrite", (s) => s.put({ ...a, slotId: `avaria:${a.id}`, registro: "avaria", close: a.close ? paraGuardar(a.close) : null })),
      meta: () => pedir("meta", "readonly", (s) => s.get("estado")),
      limpar: () => Promise.all([pedir("fotos", "readwrite", (s) => s.clear()), pedir("meta", "readwrite", (s) => s.clear())])
    };
  })();
  // Tudo da foto, menos a URL temporária (blob:), que é recriada ao restaurar
  const paraGuardar = (f) => { const { url, ...resto } = f; return { ...resto, salvaEm: f.salvaEm || Date.now() }; };

  async function restaurar() {
    await banco.abrir();
    const agora = Date.now();
    const meta = await banco.meta();
    if (meta && agora - meta.salvaEm < EXPIRA_MS) {
      if (meta.tipo) definirTipo(meta.tipo);
      estado.tentativas = meta.tentativas || {};
      estado.historico = meta.historico || [];
      estado.inicioSlot = meta.inicioSlot || {};
      estado.declaracaoAvarias = meta.declaracaoAvarias || null;
    }
    let maisAntiga = null;
    for (const f of (await banco.fotos()) || []) {
      if (agora - f.salvaEm >= EXPIRA_MS) { await banco.apagarFoto(f.slotId); continue; }
      if (f.registro === "avaria") {
        const { slotId, registro, ...a } = f;
        estado.avarias.set(a.id, { ...a, close: a.close ? { ...a.close, url: a.close.blob ? URL.createObjectURL(a.close.blob) : null } : null });
        continue;
      }
      if (!slots.some((s) => s.id === f.slotId)) continue;
      estado.fotos.set(f.slotId, { ...f, url: f.blob ? URL.createObjectURL(f.blob) : null });
      maisAntiga = Math.min(maisAntiga || f.salvaEm, f.salvaEm);
    }
    if (estado.fotos.size || estado.avarias.size) {
      const r = $("#v-retomada");
      r.textContent = `Há ${estado.fotos.size} foto(s) de um teste anterior neste aparelho. Elas são apagadas sozinhas às ${hora(maisAntiga + EXPIRA_MS)}.`;
      r.hidden = false;
      $("#v-ir-revisao").hidden = false;
      $("#v-comecar").textContent = "Continuar";
    }
  }

  // Apaga sozinho o que expirou, mesmo com a página aberta
  async function expirar() {
    const agora = Date.now();
    let mudou = false;
    for (const [id, f] of estado.fotos) {
      if (agora - f.salvaEm >= EXPIRA_MS) {
        if (f.url) URL.revokeObjectURL(f.url);
        estado.fotos.delete(id);
        await banco.apagarFoto(id);
        mudou = true;
      }
    }
    for (const [id, a] of estado.avarias) {
      if (agora - a.salvaEm >= EXPIRA_MS) {
        if (a.close && a.close.url) URL.revokeObjectURL(a.close.url);
        estado.avarias.delete(id);
        await banco.apagarFoto(`avaria:${id}`);
        mudou = true;
      }
    }
    if (mudou && !el.telas.revisao.hidden) renderRevisao();
    if (mudou && !el.telas.avarias.hidden) renderAvarias();
  }

  /* ---------- Câmera ---------- */
  const MSG_CAMERA = {
    NotAllowedError: "Permissão da câmera negada. Libere a câmera para este site nas configurações do navegador e recarregue a página.",
    NotFoundError: "Nenhuma câmera encontrada neste aparelho.",
    NotReadableError: "A câmera está em uso por outro app. Feche-o e tente de novo.",
    OverconstrainedError: "A câmera não aceitou a resolução pedida. Tente de novo.",
    inseguro: "A câmera só funciona em endereço seguro (https:// ou localhost).",
    semSuporte: "Este navegador não dá acesso à câmera. Use o Chrome (Android) ou o Safari (iPhone) atualizados."
  };
  function erroCamera(texto) {
    el.camErro.textContent = texto + (DEV ? " No modo dev, use “Enviar arquivo”." : "");
    el.camErro.hidden = false;
    el.capturar.disabled = true;
  }
  async function abrirCamera() {
    if (estado.stream) {
      const t = estado.stream.getVideoTracks()[0];
      if (t && t.readyState === "live") return true;
      pararCamera(); // câmera encerrada (outro app, bloqueio de tela): abre de novo
    }
    el.camErro.hidden = true;
    if (!window.isSecureContext) { erroCamera(MSG_CAMERA.inseguro); return false; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { erroCamera(MSG_CAMERA.semSuporte); return false; }
    try {
      estado.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: CFG.camera.largura }, height: { ideal: CFG.camera.altura } },
        audio: false
      });
      el.video.srcObject = estado.stream;
      await el.video.play().catch(() => {});
      return true;
    } catch (e) {
      erroCamera(MSG_CAMERA[e && e.name] || `Não foi possível abrir a câmera (${(e && e.name) || "erro"}).`);
      return false;
    }
  }
  function pararCamera() {
    if (!estado.stream) return;
    estado.stream.getTracks().forEach((t) => t.stop());
    estado.stream = null;
    el.video.srcObject = null;
  }

  /* ---------- Localização (OBRIGATÓRIA) ----------
   * Sem uma posição recente do GPS (L.geoIdadeMaxS), o botão de foto fica desativado.
   * A posição e o horário vão em cada foto (relatório) e o horário também no carimbo.
   */
  const MSG_GEO = {
    1: "A localização é obrigatória e foi negada. No iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › “Durante o Uso”; depois, no Safari, toque em “aA” › Ajustes do Site › Localização › Permitir. No Android (Chrome): toque no cadeado ao lado do endereço › Permissões › Localização › Permitir. Depois, recarregue a página.",
    2: "Não foi possível obter a localização. Ligue o GPS (Serviços de Localização) e vá para um lugar aberto.",
    semSuporte: "Este navegador não fornece a localização, que é obrigatória. Use o Chrome (Android) ou o Safari (iPhone) atualizados."
  };
  const geoOk = () => Boolean(estado.geoAtual) && Date.now() - estado.geoAtual.recebidoEm <= L.geoIdadeMaxS * 1000;
  function receberGeo(p) {
    estado.geoAtual = {
      lat: arred(p.coords.latitude, 6), lon: arred(p.coords.longitude, 6), precisaoM: Math.round(p.coords.accuracy),
      gpsEm: p.timestamp, recebidoEm: Date.now()
    };
    estado.geoErro = null;
    atualizarBotao();
  }
  function falhaGeo(e) {
    // Tempo esgotado: continua tentando, sem mensagem de erro
    if (e && e.code === 3) return atualizarBotao();
    estado.geoErro = MSG_GEO[e && e.code] || MSG_GEO[2];
    atualizarBotao();
  }
  let geoIniciado = false;
  function iniciarGeo() {
    if (!navigator.geolocation) { estado.geoErro = MSG_GEO.semSuporte; atualizarBotao(); return; }
    if (geoIniciado) return;
    geoIniciado = true;
    navigator.geolocation.watchPosition(receberGeo, falhaGeo, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    // Parado no mesmo lugar o GPS pode não mandar novidade: renova a posição de tempos em tempos
    setInterval(() => {
      if (!el.telas.captura.hidden && !document.hidden) navigator.geolocation.getCurrentPosition(receberGeo, falhaGeo, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
      atualizarBotao();
    }, 20000);
  }
  // O botão de foto só funciona com câmera aberta E localização recente
  function atualizarBotao() {
    const ok = geoOk();
    const g = estado.geoAtual;
    el.geoStatus.textContent = ok ? `📍 Localização ok (±${g.precisaoM} m)` : estado.geoErro ? "📍 Sem localização" : "📍 Localizando…";
    el.geoStatus.classList.toggle("v-chip--ok", ok);
    el.geoErro.textContent = estado.geoErro || "";
    el.geoErro.hidden = !estado.geoErro;
    el.capturar.disabled = !(estado.stream && ok);
    el.arquivo.disabled = !ok;
  }

  // Gira a imagem em ±90° (devolve um canvas, que serve de fonte para as medições)
  function girar(fonte, largura, altura, graus) {
    const c = document.createElement("canvas");
    c.width = altura;
    c.height = largura;
    const ctx = c.getContext("2d");
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((graus * Math.PI) / 180);
    ctx.drawImage(fonte, -largura / 2, -altura / 2, largura, altura);
    return c;
  }
  // Põe a foto na posição em que o celular estava (ver P.rotacaoNecessaria)
  function corrigirPosicao(foto, inclinacao) {
    const graus = P.rotacaoNecessaria(foto.largura, foto.altura, inclinacao);
    if (!graus) return foto;
    const c = girar(foto.fonte, foto.largura, foto.altura, graus);
    if (foto.fonte.close) foto.fonte.close();
    return { ...foto, fonte: c, largura: c.width, altura: c.height, rotacao: graus };
  }

  // Foto em resolução cheia (ImageCapture) ou o quadro atual do vídeo
  async function tirarFoto(inclinacao) {
    const v = el.video;
    const track = estado.stream && estado.stream.getVideoTracks()[0];
    if (CFG.camera.usarTakePhoto && track && "ImageCapture" in window) {
      try {
        const blob = await new window.ImageCapture(track).takePhoto();
        const bmp = await createImageBitmap(blob);
        const foto = corrigirPosicao({ fonte: bmp, largura: bmp.width, altura: bmp.height, origem: "takePhoto" }, inclinacao);
        // Sem sensor para saber o lado: se a foto não bate com o vídeo (retrato x paisagem), usa o vídeo
        const semSensor = !inclinacao || inclinacao.deitado;
        const discorda = semSensor && v.videoWidth && (v.videoWidth > v.videoHeight) !== (foto.largura > foto.altura);
        if (!discorda) return foto;
        if (foto.fonte.close) foto.fonte.close();
      } catch { /* cai no quadro do vídeo */ }
    }
    if (!v.videoWidth) throw new Error("A câmera ainda não está pronta. Espere a imagem aparecer.");
    return corrigirPosicao({ fonte: v, largura: v.videoWidth, altura: v.videoHeight, origem: "video" }, inclinacao);
  }

  /* ---------- Silhuetas (js/vistoria-silhuetas.js) e guia sobre a câmera ---------- */
  const SILHUETAS = window.VistoriaSilhuetas || {};
  // Vídeo em pé com o celular deitado = a imagem chega "de lado" na tela (iPhone com a tela travada em pé)
  const videoEmPe = () => (el.video.videoHeight || window.innerHeight) > (el.video.videoWidth || window.innerWidth);
  const giroGuia = (i) => (videoEmPe() && i && i.paisagem && !i.deitado ? i.quarto * 90 : 0);

  function renderSilhueta(slot) {
    el.silhueta.hidden = !camadas.silhueta;
    if (!camadas.silhueta) return;
    // Faixa de largura esperada do veículo (ângulos externos), como guia de distância
    const faixa = (f) => `<rect class="v-silhueta__faixa" x="${200 - f * 200}" y="8" width="${f * 400}" height="209" rx="6"/>`;
    const [min, max] = slot.largura || [L.larguraMin, L.larguraMax];
    const guia = slot.externo && slot.medida !== "maior" ? faixa(max) + faixa(min) : "";
    el.silhueta.innerHTML = `<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid meet">${guia}<g class="v-silhueta__forma"${slot.espelhar ? ' transform="translate(400 0) scale(-1 1)"' : ""}>${SILHUETAS[slot.silhueta] || ""}</g></svg>`;
    posicionarGuia(true);
  }

  /*
   * A guia ocupa exatamente a área visível do vídeo (object-fit: contain). Se o vídeo chega em
   * pé com o celular deitado (tela travada em pé), a silhueta gira junto com o mundo, como os
   * ícones do app de câmera.
   */
  let chaveGuia = "";
  function posicionarGuia(forcar) {
    const graus = giroGuia(incl.ultimo);
    const v = el.video;
    const cw = v.clientWidth, ch = v.clientHeight;
    const vw = v.videoWidth || cw, vh = v.videoHeight || ch;
    const chave = [v.offsetLeft, v.offsetTop, cw, ch, vw, vh, graus].join(",");
    if (!forcar && chave === chaveGuia) return;
    chaveGuia = chave;
    const k = Math.min(cw / vw, ch / vh) || 1;
    const w = vw * k, h = vh * k;
    Object.assign(el.guia.style, { left: `${v.offsetLeft + (cw - w) / 2}px`, top: `${v.offsetTop + (ch - h) / 2}px`, width: `${w}px`, height: `${h}px` });
    // Girada: a silhueta fica com as medidas trocadas, centrada, e gira em torno do próprio centro
    const sw = graus ? h : w, sh = graus ? w : h;
    Object.assign(el.silhueta.style, { width: `${sw}px`, height: `${sh}px`, left: `${(w - sw) / 2}px`, top: `${(h - sh) / 2}px`, transform: graus ? `rotate(${graus}deg)` : "" });
  }
  el.video.addEventListener("loadedmetadata", () => posicionarGuia(true));
  el.video.addEventListener("resize", () => posicionarGuia(true));
  window.addEventListener("resize", () => posicionarGuia(true));

  /* ---------- Nível do celular (camada inclinação) ---------- */
  function atualizarNivel(i) {
    const slot = slotAtual();
    if (!camadas.inclinacao || !slot || !slot.externo || el.telas.captura.hidden) { el.nivel.hidden = true; return; }
    el.nivel.hidden = false;
    const r = P.avaliarInclinacao(i, slot, L);
    // A linha acompanha o horizonte real; com a tela em pé e o celular deitado, gira 90° junto
    el.nivelLinha.style.transform = `rotate(${giroGuia(i) + i.roll}deg)`;
    el.nivel.classList.toggle("v-nivel--ok", !r.erros.length);
    el.nivelTexto.textContent = r.erros.length ? (r.erros[0].codigo === "roll" ? `Endireite ${Math.round(Math.abs(i.roll))}°` : "Deixe o celular em pé") : "Reto ✓";
  }
  incl.aoAtualizar((i) => { atualizarNivel(i); if (!el.telas.captura.hidden) posicionarGuia(); });

  /* ---------- Continuidade entre as fotos (vistoria-posicao.js, seção 5) ----------
   * Começa quando uma foto de ângulo externo é aceita e segue até a próxima captura.
   * O tempo olhando o resultado de uma tentativa (antes de "Tirar de novo") é pausa: não conta.
   */
  function iniciarTrilha(slot) {
    estado.trilha = camadas.continuidade && slot.externo
      ? { inicio: Date.now(), deNome: slot.nome, amostras: [], rastro: null, pausas: [], pausaDesde: null }
      : null;
  }
  function fimPausaTrilha() {
    const t = estado.trilha;
    if (t && t.pausaDesde) { t.pausas.push([t.pausaDesde, Date.now()]); t.pausaDesde = null; }
  }
  const trilhaAtiva = () => {
    const slot = slotAtual();
    return Boolean(camadas.continuidade && estado.trilha && slot && slot.externo);
  };
  function atualizarTrilhaStatus() {
    const ativa = trilhaAtiva() && !el.telas.captura.hidden;
    el.trilhaStatus.hidden = !ativa || detector.estado !== "pronto";
    if (el.trilhaStatus.hidden) return;
    const a = estado.trilha.amostras[estado.trilha.amostras.length - 1];
    const vendo = Boolean(a && a.caixa);
    el.trilhaStatus.textContent = vendo ? "🔗 Acompanhando o veículo" : "🔗 Aponte para o veículo";
    el.trilhaStatus.classList.toggle("v-chip--ok", vendo);
  }
  let amostrando = false;
  const canvasTrilha = document.createElement("canvas");
  async function amostrarTrilha() {
    atualizarTrilhaStatus();
    const v = el.video;
    if (amostrando || estado.capturando || !trilhaAtiva() || el.telas.captura.hidden || document.hidden || detector.estado !== "pronto" || !v.videoWidth) return;
    amostrando = true;
    try {
      const k = Math.min(1, 320 / Math.max(v.videoWidth, v.videoHeight));
      canvasTrilha.width = Math.round(v.videoWidth * k);
      canvasTrilha.height = Math.round(v.videoHeight * k);
      const ctx = canvasTrilha.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, canvasTrilha.width, canvasTrilha.height);
      const veiculos = await detector.detectarVarios(canvasTrilha, canvasTrilha.width, canvasTrilha.height, L.deteccaoScore);
      const t = estado.trilha;
      if (!t || veiculos == null) return;
      // Aparência de cada veículo (dHash do recorte): separa "mesmo veículo" de "outro" num salto
      if (veiculos.length) {
        const cinza = Q.paraCinza(ctx.getImageData(0, 0, canvasTrilha.width, canvasTrilha.height));
        for (const vv of veiculos) vv.hash = Q.dHash(cinza, { regiao: vv.caixa });
      }
      const r = P.passoTrilha(t.rastro, veiculos, Date.now(), canvasTrilha.width / canvasTrilha.height, L);
      t.rastro = r.estado;
      t.amostras.push(r.amostra);
      if (t.amostras.length > 1200) t.amostras.shift(); // ~10 min
    } catch { /* uma olhada perdida não atrapalha */ } finally {
      amostrando = false;
    }
    atualizarTrilhaStatus();
  }
  setInterval(amostrarTrilha, CFG.limites.continuidadeIntervaloMs);

  /* ---------- Fluxo ---------- */
  const proximoPendente = (de = 0) => {
    for (let k = 0; k < slots.length; k++) {
      const i = (de + k) % slots.length;
      if (!estado.fotos.has(slots[i].id)) return i;
    }
    return -1;
  };

  async function irPara(indice) {
    fimPausaTrilha();
    estado.especial = null;
    estado.indice = indice;
    const slot = slots[indice];
    estado.inicioSlot[slot.id] = estado.inicioSlot[slot.id] || Date.now();
    const feitas = slots.filter((s) => estado.fotos.has(s.id)).length;
    $("#v-progresso-fill").style.width = `${(feitas / slots.length) * 100}%`;
    $(".v-progresso__barra").setAttribute("aria-valuenow", String(feitas));
    $(".v-progresso__barra").setAttribute("aria-valuemax", String(slots.length));
    $("#v-progresso-texto").textContent = `Foto ${indice + 1} de ${slots.length} · ${feitas} pronta(s)`;
    $("#v-slot-nome").textContent = slot.nome;
    $("#v-slot-instrucao").textContent = slot.instrucao;
    el.pular.hidden = !slot.opcional;
    el.pular.textContent = "Pular (não se aplica)";
    mostrar("captura");
    renderSilhueta(slot);
    el.orientacao.hidden = !(camadas.inclinacao && slot.externo && incl.precisaPermissao() && !incl.ativo);
    if (incl.ultimo) atualizarNivel(incl.ultimo); else el.nivel.hidden = true;
    if (slot.externo && camadas.deteccao) prepararDetector();
    // O botão fica desativado durante a análise da foto anterior: libera de novo aqui (se houver GPS)
    await abrirCamera();
    atualizarBotao();
  }

  function prepararDetector() {
    if (detector.estado !== "desligado" && detector.estado !== "erro") return detector.carregar();
    atualizarStatusDetector();
    return detector.carregar().then(atualizarStatusDetector);
  }
  function atualizarStatusDetector() {
    const t = { desligado: "Detector: desligado", carregando: "Detector: carregando o modelo local…", pronto: `Detector: pronto (${detector.backend || "?"}, ${detector.tempoCargaMs} ms para carregar)`, erro: `Detector: erro. ${detector.erro}` }[detector.estado];
    $("#v-detector-status").textContent = t;
    // Erro do modelo é sempre visível, também fora do modo dev
    if (detector.estado === "erro") avisar(detector.erro);
    else if (el.aviso.textContent === detector.erro) avisar("");
  }

  async function capturar(origemArquivo) {
    const slot = slotAtual();
    if (!geoOk()) { atualizarBotao(); return; } // localização obrigatória
    el.capturar.disabled = true;
    estado.capturando = true;
    el.status.textContent = "";
    try {
      const quando = Date.now();                                    // horário do clique (carimbo)
      const geo = { ...estado.geoAtual, idadeS: Math.round((quando - estado.geoAtual.recebidoEm) / 1000) };
      const inclinacao = incl.ultimo ? { ...incl.ultimo } : null; // no momento do clique
      // Trajeto desde a foto anterior até este clique (continuidade); a análise que vem é pausa
      // Sem detector pronto não há olhadas: sem opinião (não vira "veículo fora da câmera")
      const t = trilhaAtiva() && detector.estado === "pronto" ? estado.trilha : null;
      const trilha = t ? { inicio: t.inicio, fim: quando, deNome: t.deNome, amostras: t.amostras.slice(), pausas: t.pausas.slice() } : null;
      if (t) t.pausaDesde = quando;
      const foto = origemArquivo ? await deArquivo(origemArquivo) : await tirarFoto(inclinacao);
      estado.tentativas[slot.id] = (estado.tentativas[slot.id] || 0) + 1;
      mostrarResultadoCarregando(slot);
      estado.pendente = await analisar(foto, slot, inclinacao, quando, geo);
      estado.pendente.trilha = trilha;
      if (foto.fonte && foto.fonte.close) foto.fonte.close();
      avaliarEExibir();
      banco.salvarMeta();
      estado.capturando = false;
    } catch (e) {
      estado.capturando = false;
      erroCamera(e.message || "Não foi possível tirar a foto.");
      mostrar("captura");
      atualizarBotao();
    }
  }

  // FASE 2: REMOVER (envio de arquivo só no ?dev=1)
  async function deArquivo(file) {
    const bmp = await createImageBitmap(file);
    return { fonte: bmp, largura: bmp.width, altura: bmp.height, origem: "arquivo-dev" };
  }

  function canvasDe(fonte, largura, altura, ladoMaior) {
    const f = ladoMaior ? Math.min(1, ladoMaior / Math.max(largura, altura)) : 1;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(largura * f));
    c.height = Math.max(1, Math.round(altura * f));
    c.getContext("2d", { willReadFrequently: true }).drawImage(fonte, 0, 0, c.width, c.height);
    return c;
  }
  const paraBlob = (canvas, qualidade) => new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));

  async function analisar({ fonte, largura, altura, origem, rotacao = 0 }, slot, inclinacao, quando, geo) {
    const t0 = performance.now();
    // A foto guardada leva o carimbo (data e hora de Brasília + logo) numa faixa abaixo da imagem;
    // as medições usam a imagem sem carimbo
    const carimbo = await K.carimbar(canvasDe(fonte, largura, altura), largura, altura, quando, CFG.carimbo);
    const blob = await paraBlob(carimbo.canvas, CFG.camera.qualidadeJpeg);
    const ca = canvasDe(fonte, largura, altura, CFG.analise.ladoMaior);
    const img = ca.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, ca.width, ca.height);
    const medidas = Q.medir(img, { largura, altura });
    const foto = {
      slotId: slot.id, blob, url: URL.createObjectURL(blob), largura, altura, origem, rotacao,
      tipo: tipoId, capturadaEm: new Date(quando).toISOString(), carimbo: carimbo.texto, tentativa: estado.tentativas[slot.id],
      medidas, inclinacao, deteccao: null, angulo: null, extensao: null, geo
    };
    if (slot.externo && camadas.deteccao) {
      await prepararDetector();
      foto.deteccao = await detector.detectar(ca, ca.width, ca.height).catch(() => null);
      if (foto.deteccao && foto.deteccao.encontrado) {
        // Hash só do recorte do veículo: melhora a comparação entre laterais (menos fundo)
        const cinza = Q.paraCinza(img);
        foto.medidas.hashCaixa = Q.dHash(cinza, { regiao: foto.deteccao.caixa });
        foto.medidas.hashCaixaEspelho = Q.dHash(cinza, { regiao: foto.deteccao.caixa, espelhar: true });
        // Cor da carroceria: compara com as outras fotos (mesmo veículo?)
        foto.medidas.cor = Q.assinaturaCor(img, foto.deteccao.caixa);
      }
    }
    foto.extensao = await P.analisarFoto({ canvas: ca, largura, altura, blob }, slot).catch(() => null);
    foto.tempoAnaliseMs = Math.round(performance.now() - t0);
    return foto;
  }

  /* ---------- Decisão (todas as camadas) ---------- */
  const ACEITAS = new Set(["aprovada", "forcada"]);
  function avaliar(foto) {
    const slot = slotDe(foto.slotId);
    const erros = [], avisos = [], extras = {};
    const juntar = (r) => { erros.push(...(r.erros || [])); avisos.push(...(r.avisos || [])); };
    const m = foto.medidas;
    if (camadas.qualidade) juntar(Q.avaliarQualidade(m, slot, L));
    if (slot.id === CLOSE.id) {
      if (foto.geo && foto.geo.precisaoM > L.geoPrecisaoMaxM) avisos.push({ codigo: "precisao", texto: `Localização imprecisa (±${foto.geo.precisaoM} m).`, camada: "geo" });
      return { aprovada: erros.length === 0, erros, avisos, extras };
    }
    if (camadas.duplicada) {
      const outras = [...estado.fotos.values()].filter((f) => f.slotId !== foto.slotId && ACEITAS.has(f.status) && f.medidas)
        .map((f) => ({ slotId: f.slotId, nome: nomeDe(f.slotId), hash: f.medidas.hash }));
      const r = Q.avaliarDuplicada(m.hash, outras, L);
      extras.maisParecida = r.maisPerto;
      juntar(r);
    }
    if (camadas.mesmoVeiculo) {
      // Cor só onde funciona (tipo.compararCor): carro sim; moto não
      const resumo = (f) => ({ cor: tipo.compararCor && f.medidas ? f.medidas.cor : null, classe: f.deteccao && f.deteccao.encontrado ? f.deteccao.classe : null, geo: f.geo, em: Date.parse(f.capturadaEm) });
      const outras = [...estado.fotos.values()].filter((f) => f.slotId !== foto.slotId && ACEITAS.has(f.status)).map(resumo);
      const r = Q.avaliarMesmoVeiculo(resumo(foto), outras, L);
      extras.mesmoVeiculo = r.comparacao;
      juntar(r);
    }
    if (camadas.continuidade && foto.trilha) {
      const r = P.avaliarContinuidade(foto.trilha.amostras, foto.trilha.inicio, foto.trilha.fim, foto.trilha.deNome, L, foto.trilha.pausas);
      if (r) { extras.continuidade = r.metricas; juntar(r); }
    }
    // Localização obrigatória (sempre presente); precisão ruim só avisa
    if (foto.geo && foto.geo.precisaoM > L.geoPrecisaoMaxM) {
      avisos.push({ codigo: "precisao", texto: `Localização imprecisa (±${foto.geo.precisaoM} m): se puder, vá para um lugar mais aberto.`, camada: "geo" });
    }
    if (camadas.espelho) {
      const par = tipo.espelhos.find((p) => p.includes(foto.slotId));
      const outroId = par && par.find((id) => id !== foto.slotId);
      const outra = outroId && estado.fotos.get(outroId);
      if (outra && ACEITAS.has(outra.status) && outra.medidas) {
        const r = Q.avaliarEspelho(m, outra.medidas, nomeDe(outroId), L);
        extras.espelho = r.comparacao;
        juntar(r);
      }
    }
    if (camadas.inclinacao) juntar(P.avaliarInclinacao(foto.inclinacao, slot, L));
    if (camadas.deteccao && slot.externo) {
      if (foto.deteccao) juntar(P.avaliarEnquadramento(foto.deteccao, slot, L, tipo));
      else if (detector.estado === "erro") avisos.push({ codigo: "detector_erro", texto: detector.erro, camada: "deteccao" });
    }
    if (camadas.angulo) {
      foto.angulo = P.estimarAngulo(foto.deteccao, slot, tipo.faixasAngulo, tipo);
      juntar(P.avaliarAngulo(foto.angulo, slot));
    }
    if (foto.extensao) juntar(foto.extensao);
    return { aprovada: erros.length === 0, erros, avisos, extras };
  }
  const nomeDe = (id) => (slots.find((s) => s.id === id) || {}).nome || id;

  /* ---------- Resultado ---------- */
  function mostrarResultadoCarregando(slot) {
    $("#v-resultado-titulo").textContent = `${slot.nome}: analisando…`;
    el.previa.removeAttribute("src");
    el.status.innerHTML = "<p>Conferindo nitidez, luz e enquadramento…</p>";
    el.aceitar.disabled = true;
    el.forcar.hidden = true;
    el.caixa.hidden = true;
    el.metricas.hidden = true;
    mostrar("resultado");
  }

  function avaliarEExibir(registrar = true) {
    const foto = estado.pendente;
    if (!foto) return;
    const slot = slotDe(foto.slotId);
    const r = avaliar(foto);
    foto.resultado = r;
    if (registrar) {
      estado.historico.push({
        slotId: foto.slotId, tentativa: foto.tentativa, em: foto.capturadaEm, aprovada: r.aprovada,
        erros: r.erros.map((e) => `${e.camada}:${e.codigo}`), avisos: r.avisos.map((e) => `${e.camada}:${e.codigo}`)
      });
      vibrar(r.aprovada ? 40 : [60, 40, 60]);
    }
    $("#v-resultado-titulo").textContent = r.aprovada ? `${slot.nome}: foto aprovada` : `${slot.nome}: precisa tirar de novo`;
    el.previa.src = foto.url;
    el.previa.alt = `Prévia da foto: ${slot.nome}`;
    const item = (e, tipo) => `<li class="v-motivo v-motivo--${tipo}"><span aria-hidden="true">${tipo === "erro" ? "✕" : "!"}</span> ${esc(e.texto)}</li>`;
    el.status.innerHTML = `
      <p class="v-selo v-selo--${r.aprovada ? "ok" : "erro"}">${r.aprovada ? "Aprovada" : "Reprovada"}</p>
      ${r.erros.length ? `<ul class="v-motivos">${r.erros.map((e) => item(e, "erro")).join("")}</ul>` : ""}
      ${r.avisos.length ? `<p class="v-nota">Avisos (não impedem):</p><ul class="v-motivos">${r.avisos.map((e) => item(e, "aviso")).join("")}</ul>` : ""}`;
    el.aceitar.disabled = !r.aprovada;
    el.forcar.hidden = !(DEV && !r.aprovada);
    desenharCaixa(foto);
    if (DEV) renderMetricas(foto, r);
  }

  function desenharCaixa(foto) {
    const d = foto.deteccao;
    if (!DEV || !d || !d.encontrado) { el.caixa.hidden = true; return; }
    Object.assign(el.caixa.style, { left: `${d.caixa.x * 100}%`, top: `${d.caixa.y * 100}%`, width: `${d.caixa.w * 100}%`, height: `${d.caixa.h * 100}%` });
    el.caixa.textContent = `${d.classe} ${Math.round(d.score * 100)}%`;
    el.caixa.hidden = false;
  }

  // FASE 2: REMOVER (métricas e limites, só no ?dev=1)
  function renderMetricas(foto, r) {
    const m = foto.medidas, d = foto.deteccao, a = foto.angulo, i = foto.inclinacao;
    const linhas = [
      ["Resolução", `${m.largura}×${m.altura}`, `≥ ${L.resolucaoMaior}×${L.resolucaoMenor}`],
      ["Origem", `${foto.origem}${foto.rotacao ? ` (girada ${foto.rotacao}°)` : ""}`, ""],
      ["Nitidez", arred(m.nitidez, 1), `≥ ${L.nitidez}`],
      ["Nitidez do centro", arred(m.nitidezCentro, 1), `≥ ${L.nitidezCentro}`],
      ["Luminância média", arred(m.media, 1), `${L.lumMin} a ${L.lumMax}`],
      ["Estourados", `${arred(m.estourados * 100, 1)}%`, `≤ ${arred(L.estouradosMax * 100, 1)}%`],
      ["Escuros", `${arred(m.escuros * 100, 1)}%`, `≤ ${arred(L.escurosMax * 100, 1)}%`],
      ["Contraluz (centro/bordas)", arred(m.contraluz), `≥ ${L.contraluzRazao}`],
      ["dHash / espelhado", `${m.hash} / ${m.hashEspelho}`, ""],
      ["Mais parecida", r.extras.maisParecida ? `${r.extras.maisParecida.nome}: ${r.extras.maisParecida.distancia}` : "—", `aviso ≤ ${L.parecidaDist}, ≤ ${L.duplicadaDist}`],
      ["Lado repetido (direto/espelhado)", r.extras.espelho ? `${r.extras.espelho.direto} / ${r.extras.espelho.espelhado}${r.extras.espelho.usouCaixa ? " (recorte)" : ""}` : "—", `aviso se direto + ${L.espelhoMargem} ≤ espelhado`],
      ["Inclinação (pitch / roll)", i ? `${arred(i.pitch, 1)}° / ${arred(i.roll, 1)}°` : "sem sensor", `|pitch| ≤ ${L.pitchMax}°, |roll| ≤ ${L.rollMax}°`],
      ["Veículo", d ? (d.encontrado ? `${d.classe} ${arred(d.score)}` : "não encontrado") : "—", `score ≥ ${L.deteccaoScore}`],
      ["Caixa (x, y, larg., alt.)", d && d.encontrado ? [d.caixa.x, d.caixa.y, d.caixa.w, d.caixa.h].map((v) => arred(v)).join(", ") : "—", (() => { const s0 = slots.find((x) => x.id === foto.slotId) || {}; const [a0, b0] = s0.largura || [L.larguraMin, L.larguraMax]; return `${s0.medida === "maior" ? "maior lado" : "larg."} ${a0} a ${b0}, centro ≤ ${L.centroMax}`; })()],
      ["Detecção (ms)", d ? d.tempoMs : "—", ""],
      ["Ângulo estimado", a ? `${a.grupo} (prop. ${a.proporcao})` : "—", tipo.faixasAngulo.map((f) => `${f.grupo} < ${f.ate}`).join("; ")],
      ["Confiança do ângulo", a ? a.confianca : "—", "bloqueia só com alta"],
      ["Localização", foto.geo ? `${foto.geo.lat}, ${foto.geo.lon} (±${foto.geo.precisaoM} m, ${foto.geo.idadeS} s)` : "—", `obrigatória, ≤ ${L.geoIdadeMaxS} s; aviso se > ${L.geoPrecisaoMaxM} m`],
      ["Carimbo", foto.carimbo || "—", CFG.carimbo.rotuloFuso],
      ["Mesmo veículo: cor (mediana)", r.extras.mesmoVeiculo && r.extras.mesmoVeiculo.corMediana != null ? r.extras.mesmoVeiculo.corMediana : "—", `aviso < ${L.corSemelhancaMin}`],
      ["Mesmo veículo: distância / tempo", r.extras.mesmoVeiculo ? `${r.extras.mesmoVeiculo.distanciaM ?? "—"} m / ${r.extras.mesmoVeiculo.intervaloMin ?? "—"} min` : "—", `aviso > ${L.distanciaMaxM} m ou > ${L.intervaloMaxMin} min`],
      ["Continuidade", r.extras.continuidade ? (({ deSlot, duracaoS, visivelPct, maiorLacunaS, saltos }) => `desde “${deSlot}”: ${duracaoS} s, veículo à vista ${visivelPct}%, maior lacuna ${maiorLacunaS} s, ${saltos} salto(s)`)(r.extras.continuidade) : "—", `aviso: lacuna > ${L.continuidadeLacunaMaxS} s ou salto`],
      ["Trilha (| à vista, . fora, ? outro ponto, r retomou, x salto)", r.extras.continuidade ? r.extras.continuidade.linha || "(sem olhadas)" : "—", `1 olhada a cada ${CFG.limites.continuidadeIntervaloMs} ms`],
      ["Análise total (ms)", foto.tempoAnaliseMs, ""],
      ["Tentativa", foto.tentativa, ""]
    ];
    el.metricas.innerHTML = `<table><caption>Métricas medidas x limites</caption><thead><tr><th>Medida</th><th>Valor</th><th>Limite</th></tr></thead><tbody>${
      linhas.map(([k, v, lim]) => `<tr><th scope="row">${esc(k)}</th><td${k.startsWith("Trilha") ? ' class="v-trilha-linha"' : ""}>${esc(v)}</td><td>${esc(lim)}</td></tr>`).join("")}</tbody></table>`;
    el.metricas.hidden = false;
  }

  async function aceitar(forcada) {
    const foto = estado.pendente;
    if (!foto || (!foto.resultado.aprovada && !forcada)) return;
    if (foto.slotId === CLOSE.id) return aceitarClose(foto);
    const anterior = estado.fotos.get(foto.slotId);
    if (anterior && anterior.url) URL.revokeObjectURL(anterior.url);
    foto.status = foto.resultado.aprovada ? "aprovada" : "forcada";
    foto.duracaoMs = Date.now() - (estado.inicioSlot[foto.slotId] || Date.now());
    foto.salvaEm = Date.now();
    estado.fotos.set(foto.slotId, foto);
    estado.pendente = null;
    delete estado.inicioSlot[foto.slotId];
    iniciarTrilha(slots.find((s) => s.id === foto.slotId) || {});
    await banco.salvarFoto(foto);
    await banco.salvarMeta();
    avancar();
  }
  function refazer() {
    if (estado.pendente && estado.pendente.url) URL.revokeObjectURL(estado.pendente.url);
    estado.pendente = null;
    if (estado.especial) abrirClose(); else irPara(estado.indice);
  }
  async function pular() {
    if (estado.especial) { estado.pendente = null; return voltarAoFormulario(); }
    const slot = slots[estado.indice];
    const foto = { slotId: slot.id, status: "pulada", salvaEm: Date.now(), capturadaEm: new Date().toISOString(), tentativa: estado.tentativas[slot.id] || 0 };
    estado.fotos.set(slot.id, foto);
    estado.trilha = null;
    await banco.salvarFoto(foto);
    avancar();
  }
  function avancar() {
    const i = proximoPendente(estado.indice + 1);
    if (i >= 0) return irPara(i);
    // Fim dos ângulos: passo das avarias (se ainda não respondido), depois a revisão
    if (!estado.declaracaoAvarias) { renderAvarias(); mostrar("avarias"); } else { renderRevisao(); mostrar("revisao"); }
  }

  /* ---------- Avarias (marcação manual) ----------
   * Cada avaria: foto de referência + ponto tocado (x, y de 0 a 1 na área da foto, sem a faixa
   * do carimbo), tipo, região, observação e uma foto de perto (mesma câmera, validações de
   * qualidade, GPS e carimbo). A declaração "não tem avarias" também vai para o relatório.
   */
  const avariasOrdenadas = () => [...estado.avarias.values()].sort((a, b) => a.criadaEm - b.criadaEm);
  function renderAvarias() {
    const lista = avariasOrdenadas();
    const dec = $("#v-avarias-declaracao");
    dec.hidden = !(estado.declaracaoAvarias === "sem" && !lista.length);
    dec.textContent = "Você declarou que o veículo não tem avarias. Se encontrar alguma, registre abaixo.";
    $("#v-sem-avarias").hidden = lista.length > 0 || estado.declaracaoAvarias === "sem";
    $("#v-avaria-nova").disabled = lista.length >= CFG.avarias.maximo;
    $("#v-avarias-lista").innerHTML = lista.map((a, i) => `
      <li class="v-item v-item--avaria">
        ${a.close && a.close.url ? `<img src="${esc(a.close.url)}" alt="" width="160" height="90">` : '<span class="v-item__vazio" aria-hidden="true"></span>'}
        <span class="v-item__texto"><strong>${i + 1}. ${esc(a.tipo)} · ${esc(a.regiao)}</strong>
          <span class="v-item__status">${a.refSlot ? `Marcada na foto “${esc(nomeDe(a.refSlot))}”` : "Não aparece nas fotos dos ângulos"}</span>
          ${a.observacao ? `<span class="v-nota">${esc(a.observacao)}</span>` : ""}</span>
        <button class="btn btn--outline" type="button" data-remover-avaria="${esc(a.id)}">Remover<span class="visually-hidden"> avaria ${i + 1}</span></button>
      </li>`).join("");
  }

  function novaAvaria() {
    if (estado.avarias.size >= CFG.avarias.maximo) return;
    estado.rascunho = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, refSlot: null, semFoto: false, ponto: null, tipo: null, regiao: "", observacao: "", close: null };
    renderAvariaForm();
    mostrar("avaria");
  }

  function renderAvariaForm() {
    const r = estado.rascunho;
    if (!r) return;
    $("#v-avaria-titulo").textContent = `Avaria ${estado.avarias.size + 1}`;
    // 1. Fotos dos ângulos já aceitas (externas e internas), ou "não aparece nas fotos"
    const fotos = slots.filter((s) => { const f = estado.fotos.get(s.id); return f && f.url; });
    $("#v-avaria-fotos").innerHTML = fotos.map((s) => `
      <button class="v-avaria-foto" type="button" data-ref="${esc(s.id)}" aria-pressed="${r.refSlot === s.id}">
        <img src="${esc(estado.fotos.get(s.id).url)}" alt="">${esc(s.nome)}</button>`).join("") +
      `<button class="v-avaria-foto v-avaria-foto--nenhuma" type="button" data-ref="" aria-pressed="${r.semFoto}">Não aparece nas fotos</button>`;
    // 2. Marcação do ponto
    const ref = r.refSlot && estado.fotos.get(r.refSlot);
    $("#v-avaria-marcar").hidden = !ref;
    if (ref) {
      const img = $("#v-avaria-ref-img");
      if (img.getAttribute("src") !== ref.url) img.src = ref.url;
      posicionarPonto();
    }
    // 3 e 4. Tipo e região
    $("#v-avaria-tipos").innerHTML = CFG.avarias.tipos.map((t) => `
      <label class="v-opcao"><input type="radio" name="avaria-tipo" value="${esc(t)}"${r.tipo === t ? " checked" : ""}><span>${esc(t)}</span></label>`).join("");
    $("#v-avaria-regiao").innerHTML = `<option value="">Escolha a região</option>` +
      tipo.regioesAvaria.map((g) => `<option${r.regiao === g ? " selected" : ""}>${esc(g)}</option>`).join("");
    $("#v-avaria-obs").value = r.observacao;
    // 5. Foto de perto
    const img = $("#v-avaria-close-img");
    img.hidden = !(r.close && r.close.url);
    if (r.close && r.close.url) img.src = r.close.url;
    $("#v-avaria-close").textContent = r.close ? "Tirar outra foto de perto" : "Tirar foto de perto";
    $("#v-avaria-erro").hidden = true;
  }

  // O ponto é guardado na área da FOTO (a imagem guardada tem a faixa do carimbo embaixo)
  function alturaUtil(img, f) {
    return f && f.largura && img.naturalWidth ? f.altura * (img.naturalWidth / f.largura) : img.naturalHeight;
  }
  function posicionarPonto() {
    const r = estado.rascunho, ponto = $("#v-avaria-ponto"), img = $("#v-avaria-ref-img");
    if (!r || !r.ponto || !img.naturalHeight) { ponto.hidden = true; return; }
    const f = estado.fotos.get(r.refSlot);
    const fracao = alturaUtil(img, f) / img.naturalHeight;
    Object.assign(ponto.style, { left: `${r.ponto.x * 100}%`, top: `${r.ponto.y * fracao * 100}%` });
    ponto.hidden = false;
  }
  function marcarPonto(e) {
    const r = estado.rascunho, img = $("#v-avaria-ref-img");
    if (!r || !r.refSlot || !img.naturalHeight) return;
    const caixa = img.getBoundingClientRect();
    const f = estado.fotos.get(r.refSlot);
    const fracao = alturaUtil(img, f) / img.naturalHeight;
    const lim = (v) => Math.min(1, Math.max(0, v));
    r.ponto = {
      x: Math.round(lim((e.clientX - caixa.left) / caixa.width) * 1000) / 1000,
      y: Math.round(lim((e.clientY - caixa.top) / caixa.height / fracao) * 1000) / 1000
    };
    posicionarPonto();
  }

  // Foto de perto: usa a mesma tela de câmera, com o passo especial
  async function abrirClose() {
    fimPausaTrilha();
    estado.especial = CLOSE;
    estado.inicioSlot[CLOSE.id] = estado.inicioSlot[CLOSE.id] || Date.now();
    $("#v-progresso-fill").style.width = "100%";
    $("#v-progresso-texto").textContent = `Avaria ${estado.avarias.size + 1}${estado.rascunho && estado.rascunho.tipo ? ` · ${estado.rascunho.tipo}` : ""}${estado.rascunho && estado.rascunho.regiao ? ` · ${estado.rascunho.regiao}` : ""}`;
    $("#v-slot-nome").textContent = CLOSE.nome;
    $("#v-slot-instrucao").textContent = CLOSE.instrucao;
    el.pular.hidden = false;
    el.pular.textContent = "Voltar";
    mostrar("captura");
    renderSilhueta(CLOSE);
    el.nivel.hidden = true;
    el.orientacao.hidden = true;
    await abrirCamera();
    atualizarBotao();
  }
  function aceitarClose(foto) {
    const r = estado.rascunho;
    foto.status = foto.resultado.aprovada ? "aprovada" : "forcada";
    foto.duracaoMs = Date.now() - (estado.inicioSlot[CLOSE.id] || Date.now());
    delete estado.inicioSlot[CLOSE.id];
    estado.pendente = null;
    estado.especial = null;
    if (r) {
      if (r.close && r.close.url) URL.revokeObjectURL(r.close.url);
      r.close = foto;
    }
    banco.salvarMeta();
    voltarAoFormulario();
  }
  function voltarAoFormulario() {
    estado.especial = null;
    el.pular.textContent = "Pular (não se aplica)";
    if (!estado.rascunho) { renderAvarias(); mostrar("avarias"); return; }
    renderAvariaForm();
    mostrar("avaria");
  }

  async function salvarAvaria() {
    const r = estado.rascunho;
    if (!r) return;
    r.observacao = $("#v-avaria-obs").value.trim().slice(0, 200);
    const faltando = [];
    if (!r.refSlot && !r.semFoto) faltando.push("escolha em qual foto a avaria aparece (ou “Não aparece nas fotos”)");
    if (r.refSlot && !r.ponto) faltando.push("toque no ponto da avaria na foto");
    if (!r.tipo) faltando.push("escolha o tipo");
    if (!r.regiao) faltando.push("escolha a região");
    if (!r.close) faltando.push("tire a foto de perto");
    if (faltando.length) {
      const e = $("#v-avaria-erro");
      e.textContent = `Falta: ${faltando.join("; ")}.`;
      e.hidden = false;
      return;
    }
    const avaria = { ...r, criadaEm: Date.now(), salvaEm: Date.now() };
    estado.avarias.set(avaria.id, avaria);
    estado.declaracaoAvarias = "com";
    estado.rascunho = null;
    await banco.salvarAvaria(avaria);
    await banco.salvarMeta();
    vibrar(40);
    renderAvarias();
    mostrar("avarias");
  }
  function cancelarAvaria() {
    const r = estado.rascunho;
    if (r && r.close && r.close.url) URL.revokeObjectURL(r.close.url);
    estado.rascunho = null;
    renderAvarias();
    mostrar("avarias");
  }
  async function removerAvaria(id) {
    const a = estado.avarias.get(id);
    if (!a || !window.confirm(`Remover a avaria “${a.tipo} · ${a.regiao}”?`)) return;
    if (a.close && a.close.url) URL.revokeObjectURL(a.close.url);
    estado.avarias.delete(id);
    if (!estado.avarias.size) estado.declaracaoAvarias = null;
    await banco.apagarFoto(`avaria:${id}`);
    await banco.salvarMeta();
    renderAvarias();
  }
  async function declararSemAvarias() {
    estado.declaracaoAvarias = "sem";
    await banco.salvarMeta();
    renderRevisao();
    mostrar("revisao");
  }

  /* ---------- Revisão ---------- */
  const ROTULO = { aprovada: "Aprovada", forcada: "Forçada (dev)", pulada: "Pulada", pendente: "Falta tirar" };
  function renderRevisao() {
    const prontas = slots.filter((s) => estado.fotos.has(s.id)).length;
    $("#v-revisao-resumo").textContent = `${prontas} de ${slots.length} ângulos concluídos.`;
    $("#v-continuar").hidden = prontas === slots.length;
    const n = estado.avarias.size;
    $("#v-revisao-avarias-status").textContent = n ? `${n} avaria(s) registrada(s)` : estado.declaracaoAvarias === "sem" ? "Declarado: o veículo não tem avarias" : "Ainda não respondido";
    $("#v-grade").innerHTML = slots.map((s, i) => {
      const f = estado.fotos.get(s.id);
      const st = f ? f.status : "pendente";
      // Dev: reavalia com os limites atuais (calibração)
      let atual = "";
      if (DEV && f && f.medidas) {
        const r = avaliar({ ...f });
        atual = `<span class="v-nota">Com os limites atuais: ${r.aprovada ? "aprovaria" : "reprovaria"}${r.erros.length ? ` (${r.erros.map((e) => esc(e.codigo)).join(", ")})` : ""}</span>`;
      }
      const avisos = f && f.resultado && f.resultado.avisos.length ? `<span class="v-nota">Avisos: ${f.resultado.avisos.map((e) => esc(e.texto)).join(" ")}</span>` : "";
      return `<li class="v-item v-item--${st}">
        ${f && f.url ? `<img src="${esc(f.url)}" alt="" width="160" height="90">` : '<span class="v-item__vazio" aria-hidden="true"></span>'}
        <span class="v-item__texto"><strong>${esc(s.nome)}</strong><span class="v-item__status">${ROTULO[st]}${f ? ` · ${estado.tentativas[s.id] || 0} tentativa(s)` : ""}</span>${avisos}${atual}</span>
        <button class="btn btn--outline" type="button" data-refazer="${i}">${f ? "Refazer" : "Tirar"}<span class="visually-hidden"> ${esc(s.nome)}</span></button>
      </li>`;
    }).join("");
  }

  /* ---------- Relatório (local, download pelo navegador) ---------- */
  function relatorio() {
    const porCamada = {};
    for (const h of estado.historico) {
      for (const [lista, chave] of [[h.erros, "reprovou"], [h.avisos, "avisou"]]) {
        for (const c of lista) {
          const [camada, codigo] = c.split(":");
          porCamada[camada] = porCamada[camada] || { reprovou: 0, avisou: 0, codigos: {} };
          porCamada[camada][chave]++;
          porCamada[camada].codigos[codigo] = (porCamada[camada].codigos[codigo] || 0) + 1;
        }
      }
    }
    return {
      tipo: "relatorio-teste-vistoria",
      fase: 1,
      geradoEm: new Date().toISOString(),
      aviso: "Relatório local de TESTE. Nenhuma foto foi enviada a servidor.",
      aparelho: { userAgent: navigator.userAgent, tela: `${screen.width}×${screen.height}@${window.devicePixelRatio}`, devMode: DEV },
      detector: { estado: detector.estado, erro: detector.erro || null, backend: detector.backend, tempoCargaMs: detector.tempoCargaMs },
      tipoVeiculo: tipoId,
      configUsada: { versao: CFG.versao, limites: { ...L }, camadas: { ...camadas } },
      tentativasTotais: estado.historico.length,
      camadas: porCamada,
      fotos: slots.map((s) => {
        const f = estado.fotos.get(s.id);
        const base = { slot: s.id, nome: s.nome, codigoTipoSgaPendente: s.codigoTipoSgaPendente, tentativas: estado.tentativas[s.id] || 0 };
        if (!f) return { ...base, status: "pendente" };
        return {
          ...base,
          status: f.status,
          motivos: f.resultado ? f.resultado.erros.map((e) => ({ camada: e.camada, codigo: e.codigo, texto: e.texto })) : [],
          avisos: f.resultado ? f.resultado.avisos.map((e) => ({ camada: e.camada, codigo: e.codigo, texto: e.texto })) : [],
          capturadaEm: f.capturadaEm,
          tempoCapturaMs: f.duracaoMs ?? null,
          tempoAnaliseMs: f.tempoAnaliseMs ?? null,
          origem: f.origem || null,
          rotacaoCorrigida: f.rotacao || 0,
          metricas: f.medidas ? Object.fromEntries(Object.entries(f.medidas).filter(([k]) => k !== "cor").map(([k, v]) => [k, arred(v, 3)])) : null,
          assinaturaCor: f.medidas && f.medidas.cor ? f.medidas.cor : null,
          inclinacao: f.inclinacao ? { pitch: arred(f.inclinacao.pitch, 1), roll: arred(f.inclinacao.roll, 1), paisagem: f.inclinacao.paisagem, quarto: f.inclinacao.quarto } : null,
          deteccao: f.deteccao || null,
          angulo: f.angulo || null,
          comparacoes: f.resultado ? f.resultado.extras : null,
          carimbo: f.carimbo || null,
          geo: f.geo ? { lat: f.geo.lat, lon: f.geo.lon, precisaoM: f.geo.precisaoM, idadeS: f.geo.idadeS, gpsEm: f.geo.gpsEm ? new Date(f.geo.gpsEm).toISOString() : null } : null,
          // Relógio do aparelho x hora do GPS (diferença grande = relógio alterado?)
          relogioDiferencaS: f.geo && f.geo.gpsEm ? Math.round((Date.parse(f.capturadaEm) - f.geo.gpsEm) / 1000) : null
        };
      }),
      avarias: {
        declaracao: estado.avarias.size ? "com-avarias" : estado.declaracaoAvarias === "sem" ? "sem-avarias" : "nao-respondido",
        itens: avariasOrdenadas().map((a, i) => ({
          numero: i + 1, tipo: a.tipo, regiao: a.regiao, observacao: a.observacao || null,
          fotoReferencia: a.refSlot ? { slot: a.refSlot, nome: nomeDe(a.refSlot) } : null,
          ponto: a.ponto, // x, y de 0 a 1 na área da foto de referência (sem a faixa do carimbo)
          criadaEm: new Date(a.criadaEm).toISOString(),
          close: a.close ? {
            status: a.close.status, capturadaEm: a.close.capturadaEm, carimbo: a.close.carimbo || null,
            geo: a.close.geo ? { lat: a.close.geo.lat, lon: a.close.geo.lon, precisaoM: a.close.geo.precisaoM } : null,
            motivos: a.close.resultado ? a.close.resultado.erros.map((e) => e.codigo) : [],
            avisos: a.close.resultado ? a.close.resultado.avisos.map((e) => e.codigo) : [],
            nitidezCentro: a.close.medidas ? arred(a.close.medidas.nitidezCentro, 1) : null
          } : null
        }))
      },
      historico: estado.historico
    };
  }
  const nomeArquivo = (ext) => `vistoria-teste-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.${ext}`;
  function baixar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const baixarJson = (obj, nome) => baixar(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }), nome);

  // ZIP "armazenado" (sem compressão: JPEG já é comprimido), sem biblioteca
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return (d) => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = t[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  })();
  function zip(arquivos) {
    const enc = new TextEncoder(), partes = [], central = [];
    let pos = 0;
    const agora = new Date();
    const dosT = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
    const dosD = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    for (const { nome, dados } of arquivos) {
      const n = enc.encode(nome), crc = CRC(dados);
      const loc = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dosT, 2], [12, dosD, 2], [14, crc, 4], [18, dados.length, 4], [22, dados.length, 4], [26, n.length, 2], [28, 0, 2]]
        .forEach(([o, v, s]) => (s === 4 ? loc.setUint32(o, v, true) : loc.setUint16(o, v, true)));
      const cen = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dosT, 2], [14, dosD, 2], [16, crc, 4], [20, dados.length, 4], [24, dados.length, 4], [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, pos, 4]]
        .forEach(([o, v, s]) => (s === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true)));
      partes.push(loc, n, dados);
      central.push(cen, n);
      pos += 30 + n.length + dados.length;
    }
    const tamCentral = central.reduce((s, p) => s + p.byteLength, 0);
    const fim = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [8, arquivos.length, 2], [10, arquivos.length, 2], [12, tamCentral, 4], [16, pos, 4]]
      .forEach(([o, v, s]) => (s === 4 ? fim.setUint32(o, v, true) : fim.setUint16(o, v, true)));
    return new Blob([...partes, ...central, fim], { type: "application/zip" });
  }
  async function baixarZip() {
    const arquivos = [{ nome: "relatorio.json", dados: new TextEncoder().encode(JSON.stringify(relatorio(), null, 2)) }];
    for (const [i, s] of slots.entries()) {
      const f = estado.fotos.get(s.id);
      if (!f || !f.blob) continue;
      const bmp = await createImageBitmap(f.blob);
      const mini = await paraBlob(canvasDe(bmp, bmp.width, bmp.height, 480), 0.8);
      if (bmp.close) bmp.close();
      arquivos.push({ nome: `miniaturas/${String(i + 1).padStart(2, "0")}-${s.id}.jpg`, dados: new Uint8Array(await mini.arrayBuffer()) });
    }
    for (const [i, a] of avariasOrdenadas().entries()) {
      const n = String(i + 1).padStart(2, "0");
      if (a.close && a.close.blob) {
        const bmp = await createImageBitmap(a.close.blob);
        const mini = await paraBlob(canvasDe(bmp, bmp.width, bmp.height, 800), 0.85);
        if (bmp.close) bmp.close();
        arquivos.push({ nome: `avarias/${n}-perto.jpg`, dados: new Uint8Array(await mini.arrayBuffer()) });
      }
      const ref = a.refSlot && estado.fotos.get(a.refSlot);
      if (ref && ref.blob && a.ponto) {
        const bmp = await createImageBitmap(ref.blob);
        const c = canvasDe(bmp, bmp.width, bmp.height, 800);
        if (bmp.close) bmp.close();
        const g = c.getContext("2d"), k = c.width / ref.largura;
        const x = a.ponto.x * c.width, y = a.ponto.y * ref.altura * k, raio = Math.max(14, c.width * 0.03);
        g.lineWidth = Math.max(3, raio * 0.25);
        g.strokeStyle = "#FFFFFF"; g.beginPath(); g.arc(x, y, raio + g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = "#FF3B30"; g.beginPath(); g.arc(x, y, raio, 0, Math.PI * 2); g.stroke();
        const marcada = await paraBlob(c, 0.85);
        arquivos.push({ nome: `avarias/${n}-marcacao.jpg`, dados: new Uint8Array(await marcada.arrayBuffer()) });
      }
    }
    baixar(zip(arquivos), nomeArquivo("zip"));
  }

  async function limparTudo(pergunta) {
    if (!window.confirm(typeof pergunta === "string" ? pergunta : "Apagar todas as fotos e o relatório deste teste?")) return false;
    for (const f of estado.fotos.values()) if (f.url) URL.revokeObjectURL(f.url);
    if (estado.pendente && estado.pendente.url) URL.revokeObjectURL(estado.pendente.url);
    estado.fotos.clear();
    estado.pendente = null;
    estado.tentativas = {};
    estado.historico = [];
    estado.inicioSlot = {};
    estado.trilha = null;
    for (const a of estado.avarias.values()) if (a.close && a.close.url) URL.revokeObjectURL(a.close.url);
    if (estado.rascunho && estado.rascunho.close && estado.rascunho.close.url) URL.revokeObjectURL(estado.rascunho.close.url);
    estado.avarias.clear();
    estado.rascunho = null;
    estado.declaracaoAvarias = null;
    estado.especial = null;
    await banco.limpar();
    $("#v-retomada").hidden = true;
    $("#v-ir-revisao").hidden = true;
    $("#v-comecar").textContent = "Começar";
    mostrar("inicio");
    return true;
  }

  /* ---------- Painel de diagnóstico (FASE 2: REMOVER) ---------- */
  function initPainel() {
    $("#v-dev-faixa").hidden = false;
    document.querySelectorAll(".v-dev-only").forEach((n) => { if (n.id !== "v-forcar" && n.id !== "v-metricas") n.hidden = false; });
    const reavaliar = () => {
      salvarAjustes();
      if (estado.pendente && !el.telas.resultado.hidden) avaliarEExibir(false);
      if (!el.telas.revisao.hidden) renderRevisao();
      if (!el.telas.captura.hidden) renderSilhueta(slotAtual());
    };
    const nomes = { qualidade: "Qualidade", mesmoVeiculo: "Mesmo veículo (aviso)", continuidade: "Continuidade (aviso)", duplicada: "Duplicada (aviso)", espelho: "Lado repetido (aviso)", silhueta: "Silhueta", inclinacao: "Inclinação", deteccao: "Detecção do veículo", angulo: "Ângulo estimado" };
    $("#v-camadas").insertAdjacentHTML("beforeend", Object.keys(camadas).map((k) =>
      `<label class="v-check"><input type="checkbox" data-camada="${k}"${camadas[k] ? " checked" : ""}> ${esc(nomes[k] || k)}</label>`).join(""));
    $("#v-camadas").addEventListener("change", (e) => {
      const k = e.target.dataset.camada;
      if (!k) return;
      camadas[k] = e.target.checked;
      if (k === "deteccao" && camadas.deteccao) prepararDetector();
      reavaliar();
    });
    const renderAjustes = () => {
      $("#v-ajustes").innerHTML = CFG.ajustes.map(([k, rotulo, min, max, passo]) => `
        <div class="v-ajuste">
          <label for="aj-${k}">${esc(rotulo)}: <output id="out-${k}">${arred(L[k], 3)}</output></label>
          <input type="range" id="aj-${k}" data-limite="${k}" min="${min}" max="${max}" step="${passo}" value="${L[k]}">
        </div>`).join("");
    };
    renderAjustes();
    $("#v-ajustes").addEventListener("input", (e) => {
      const k = e.target.dataset.limite;
      if (!k) return;
      L[k] = Number(e.target.value);
      $(`#out-${k}`).textContent = arred(L[k], 3);
      reavaliar();
    });
    $("#v-exportar-config").addEventListener("click", () =>
      baixarJson({ exportadoEm: new Date().toISOString(), versao: CFG.versao, limites: { ...L }, camadas: { ...camadas } }, `vistoria-config-${Date.now()}.json`));
    $("#v-restaurar-config").addEventListener("click", () => {
      Object.assign(L, PADRAO.limites);
      Object.assign(camadas, PADRAO.camadas);
      document.querySelectorAll("[data-camada]").forEach((c) => { c.checked = camadas[c.dataset.camada]; });
      renderAjustes();
      reavaliar();
    });
    atualizarStatusDetector();
  }

  /* ---------- Eventos ---------- */
  $("#v-comecar").addEventListener("click", async () => {
    // Pedidos de permissão precisam vir de um toque (iOS): nível e localização (obrigatória) aqui
    if (camadas.inclinacao) incl.pedirPermissao();
    iniciarGeo();
    const i = proximoPendente(0);
    if (i < 0) { renderRevisao(); mostrar("revisao"); } else irPara(i);
  });
  $("#v-ir-revisao").addEventListener("click", () => { renderRevisao(); mostrar("revisao"); });
  // Trocar o tipo de veículo com fotos já tiradas apaga o teste atual (os ângulos são outros)
  $("#v-tipos").addEventListener("change", async (e) => {
    const novo = e.target.value;
    if (novo === tipoId) return;
    if (estado.fotos.size && !(await limparTudo(`Trocar para ${CFG.tipos[novo].nome} apaga as fotos do teste atual. Continuar?`))) { definirTipo(tipoId); return; }
    definirTipo(novo);
    banco.salvarMeta();
  });
  $("#v-ver-revisao").addEventListener("click", () => { renderRevisao(); mostrar("revisao"); });
  el.capturar.addEventListener("click", () => capturar());
  el.pular.addEventListener("click", pular);
  el.orientacao.addEventListener("click", async () => {
    const r = await incl.pedirPermissao();
    el.orientacao.hidden = r === "granted";
    if (r !== "granted") avisar("Sem acesso ao sensor de inclinação: o nível do celular fica desligado.");
  });
  el.arquivo.addEventListener("change", () => { const f = el.arquivo.files[0]; el.arquivo.value = ""; if (DEV && f) capturar(f); });
  $("#v-limpar").addEventListener("click", () => limparTudo());
  el.aceitar.addEventListener("click", () => aceitar(false));
  el.forcar.addEventListener("click", () => { if (DEV) aceitar(true); });
  el.refazer.addEventListener("click", refazer);
  $("#v-continuar").addEventListener("click", () => { const i = proximoPendente(0); if (i >= 0) irPara(i); });
  $("#v-grade").addEventListener("click", (e) => {
    const b = e.target.closest("[data-refazer]");
    if (b) irPara(Number(b.dataset.refazer));
  });
  $("#v-relatorio").addEventListener("click", () => baixarJson(relatorio(), nomeArquivo("json")));
  // Avarias
  $("#v-ir-avarias").addEventListener("click", () => { renderAvarias(); mostrar("avarias"); });
  $("#v-avaria-nova").addEventListener("click", novaAvaria);
  $("#v-sem-avarias").addEventListener("click", declararSemAvarias);
  $("#v-avarias-concluir").addEventListener("click", () => { renderRevisao(); mostrar("revisao"); });
  $("#v-avarias-lista").addEventListener("click", (e) => { const b = e.target.closest("[data-remover-avaria]"); if (b) removerAvaria(b.dataset.removerAvaria); });
  $("#v-avaria-fotos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ref]");
    const r = estado.rascunho;
    if (!b || !r) return;
    r.refSlot = b.dataset.ref || null;
    r.semFoto = !b.dataset.ref;
    r.ponto = null;
    renderAvariaForm();
  });
  $("#v-avaria-ref-img").addEventListener("click", marcarPonto);
  $("#v-avaria-ref-img").addEventListener("load", posicionarPonto);
  $("#v-avaria-tipos").addEventListener("change", (e) => { if (estado.rascunho) estado.rascunho.tipo = e.target.value; });
  $("#v-avaria-regiao").addEventListener("change", (e) => { if (estado.rascunho) estado.rascunho.regiao = e.target.value; });
  $("#v-avaria-obs").addEventListener("input", (e) => { if (estado.rascunho) estado.rascunho.observacao = e.target.value; });
  $("#v-avaria-close").addEventListener("click", () => { if (estado.rascunho) abrirClose(); });
  $("#v-avaria-salvar").addEventListener("click", salvarAvaria);
  $("#v-avaria-cancelar").addEventListener("click", cancelarAvaria);
  $("#v-zip").addEventListener("click", baixarZip);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pararCamera(); else if (!el.telas.captura.hidden) abrirCamera(); });

  if (DEV) initPainel();
  restaurar().then(expirar);
  setInterval(expirar, 60 * 1000);

  // Gancho só para os testes automáticos (não expõe fotos nem dados)
  window.__vistoria = { get estadoDetector() { return detector.estado; }, get olhadas() { return estado.trilha ? estado.trilha.amostras.length : 0; } };
})();
