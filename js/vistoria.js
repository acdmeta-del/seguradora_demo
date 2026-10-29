/*
 * Vistoria (TESTE, Fase 1): interface da captura guiada.
 * Câmera ao vivo → medição (vistoria-qualidade.js) e posicionamento (vistoria-posicao.js)
 * → aceitar ou refazer → revisão → relatório local (JSON/ZIP).
 * NENHUMA chamada de rede com fotos ou dados: tudo fica no aparelho (memória + IndexedDB,
 * com expiração automática). A Fase 2 troca o "aceitar" por envio ao servidor.
 */
(function () {
  "use strict";

  const CFG = window.VISTORIA_CONFIG, Q = window.VistoriaQualidade, P = window.VistoriaPosicao;
  if (!CFG || !Q || !P) return;

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

  const slots = CFG.slots;
  const estado = {
    indice: 0,
    fotos: new Map(),     // slotId → foto aceita (ou pulada)
    pendente: null,       // foto em análise / aguardando aceitar
    tentativas: {},       // slotId → nº de capturas
    inicioSlot: {},       // slotId → início do passo (tempo de captura)
    historico: [],        // cada tentativa: camadas que reprovaram/avisaram (para comparar camadas)
    geo: false,
    stream: null
  };
  const incl = P.criarInclinacao();
  const detector = P.criarDetector(CFG.deteccao);

  const el = {
    aviso: $("#v-aviso"),
    telas: { inicio: $("#v-inicio"), captura: $("#v-captura"), resultado: $("#v-resultado"), revisao: $("#v-revisao") },
    video: $("#v-video"), silhueta: $("#v-silhueta"), camErro: $("#v-camera-erro"),
    nivel: $("#v-nivel"), nivelLinha: $("#v-nivel-linha"), nivelTexto: $("#v-nivel-texto"),
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
    if (nome !== "captura" && nome !== "resultado") pararCamera();
    window.scrollTo(0, 0);
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
      salvarMeta: () => pedir("meta", "readwrite", (s) => s.put({ salvaEm: Date.now(), tentativas: estado.tentativas, historico: estado.historico, inicioSlot: estado.inicioSlot }, "estado")),
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
      estado.tentativas = meta.tentativas || {};
      estado.historico = meta.historico || [];
      estado.inicioSlot = meta.inicioSlot || {};
    }
    let maisAntiga = null;
    for (const f of (await banco.fotos()) || []) {
      if (agora - f.salvaEm >= EXPIRA_MS) { await banco.apagarFoto(f.slotId); continue; }
      if (!slots.some((s) => s.id === f.slotId)) continue;
      estado.fotos.set(f.slotId, { ...f, url: f.blob ? URL.createObjectURL(f.blob) : null });
      maisAntiga = Math.min(maisAntiga || f.salvaEm, f.salvaEm);
    }
    if (estado.fotos.size) {
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
    if (mudou && !el.telas.revisao.hidden) renderRevisao();
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
      el.capturar.disabled = false;
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

  /* ---------- Silhuetas (SVG simples sobre a câmera) ---------- */
  const SILHUETAS = {
    lateral: '<path d="M40 150h22a26 26 0 0 1 52 0h172a26 26 0 0 1 52 0h22v-38l-30-10-50-40H130l-46 38-38 6z"/><circle cx="88" cy="150" r="20"/><circle cx="312" cy="150" r="20"/><path d="M138 70h78v34h-112zM226 70h44l38 34h-82z"/>',
    frente: '<path d="M110 160v-50l20-54h140l20 54v50"/><path d="M128 104l16-38h112l16 38z"/><rect x="100" y="110" width="200" height="40" rx="8"/><rect x="170" y="128" width="60" height="16" rx="2"/><circle cx="130" cy="124" r="9"/><circle cx="270" cy="124" r="9"/><rect x="112" y="150" width="26" height="18" rx="3"/><rect x="262" y="150" width="26" height="18" rx="3"/>',
    traseira: '<path d="M110 160v-50l22-54h136l22 54v50"/><path d="M132 104l14-36h108l14 36z"/><rect x="100" y="110" width="200" height="40" rx="8"/><rect x="170" y="130" width="60" height="16" rx="2"/><rect x="112" y="116" width="34" height="12" rx="3"/><rect x="254" y="116" width="34" height="12" rx="3"/><rect x="112" y="150" width="26" height="18" rx="3"/><rect x="262" y="150" width="26" height="18" rx="3"/>',
    "diagonal-frontal": '<path d="M50 150h14a24 24 0 0 1 48 0h120a22 22 0 0 1 44 0h40v-36l-34-14-40-36H144l-40 32-40 6-14 10z"/><circle cx="88" cy="150" r="18"/><circle cx="254" cy="150" r="17"/><path d="M60 118l44-6M150 70h70l30 30h-110z"/>',
    "diagonal-traseira": '<path d="M350 150h-14a24 24 0 0 0-48 0H168a22 22 0 0 0-44 0H84v-36l34-14 40-36h98l40 32 40 6 14 10z"/><circle cx="312" cy="150" r="18"/><circle cx="146" cy="150" r="17"/><path d="M340 118l-44-6M250 70h-70l-30 30h110z"/>',
    painel: '<rect x="70" y="50" width="260" height="110" rx="40"/><circle cx="150" cy="105" r="38"/><circle cx="250" cy="105" r="38"/><rect x="170" y="128" width="60" height="18" rx="3"/>',
    chassi: '<rect x="60" y="80" width="280" height="50" rx="6"/><path d="M80 105h240" stroke-dasharray="10 8"/>',
    portamalas: '<path d="M70 160V80l40-30h180l40 30v80z"/><rect x="130" y="95" width="140" height="55" rx="27"/><circle cx="200" cy="122" r="16"/>'
  };
  function renderSilhueta(slot) {
    el.silhueta.hidden = !camadas.silhueta;
    if (!camadas.silhueta) return;
    // Faixa de largura esperada do veículo (ângulos externos), como guia de distância
    const guia = slot.externo
      ? `<rect class="v-silhueta__faixa" x="${200 - L.larguraMax * 200}" y="18" width="${L.larguraMax * 400}" height="164"/>
         <rect class="v-silhueta__faixa" x="${200 - L.larguraMin * 200}" y="18" width="${L.larguraMin * 400}" height="164"/>`
      : "";
    el.silhueta.innerHTML = `<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">${guia}<g class="v-silhueta__forma"${slot.espelhar ? ' transform="translate(400 0) scale(-1 1)"' : ""}>${SILHUETAS[slot.silhueta] || ""}</g></svg>`;
  }

  /* ---------- Nível do celular (camada inclinação) ---------- */
  function atualizarNivel(i) {
    const slot = slots[estado.indice];
    if (!camadas.inclinacao || !slot || !slot.externo || el.telas.captura.hidden) { el.nivel.hidden = true; return; }
    el.nivel.hidden = false;
    const r = P.avaliarInclinacao(i, slot, L);
    el.nivelLinha.style.transform = `rotate(${-i.roll}deg)`;
    el.nivel.classList.toggle("v-nivel--ok", !r.erros.length);
    el.nivelTexto.textContent = r.erros.length ? (r.erros[0].codigo === "roll" ? `Endireite ${Math.round(Math.abs(i.roll))}°` : "Deixe o celular em pé") : "Reto ✓";
  }
  incl.aoAtualizar(atualizarNivel);

  /* ---------- Fluxo ---------- */
  const proximoPendente = (de = 0) => {
    for (let k = 0; k < slots.length; k++) {
      const i = (de + k) % slots.length;
      if (!estado.fotos.has(slots[i].id)) return i;
    }
    return -1;
  };

  async function irPara(indice) {
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
    renderSilhueta(slot);
    mostrar("captura");
    el.orientacao.hidden = !(camadas.inclinacao && slot.externo && incl.precisaPermissao() && !incl.ativo);
    if (incl.ultimo) atualizarNivel(incl.ultimo); else el.nivel.hidden = true;
    if (slot.externo && camadas.deteccao) prepararDetector();
    // O botão fica desativado durante a análise da foto anterior: libera de novo aqui
    el.capturar.disabled = !(await abrirCamera());
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
    const slot = slots[estado.indice];
    el.capturar.disabled = true;
    el.status.textContent = "";
    try {
      const inclinacao = incl.ultimo ? { ...incl.ultimo } : null; // no momento do clique
      const foto = origemArquivo ? await deArquivo(origemArquivo) : await tirarFoto(inclinacao);
      estado.tentativas[slot.id] = (estado.tentativas[slot.id] || 0) + 1;
      mostrarResultadoCarregando(slot);
      estado.pendente = await analisar(foto, slot, inclinacao);
      if (foto.fonte && foto.fonte.close) foto.fonte.close();
      avaliarEExibir();
      banco.salvarMeta();
    } catch (e) {
      erroCamera(e.message || "Não foi possível tirar a foto.");
      el.capturar.disabled = false;
      mostrar("captura");
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

  async function analisar({ fonte, largura, altura, origem, rotacao = 0 }, slot, inclinacao) {
    const t0 = performance.now();
    const blob = await paraBlob(canvasDe(fonte, largura, altura), CFG.camera.qualidadeJpeg);
    const ca = canvasDe(fonte, largura, altura, CFG.analise.ladoMaior);
    const img = ca.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, ca.width, ca.height);
    const medidas = Q.medir(img, { largura, altura });
    const foto = {
      slotId: slot.id, blob, url: URL.createObjectURL(blob), largura, altura, origem, rotacao,
      capturadaEm: new Date().toISOString(), tentativa: estado.tentativas[slot.id],
      medidas, inclinacao, deteccao: null, angulo: null, extensao: null, geo: null
    };
    if (slot.externo && camadas.deteccao) {
      await prepararDetector();
      foto.deteccao = await detector.detectar(ca, ca.width, ca.height).catch(() => null);
      if (foto.deteccao && foto.deteccao.encontrado) {
        // Hash só do recorte do veículo: melhora a comparação entre laterais (menos fundo)
        const cinza = Q.paraCinza(img);
        foto.medidas.hashCaixa = Q.dHash(cinza, { regiao: foto.deteccao.caixa });
        foto.medidas.hashCaixaEspelho = Q.dHash(cinza, { regiao: foto.deteccao.caixa, espelhar: true });
      }
    }
    foto.extensao = await P.analisarFoto({ canvas: ca, largura, altura, blob }, slot).catch(() => null);
    foto.tempoAnaliseMs = Math.round(performance.now() - t0);
    if (estado.geo && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => {
        foto.geo = { lat: arred(p.coords.latitude, 6), lon: arred(p.coords.longitude, 6), precisaoM: Math.round(p.coords.accuracy), em: new Date(p.timestamp).toISOString() };
        if (estado.fotos.get(slot.id) === foto) banco.salvarFoto(foto);
      }, () => {}, { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 });
    }
    return foto;
  }

  /* ---------- Decisão (todas as camadas) ---------- */
  const ACEITAS = new Set(["aprovada", "forcada"]);
  function avaliar(foto) {
    const slot = slots.find((s) => s.id === foto.slotId);
    const erros = [], avisos = [], extras = {};
    const juntar = (r) => { erros.push(...(r.erros || [])); avisos.push(...(r.avisos || [])); };
    const m = foto.medidas;
    if (camadas.qualidade) juntar(Q.avaliarQualidade(m, slot, L));
    if (camadas.duplicada) {
      const outras = [...estado.fotos.values()].filter((f) => f.slotId !== foto.slotId && ACEITAS.has(f.status) && f.medidas)
        .map((f) => ({ slotId: f.slotId, nome: nomeDe(f.slotId), hash: f.medidas.hash }));
      const r = Q.avaliarDuplicada(m.hash, outras, L);
      extras.maisParecida = r.maisPerto;
      juntar(r);
    }
    if (camadas.espelho) {
      const par = CFG.espelhos.find((p) => p.includes(foto.slotId));
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
      if (foto.deteccao) juntar(P.avaliarEnquadramento(foto.deteccao, slot, L));
      else if (detector.estado === "erro") avisos.push({ codigo: "detector_erro", texto: detector.erro, camada: "deteccao" });
    }
    if (camadas.angulo) {
      foto.angulo = P.estimarAngulo(foto.deteccao, slot);
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
    const slot = slots.find((s) => s.id === foto.slotId);
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
      ["Caixa (x, y, larg., alt.)", d && d.encontrado ? [d.caixa.x, d.caixa.y, d.caixa.w, d.caixa.h].map((v) => arred(v)).join(", ") : "—", `larg. ${L.larguraMin} a ${L.larguraMax}, centro ≤ ${L.centroMax}`],
      ["Detecção (ms)", d ? d.tempoMs : "—", ""],
      ["Ângulo estimado", a ? `${a.grupo}${a.subtipo ? ` / ${a.subtipo}` : ""} (prop. ${a.proporcao})` : "—", ""],
      ["Confiança do ângulo", a ? `${a.confianca}${a.subtipo ? ` (subtipo: ${a.confiancaSubtipo})` : ""}` : "—", "bloqueia só com alta"],
      ["Análise total (ms)", foto.tempoAnaliseMs, ""],
      ["Tentativa", foto.tentativa, ""]
    ];
    el.metricas.innerHTML = `<table><caption>Métricas medidas x limites</caption><thead><tr><th>Medida</th><th>Valor</th><th>Limite</th></tr></thead><tbody>${
      linhas.map(([k, v, lim]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td><td>${esc(lim)}</td></tr>`).join("")}</tbody></table>`;
    el.metricas.hidden = false;
  }

  async function aceitar(forcada) {
    const foto = estado.pendente;
    if (!foto || (!foto.resultado.aprovada && !forcada)) return;
    const anterior = estado.fotos.get(foto.slotId);
    if (anterior && anterior.url) URL.revokeObjectURL(anterior.url);
    foto.status = foto.resultado.aprovada ? "aprovada" : "forcada";
    foto.duracaoMs = Date.now() - (estado.inicioSlot[foto.slotId] || Date.now());
    foto.salvaEm = Date.now();
    estado.fotos.set(foto.slotId, foto);
    estado.pendente = null;
    delete estado.inicioSlot[foto.slotId];
    await banco.salvarFoto(foto);
    await banco.salvarMeta();
    avancar();
  }
  function refazer() {
    if (estado.pendente && estado.pendente.url) URL.revokeObjectURL(estado.pendente.url);
    estado.pendente = null;
    irPara(estado.indice);
  }
  async function pular() {
    const slot = slots[estado.indice];
    const foto = { slotId: slot.id, status: "pulada", salvaEm: Date.now(), capturadaEm: new Date().toISOString(), tentativa: estado.tentativas[slot.id] || 0 };
    estado.fotos.set(slot.id, foto);
    await banco.salvarFoto(foto);
    avancar();
  }
  function avancar() {
    const i = proximoPendente(estado.indice + 1);
    if (i < 0) { renderRevisao(); mostrar("revisao"); } else irPara(i);
  }

  /* ---------- Revisão ---------- */
  const ROTULO = { aprovada: "Aprovada", forcada: "Forçada (dev)", pulada: "Pulada", pendente: "Falta tirar" };
  function renderRevisao() {
    const prontas = slots.filter((s) => estado.fotos.has(s.id)).length;
    $("#v-revisao-resumo").textContent = `${prontas} de ${slots.length} ângulos concluídos.`;
    $("#v-continuar").hidden = prontas === slots.length;
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
          metricas: f.medidas ? Object.fromEntries(Object.entries(f.medidas).map(([k, v]) => [k, arred(v, 3)])) : null,
          inclinacao: f.inclinacao ? { pitch: arred(f.inclinacao.pitch, 1), roll: arred(f.inclinacao.roll, 1), paisagem: f.inclinacao.paisagem, quarto: f.inclinacao.quarto } : null,
          deteccao: f.deteccao || null,
          angulo: f.angulo || null,
          comparacoes: f.resultado ? f.resultado.extras : null,
          geo: f.geo || null
        };
      }),
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
    baixar(zip(arquivos), nomeArquivo("zip"));
  }

  async function limparTudo() {
    if (!window.confirm("Apagar todas as fotos e o relatório deste teste?")) return;
    for (const f of estado.fotos.values()) if (f.url) URL.revokeObjectURL(f.url);
    if (estado.pendente && estado.pendente.url) URL.revokeObjectURL(estado.pendente.url);
    estado.fotos.clear();
    estado.pendente = null;
    estado.tentativas = {};
    estado.historico = [];
    estado.inicioSlot = {};
    await banco.limpar();
    $("#v-retomada").hidden = true;
    $("#v-ir-revisao").hidden = true;
    $("#v-comecar").textContent = "Começar";
    mostrar("inicio");
  }

  /* ---------- Painel de diagnóstico (FASE 2: REMOVER) ---------- */
  function initPainel() {
    $("#v-dev-faixa").hidden = false;
    document.querySelectorAll(".v-dev-only").forEach((n) => { if (n.id !== "v-forcar" && n.id !== "v-metricas") n.hidden = false; });
    const reavaliar = () => {
      salvarAjustes();
      if (estado.pendente && !el.telas.resultado.hidden) avaliarEExibir(false);
      if (!el.telas.revisao.hidden) renderRevisao();
      if (!el.telas.captura.hidden) renderSilhueta(slots[estado.indice]);
    };
    const nomes = { qualidade: "Qualidade", duplicada: "Duplicada (aviso)", espelho: "Lado repetido (aviso)", silhueta: "Silhueta", inclinacao: "Inclinação", deteccao: "Detecção do veículo", angulo: "Ângulo estimado" };
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
    estado.geo = $("#v-geo").checked;
    // Pedidos de permissão precisam vir de um toque (iOS): nível e localização aqui
    if (camadas.inclinacao) incl.pedirPermissao();
    if (estado.geo && navigator.geolocation) navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 10000 });
    const i = proximoPendente(0);
    if (i < 0) { renderRevisao(); mostrar("revisao"); } else irPara(i);
  });
  $("#v-ir-revisao").addEventListener("click", () => { renderRevisao(); mostrar("revisao"); });
  $("#v-ver-revisao").addEventListener("click", () => { renderRevisao(); mostrar("revisao"); });
  el.capturar.addEventListener("click", () => capturar());
  el.pular.addEventListener("click", pular);
  el.orientacao.addEventListener("click", async () => {
    const r = await incl.pedirPermissao();
    el.orientacao.hidden = r === "granted";
    if (r !== "granted") avisar("Sem acesso ao sensor de inclinação: o nível do celular fica desligado.");
  });
  el.arquivo.addEventListener("change", () => { const f = el.arquivo.files[0]; el.arquivo.value = ""; if (DEV && f) capturar(f); });
  el.aceitar.addEventListener("click", () => aceitar(false));
  el.forcar.addEventListener("click", () => { if (DEV) aceitar(true); });
  el.refazer.addEventListener("click", refazer);
  $("#v-continuar").addEventListener("click", () => { const i = proximoPendente(0); if (i >= 0) irPara(i); });
  $("#v-grade").addEventListener("click", (e) => {
    const b = e.target.closest("[data-refazer]");
    if (b) irPara(Number(b.dataset.refazer));
  });
  $("#v-relatorio").addEventListener("click", () => baixarJson(relatorio(), nomeArquivo("json")));
  $("#v-zip").addEventListener("click", baixarZip);
  $("#v-limpar").addEventListener("click", limparTudo);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pararCamera(); else if (!el.telas.captura.hidden) abrirCamera(); });

  if (DEV) initPainel();
  restaurar().then(expirar);
  setInterval(expirar, 60 * 1000);

  // Gancho só para os testes automáticos (não expõe fotos nem dados)
  window.__vistoria = { get estadoDetector() { return detector.estado; } };
})();
