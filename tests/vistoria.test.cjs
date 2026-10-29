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

// Abre a página registrando TODOS os pedidos. Tráfego externo é bloqueado (só fontes do Google são esperadas).
async function abrir(t, { dev = true, ajustes, initScript, rotas } = {}) {
  const context = await browser.newContext({ permissions: ["camera"], acceptDownloads: true, viewport: { width: 390, height: 844 } });
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

const enviar = (page, buffer) => page.setInputFiles("#v-arquivo", { name: "sintetica.png", mimeType: "image/png", buffer });
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
