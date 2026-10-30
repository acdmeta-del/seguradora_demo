// Página de TESTE da vistoria (Fase 1): câmera falsa do Chromium e imagens sintéticas geradas aqui.
// Nenhuma foto real, nenhuma placa, nenhuma pessoa. Também garante que nada sai do aparelho.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("playwright");

let browser, server, origin;
const root = path.resolve(__dirname, "..");
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webp": "image/webp" };

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--disable-dev-shm-usage", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
  });
  server = createServer(async (req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, origin).pathname);
    const arquivo = path.join(root, caminho === "/" ? "index.html" : caminho);
    if (!arquivo.startsWith(root + path.sep) || arquivo.includes(`${path.sep}server${path.sep}`)) { res.writeHead(404).end(); return; }
    try {
      const dados = await readFile(arquivo);
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream" });
      res.end(dados);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

// Localização fictícia (Esplanada, Brasília): a página exige GPS para tirar foto
const GEO = { latitude: -15.7939, longitude: -47.8828, accuracy: 12 };

// Abre a página registrando TODOS os pedidos. Tráfego externo é bloqueado (só fontes do Google são esperadas).
async function abrir(t, { dev = true, ajustes, initScript, rotas } = {}) {
  const context = await browser.newContext({ permissions: ["camera", "geolocation"], geolocation: GEO, acceptDownloads: true, viewport: { width: 390, height: 844 } });
  t.after(() => context.close());
  const requests = [];
  context.on("request", (r) => requests.push(r));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    return route.continue();
  });
  if (rotas) await rotas(context);
  await context.addInitScript(({ ajustes }) => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
    if (ajustes) localStorage.setItem("vistoria-ajustes", JSON.stringify(ajustes));
  }, { ajustes });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${origin}/vistoria-teste.html${dev ? "?dev=1" : ""}`);
  return { page, context, requests };
}

// Regra principal da Fase 1: só GET, só para o próprio site (fontes do Google são abortadas aqui)
function semEnvio(requests) {
  const permitidos = new Set([new URL(origin).host, "fonts.googleapis.com", "fonts.gstatic.com"]);
  for (const r of requests) {
    const url = new URL(r.url());
    assert.equal(r.method(), "GET", `${r.method()} ${r.url()}`);
    assert.ok(!r.postData(), `corpo enviado em ${r.url()}`);
    if (url.protocol === "blob:" || url.protocol === "data:") continue;
    assert.ok(permitidos.has(url.host), `pedido para fora do site: ${r.url()}`);
  }
}

/* ---------- Imagens sintéticas (PNG gerado aqui) ---------- */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function png(w, h, f) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = Math.max(0, Math.min(255, Math.round(f(x, y)))), i = y * (w * 3 + 1) + 1 + x * 3;
    raw[i] = raw[i + 1] = raw[i + 2] = v;
  }
  const chunk = (tipo, dados) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo), dados]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(corpo));
    return Buffer.concat([len, corpo, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const W = 1280, H = 720;
function blocos(semente) {
  let s = semente;
  const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const b = new Float32Array((W / 8) * (H / 8)).map(() => r());
  return (x, y) => b[Math.floor(y / 8) * (W / 8) + Math.floor(x / 8)];
}
const cena = (semente) => { const b = blocos(semente); return png(W, H, (x, y) => 60 + b(x, y) * 136); };
// "Lateral" assimétrica: claro de um lado, escuro do outro (o espelho inverte)
const lateral = (espelhada) => { const b = blocos(5); return png(W, H, (x, y) => 50 + 140 * ((espelhada ? W - x : x) / W) + (b(x, y) - 0.5) * 40); };
const escuraTremida = png(W, H, (x, y) => 18 + 6 * Math.sin(x / 40) * Math.cos(y / 40));

async function enviar(page, buffer) {
  await page.waitForFunction(() => !document.querySelector("#v-arquivo").disabled, null, { timeout: 15000 });
  await page.setInputFiles("#v-arquivo", { name: "sintetica.png", mimeType: "image/png", buffer });
}
const SEM_DETECTOR = { limites: {}, camadas: { deteccao: false } };
async function esperarResultado(page) {
  await page.waitForFunction(() => !document.querySelector("#v-resultado").hidden &&
    /aprovada|tirar de novo/.test(document.querySelector("#v-resultado-titulo").textContent), null, { timeout: 120000 });
  return page.locator("#v-status").innerText();
}

/* ---------- Testes ---------- */

test("página isolada: noindex, sem link no site e CSP sem conexão externa", async (t) => {
  const index = await readFile(path.join(root, "index.html"), "utf8");
  assert.ok(!index.includes("vistoria-teste"), "a landing page não pode linkar a página de teste");
  const { page, requests } = await abrir(t, { dev: false });
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex,nofollow");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  for (const d of ["connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'", "script-src 'self';"]) assert.ok(csp.includes(d), d);
  // Sem ?dev=1: nada de arquivo, forçar aceitar ou painel
  for (const sel of ["#v-arquivo-rotulo", "#v-forcar", "#v-painel", "#v-dev-faixa"]) {
    assert.equal(await page.locator(sel).isHidden(), true, sel);
    // O atributo hidden precisa valer mesmo em botões (.btn define display)
    assert.equal(await page.locator(sel).evaluate((n) => getComputedStyle(n).display), "none", sel);
  }
  semEnvio(requests);
});

test("câmera ao vivo + detector local: captura, prévia e nenhum envio para fora", async (t) => {
  const { page, requests } = await abrir(t, { dev: false });
  await page.click("#v-comecar");
  await page.waitForFunction(() => document.querySelector("#v-video").videoWidth > 0, null, { timeout: 15000 });
  assert.equal(await page.locator("#v-slot-nome").innerText(), "Frente");
  await page.click("#v-capturar");
  const status = await esperarResultado(page);
  assert.match(status, /Aprovada|Reprovada/);
  assert.match(await page.locator("#v-previa-img").getAttribute("src"), /^blob:/);
  // O modelo carregou dos arquivos do próprio site, sem violar a CSP
  assert.equal(await page.evaluate(() => window.__vistoria.estadoDetector), "pronto");
  // Única recusa esperada: o long.js (dentro do TF.js) testa WebAssembly num try e segue sem ele.
  // Nenhuma execução de texto como código ('unsafe-eval') é liberada.
  assert.deepEqual((await page.evaluate(() => window.__csp)).filter((v) => v !== "script-src wasm-eval"), []);
  assert.ok(requests.some((r) => r.url().endsWith("/assets/modelos/coco-ssd-lite/model.json")));
  // Padrão da câmera falsa não é um carro: o detector reprova (sem carro) e não há "forçar" fora do dev
  assert.match(status, /Não encontrei o carro|cortado|pequeno|Centralize/);
  assert.equal(await page.locator("#v-forcar").isHidden(), true);
  semEnvio(requests);
});

test("qualidade: foto escura e tremida reprova com motivos; só o dev pode forçar", async (t) => {
  const { page, requests } = await abrir(t, { ajustes: SEM_DETECTOR });
  await page.click("#v-comecar");
  await enviar(page, escuraTremida);
  const status = await esperarResultado(page);
  assert.match(status, /Reprovada/);
  assert.match(status, /Muito escuro/);
  assert.match(status, /tremida ou desfocada/);
  assert.equal(await page.locator("#v-aceitar").isDisabled(), true);
  assert.equal(await page.locator("#v-forcar").isVisible(), true);
  assert.match(await page.locator("#v-metricas").innerText(), /Nitidez/);
  await page.click("#v-forcar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  assert.equal(await page.locator("#v-slot-nome").innerText(), "Traseira");
  semEnvio(requests);
});

test("fluxo completo: duplicada e lado repetido só avisam; revisão, relatório JSON e ZIP locais", async (t) => {
  const { page, requests } = await abrir(t, { ajustes: SEM_DETECTOR });
  await page.click("#v-comecar");
  const passo = async (imagem, esperado) => {
    await enviar(page, imagem);
    const status = await esperarResultado(page);
    assert.match(status, /Aprovada/, status);
    if (esperado) assert.match(status, esperado);
    await page.click("#v-aceitar");
    await page.locator("#v-captura").waitFor({ state: "visible" });
  };
  await passo(cena(1));
  await passo(cena(1), /Parece a mesma foto de “Frente”/);                // duplicada: aviso
  await passo(lateral(false));
  await passo(lateral(false), /Parece o mesmo lado de “Lateral esquerda”/); // mesmo lado: aviso
  assert.equal(await page.locator("#v-slot-nome").innerText(), "Diagonal frontal esquerda");
  await page.click("#v-ver-revisao");
  assert.match(await page.locator("#v-revisao-resumo").innerText(), /4 de 11/);
  assert.equal(await page.locator(".v-item--aprovada").count(), 4);

  const [dj] = await Promise.all([page.waitForEvent("download"), page.click("#v-relatorio")]);
  const texto = await readFile(await dj.path(), "utf8");
  const rel = JSON.parse(texto);
  assert.equal(rel.fase, 1);
  assert.equal(rel.fotos.length, 11);
  assert.equal(rel.fotos[0].status, "aprovada");
  assert.ok(rel.fotos[1].avisos.some((a) => a.camada === "duplicada"));
  assert.ok(rel.fotos[3].avisos.some((a) => a.camada === "espelho"));
  assert.equal(rel.fotos[3].tentativas, 1);
  assert.equal(rel.fotos[4].status, "pendente");
  assert.equal(rel.fotos[0].codigoTipoSgaPendente, null);
  assert.ok(rel.camadas.duplicada.avisou >= 1 && rel.camadas.espelho.avisou >= 1);
  assert.ok(!/data:image|blob:/.test(texto), "o relatório não leva imagens");

  const [dz] = await Promise.all([page.waitForEvent("download"), page.click("#v-zip")]);
  const z = await readFile(await dz.path());
  assert.equal(z.subarray(0, 2).toString(), "PK");
  for (const nome of ["relatorio.json", "miniaturas/01-frente.jpg", "miniaturas/04-lateral-direita.jpg"]) assert.ok(z.includes(nome), nome);
  semEnvio(requests);
});

test("IndexedDB: recarregar mantém as fotos, que expiram sozinhas; Limpar tudo apaga", async (t) => {
  // Expiração de ~2 s só neste teste
  const rotas = (ctx) => ctx.route(`${origin}/js/vistoria-config.js`, async (route) => {
    const r = await route.fetch();
    route.fulfill({ response: r, body: (await r.text()).replace("expiraHoras: 4", "expiraHoras: 0.0006") });
  });
  const { page, requests } = await abrir(t, { ajustes: SEM_DETECTOR, rotas });
  await page.click("#v-comecar");
  await enviar(page, cena(2));
  await esperarResultado(page);
  await page.click("#v-aceitar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  await page.reload();
  await page.locator("#v-retomada").waitFor({ state: "visible" });
  assert.match(await page.locator("#v-retomada").innerText(), /1 foto/);
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#v-retomada").isHidden(), true, "expirou e foi apagada");
  // Limpar tudo
  await page.click("#v-comecar");
  await enviar(page, cena(3));
  await esperarResultado(page);
  await page.click("#v-aceitar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  await page.click("#v-ver-revisao");
  await page.click("#v-limpar");
  await page.locator("#v-inicio").waitFor({ state: "visible" });
  await page.reload();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#v-retomada").isHidden(), true);
  semEnvio(requests);
});

test("câmera negada: mensagem clara e botão de foto desativado", async (t) => {
  const initScript = () => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("negado", "NotAllowedError"));
  };
  const { page } = await abrir(t, { dev: false, initScript, ajustes: SEM_DETECTOR });
  await page.click("#v-comecar");
  await page.locator("#v-camera-erro").waitFor({ state: "visible" });
  assert.match(await page.locator("#v-camera-erro").innerText(), /Permissão da câmera negada/);
  assert.equal(await page.locator("#v-capturar").isDisabled(), true);
});

test("modelo de detecção indisponível: erro visível mesmo fora do modo dev", async (t) => {
  const rotas = (ctx) => ctx.route(`${origin}/assets/modelos/**`, (route) => route.fulfill({ status: 404, body: "" }));
  const { page } = await abrir(t, { dev: false, rotas });
  await page.click("#v-comecar");
  await page.locator("#v-aviso").waitFor({ state: "visible", timeout: 60000 });
  assert.match(await page.locator("#v-aviso").innerText(), /detector de veículo não carregou/);
});

test("nível do celular: torto reprova com motivo; reto aprova", async (t) => {
  const { page } = await abrir(t, { ajustes: SEM_DETECTOR });
  await page.click("#v-comecar");
  const girar = (beta, gamma) => page.evaluate(([b, g]) => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: b, gamma: g })), [beta, gamma]);
  await girar(70, -90); // em pé, 20° torto
  await page.locator("#v-nivel").waitFor({ state: "visible" });
  assert.match(await page.locator("#v-nivel-texto").innerText(), /Endireite 20°/);
  await enviar(page, cena(4));
  assert.match(await esperarResultado(page), /Celular torto/);
  await page.click("#v-refazer");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  await girar(0, 90); // paisagem, reto
  assert.match(await page.locator("#v-nivel-texto").innerText(), /Reto/);
  await enviar(page, cena(4));
  const status = await esperarResultado(page);
  assert.match(status, /Aprovada/);
  assert.doesNotMatch(status, /torto/);
});

test("câmera: botão de foto volta a funcionar depois de aceitar, e foto do sensor em pé é girada", async (t) => {
  // Simula o Safari do iPhone: takePhoto devolve a imagem do sensor EM PÉ (1080x1920),
  // com o "céu" (claro) à direita, mesmo com o celular deitado
  const initScript = () => {
    window.ImageCapture = class {
      async takePhoto() {
        const c = new OffscreenCanvas(1080, 1920), g = c.getContext("2d");
        g.fillStyle = "#333"; g.fillRect(0, 0, 1080, 1920);
        g.fillStyle = "#eee"; g.fillRect(760, 0, 320, 1920);
        for (let i = 0; i < 4000; i++) { g.fillStyle = i % 2 ? "#777" : "#aaa"; g.fillRect((i * 37) % 700, (i * 53) % 1920, 6, 6); }
        return c.convertToBlob({ type: "image/jpeg", quality: 0.9 });
      }
    };
  };
  const { page, requests } = await abrir(t, { ajustes: SEM_DETECTOR, initScript });
  await page.click("#v-comecar");
  await page.waitForFunction(() => document.querySelector("#v-video").videoWidth > 0, null, { timeout: 15000 });
  await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: -90 }))); // deitado, topo à esquerda
  await page.click("#v-capturar");
  await esperarResultado(page);
  const metricas = await page.locator("#v-metricas").innerText();
  assert.match(metricas, /1920×1080/, "a foto ficou deitada (paisagem)");
  assert.match(metricas, /girada -90°/);
  assert.doesNotMatch(await page.locator("#v-status").innerText(), /Gire o celular/);
  // O lado claro (céu) foi para o alto da foto
  const topoClaro = await page.locator("#v-previa-img").evaluate(async (img) => {
    await img.decode();
    const c = document.createElement("canvas"); c.width = 40; c.height = 40;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, 40, 40);
    const px = (x, y) => g.getImageData(x, y, 1, 1).data[0];
    return px(20, 2) > 200 && px(20, 38) < 200;
  });
  assert.equal(topoClaro, true);
  // Aceita (forçado, se preciso) e o botão de foto precisa estar ativo no passo seguinte
  if (await page.locator("#v-aceitar").isEnabled()) await page.click("#v-aceitar"); else await page.click("#v-forcar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  assert.equal(await page.locator("#v-slot-nome").innerText(), "Traseira");
  await page.waitForFunction(() => !document.querySelector("#v-capturar").disabled, null, { timeout: 5000 });
  await page.click("#v-capturar");
  await esperarResultado(page);
  assert.match(await page.locator("#v-resultado-titulo").innerText(), /Traseira/);
  semEnvio(requests);
});

test("tela da câmera: vídeo e disparador cabem na tela, em pé e deitado, sem rolar", async (t) => {
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
    const context = await browser.newContext({ permissions: ["camera", "geolocation"], geolocation: GEO, viewport });
    t.after(() => context.close());
    await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.continue() : route.abort()));
    await context.addInitScript((a) => localStorage.setItem("vistoria-ajustes", JSON.stringify(a)), SEM_DETECTOR);
    const page = await context.newPage();
    await page.goto(`${origin}/vistoria-teste.html?dev=1`);
    await page.click("#v-comecar");
    await page.waitForFunction(() => document.querySelector("#v-video").videoWidth > 0, null, { timeout: 15000 });
    const dentro = async (sel) => {
      const b = await page.locator(sel).boundingBox();
      return b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 0.5 && b.y + b.height <= viewport.height + 0.5;
    };
    for (const sel of ["#v-video", "#v-capturar", "#v-ver-revisao", "#v-slot-nome"]) assert.ok(await dentro(sel), `${sel} fora da tela em ${viewport.width}x${viewport.height}`);
    // O disparador fica dentro da área da câmera e a página não rola
    const cam = await page.locator("#v-camera").boundingBox(), bt = await page.locator("#v-capturar").boundingBox();
    assert.ok(bt.y >= cam.y && bt.y + bt.height <= cam.y + cam.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
    // A guia cobre exatamente a área visível do vídeo
    const guia = await page.locator("#v-guia").boundingBox();
    const area = await page.evaluate(() => { const v = document.querySelector("#v-video"); const k = Math.min(v.clientWidth / v.videoWidth, v.clientHeight / v.videoHeight); return { w: v.videoWidth * k, h: v.videoHeight * k }; });
    assert.ok(Math.abs(guia.width - area.w) < 2 && Math.abs(guia.height - area.h) < 2, JSON.stringify({ guia, area }));
  }
});

test("silhueta gira com o celular deitado quando o vídeo chega em pé (iPhone com tela travada)", async (t) => {
  const initScript = () => {
    navigator.mediaDevices.getUserMedia = async () => {
      const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
      const g = cv.getContext("2d");
      setInterval(() => { g.fillStyle = "#556"; g.fillRect(0, 0, 1080, 1920); }, 100);
      return cv.captureStream(10);
    };
  };
  const { page } = await abrir(t, { ajustes: SEM_DETECTOR, initScript });
  await page.click("#v-comecar");
  await page.waitForFunction(() => document.querySelector("#v-video").videoHeight > 0, null, { timeout: 15000 });
  const giro = () => page.locator("#v-silhueta").evaluate((n) => n.style.transform);
  const girar = (beta, gamma) => page.evaluate(([b, g]) => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: b, gamma: g })), [beta, gamma]);
  await girar(90, 0);              // em pé: sem giro
  assert.equal(await giro(), "");
  await girar(0, -90);             // deitado, topo à esquerda: gira 90° (horário)
  assert.equal(await giro(), "rotate(90deg)");
  await girar(0, 90);              // deitado para o outro lado
  assert.equal(await giro(), "rotate(-90deg)");
  // A silhueta girada continua do tamanho da área do vídeo (medidas trocadas), depois da animação
  await page.waitForTimeout(400);
  const [guia, sil] = await Promise.all([page.locator("#v-guia").boundingBox(), page.locator("#v-silhueta").boundingBox()]);
  assert.ok(Math.abs(guia.width - sil.width) < 2 && Math.abs(guia.height - sil.height) < 2, JSON.stringify({ guia, sil }));
});

test("localização obrigatória: sem permissão, mensagem clara e nenhuma foto", async (t) => {
  const initScript = () => {
    const negar = (_ok, erro) => setTimeout(() => erro({ code: 1, message: "negado" }), 10);
    navigator.geolocation.watchPosition = negar;
    navigator.geolocation.getCurrentPosition = negar;
  };
  const { page } = await abrir(t, { ajustes: SEM_DETECTOR, initScript });
  await page.click("#v-comecar");
  await page.locator("#v-geo-erro").waitFor({ state: "visible" });
  assert.match(await page.locator("#v-geo-erro").innerText(), /localização é obrigatória e foi negada/);
  assert.match(await page.locator("#v-geo-status").innerText(), /Sem localização/);
  await page.waitForFunction(() => document.querySelector("#v-video").videoWidth > 0, null, { timeout: 15000 });
  assert.equal(await page.locator("#v-capturar").isDisabled(), true, "câmera aberta, mas sem GPS não tira foto");
  assert.equal(await page.locator("#v-arquivo").isDisabled(), true);
  assert.equal(await page.locator("#v-resultado").isHidden(), true);
});

test("carimbo: a foto guardada tem faixa com data e hora de Brasília e o logo; localização no relatório", async (t) => {
  const { page } = await abrir(t, { ajustes: SEM_DETECTOR });
  await page.click("#v-comecar");
  await page.locator("#v-geo-status.v-chip--ok").waitFor();
  assert.match(await page.locator("#v-geo-status").innerText(), /Localização ok \(±12 m\)/);
  await enviar(page, cena(6));
  await esperarResultado(page);
  // 1280x720 + faixa de 58 px (4,5% do lado maior) embaixo, escura
  const info = await page.locator("#v-previa-img").evaluate(async (img) => {
    await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
    return { w: img.naturalWidth, h: img.naturalHeight, fundoFaixa: px(4, img.naturalHeight - 4), meioFoto: px(640, 300) };
  });
  assert.deepEqual([info.w, info.h], [1280, 778]);
  assert.ok(info.fundoFaixa.every((v) => v < 40), `faixa escura: ${info.fundoFaixa}`);
  const metricas = await page.locator("#v-metricas").innerText();
  assert.match(metricas, /\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}\s+·\s+Horário de Brasília/);
  assert.match(metricas, /-15\.7939, -47\.8828 \(±12 m/);
  await page.click("#v-aceitar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  await page.click("#v-ver-revisao");
  const [dj] = await Promise.all([page.waitForEvent("download"), page.click("#v-relatorio")]);
  const rel = JSON.parse(await readFile(await dj.path(), "utf8"));
  assert.equal(rel.tipoVeiculo, "carro");
  assert.equal(rel.fotos[0].geo.lat, -15.7939);
  assert.match(rel.fotos[0].carimbo, /Horário de Brasília/);
  // O logo do carimbo é um arquivo do próprio site
  assert.equal((await fetch(`${origin}/assets/logo-claro.svg`)).status, 200);
});

test("mesmo veículo: foto tirada longe das outras gera aviso", async (t) => {
  const { page, context } = await abrir(t, { ajustes: SEM_DETECTOR });
  await page.click("#v-comecar");
  await enviar(page, cena(7));
  await esperarResultado(page);
  await page.click("#v-aceitar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  // ~1,1 km ao norte: outra localização para a 2ª foto
  await context.setGeolocation({ latitude: -15.7839, longitude: -47.8828, accuracy: 12 });
  await page.waitForFunction(() => /±12/.test(document.querySelector("#v-geo-status").textContent));
  await page.waitForTimeout(300);
  await enviar(page, cena(8));
  const status = await esperarResultado(page);
  assert.match(status, /Aprovada/, "distância só avisa");
  assert.match(status, /tirada a uns 1\d{3} m das outras/);
});

test("tipos de veículo: só carro e moto; moto tem lista e silhueta próprias; trocar com fotos pede para apagar", async (t) => {
  const { page } = await abrir(t, { ajustes: SEM_DETECTOR });
  await page.check('input[name="tipo"][value="moto"]');
  await page.click("#v-comecar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  assert.match(await page.locator("#v-progresso-texto").innerText(), /Foto 1 de 9/);
  assert.match(await page.locator("#v-slot-instrucao").innerText(), /moto/);
  assert.ok((await page.locator("#v-silhueta").innerHTML()).includes("ellipse"), "silhueta da moto");
  await enviar(page, cena(9));
  await esperarResultado(page);
  if (await page.locator("#v-aceitar").isEnabled()) await page.click("#v-aceitar"); else await page.click("#v-forcar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  await page.click("#v-ver-revisao");
  assert.match(await page.locator("#v-revisao-resumo").innerText(), /1 de 9/);
  assert.match(await page.locator("#v-grade").innerText(), /Número do motor/);
  // Não há mais vistoria de caminhão
  await page.reload();
  assert.deepEqual(await page.locator('input[name="tipo"]').evaluateAll((l) => l.map((i) => i.value)), ["carro", "moto"]);
  // Trocar para carro: confirma (aceito no teste) e apaga as fotos da moto
  await page.check('input[name="tipo"][value="carro"]');
  await page.waitForFunction(() => document.querySelector("#v-retomada").hidden);
  await page.click("#v-comecar");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  assert.match(await page.locator("#v-progresso-texto").innerText(), /Foto 1 de 11 · 0 pronta/);
});

test("continuidade: segue o veículo entre as fotos; avisa veículo perdido e salto; pausa no resultado não conta", async (t) => {
  // Detector falso (o modelo real não vê veículo em imagem sintética): devolve as caixas de window.__caixas
  const initScript = () => {
    window.__caixas = [];
    window.tf = { getBackend: () => "falso" };
    window.cocoSsd = { load: async () => ({ detect: async (el) => window.__caixas.map(([x, y, w, h]) => ({ class: "car", score: 0.9, bbox: [x * el.width, y * el.height, w * el.width, h * el.height] })) }) };
  };
  // Aparência: qualquer diferença conta (o vídeo falso não tem um "veículo" de verdade)
  const ajustes = { limites: { continuidadeLacunaMaxS: 2, continuidadeAparenciaMin: -1 }, camadas: {} };
  const { page, requests } = await abrir(t, { ajustes, initScript });
  const caixas = (c) => page.evaluate((v) => { window.__caixas = v; }, c);
  const olhadas = (n) => page.waitForFunction((x) => window.__vistoria.olhadas >= x, n, { timeout: 15000 });
  const aceitar = async () => { await page.click("#v-aceitar"); await page.locator("#v-captura").waitFor({ state: "visible" }); };
  const FRENTE = [[0.22, 0.12, 0.56, 0.76]], LATERAL = [[0.08, 0.3, 0.84, 0.4]];

  await page.click("#v-comecar");
  await caixas(FRENTE);
  await enviar(page, cena(11));
  assert.match(await esperarResultado(page), /Aprovada/);
  await aceitar();

  // Traseira: veículo sempre à vista → sem aviso. Antes, uma tentativa refeita com 3 s parado no resultado
  await olhadas(4);
  assert.match(await page.locator("#v-trilha-status").innerText(), /Acompanhando o veículo/);
  await enviar(page, cena(12));
  await esperarResultado(page);
  await caixas([]);
  await page.waitForTimeout(3000);   // olhando o resultado (pausa): não conta como lacuna
  await page.click("#v-refazer");
  await page.locator("#v-captura").waitFor({ state: "visible" });
  await caixas(FRENTE);
  await page.waitForTimeout(1200);
  await enviar(page, cena(12));
  let status = await esperarResultado(page);
  assert.doesNotMatch(status, /saiu da câmera|pulou/, status);
  assert.match(await page.locator("#v-metricas").innerText(), /desde “Frente”/);
  await aceitar();

  // Lateral esquerda: veículo some por ~3 s (limite 2 s) → aviso
  await caixas([]);
  await page.waitForTimeout(3000);
  assert.match(await page.locator("#v-trilha-status").innerText(), /Aponte para o veículo/);
  await caixas(LATERAL);
  await page.waitForTimeout(1000);
  await enviar(page, cena(13));
  status = await esperarResultado(page);
  assert.match(status, /Aprovada/, "continuidade só avisa");
  assert.match(status, /O veículo saiu da câmera por \d+ s entre “Traseira”/);
  await aceitar();

  // Lateral direita: a caixa pula de um canto ao outro → aviso de salto
  await caixas([[0.02, 0.3, 0.3, 0.3]]);
  await page.waitForTimeout(1500);
  await caixas([[0.68, 0.3, 0.3, 0.3]]);
  await page.waitForTimeout(2200); // precisa se firmar por 3 olhadas
  await caixas(LATERAL);
  await page.waitForTimeout(600);
  await enviar(page, cena(14));
  status = await esperarResultado(page);
  assert.match(status, /A câmera pulou de repente para outro ponto entre “Lateral esquerda”/);
  assert.match(await page.locator("#v-metricas").innerText(), /x/);
  await aceitar();

  // Relatório traz a continuidade de cada trecho
  await page.click("#v-ver-revisao");
  const [dj] = await Promise.all([page.waitForEvent("download"), page.click("#v-relatorio")]);
  const rel = JSON.parse(await readFile(await dj.path(), "utf8"));
  assert.equal(rel.fotos[1].comparacoes.continuidade.deSlot, "Frente");
  assert.ok(rel.fotos[2].avisos.some((a) => a.camada === "continuidade" && a.codigo === "lacuna"));
  assert.ok(rel.fotos[3].avisos.some((a) => a.codigo === "salto"));
  assert.ok(rel.camadas.continuidade.avisou >= 2);
  semEnvio(requests);
});
