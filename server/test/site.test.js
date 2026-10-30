import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { lerConfig } from "../lib/config.js";
import { criarApp } from "../app.js";

// Raiz do repositório: no dev local o site e o servidor estão juntos; só a lista de permissão sai
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const silencioso = { info() {}, error() {} };

async function subir(env = {}) {
  const cfg = lerConfig({ MODO: "simulado", ALLOWED_ORIGINS: "https://integra.exemplo", TURNSTILE_SECRET: "x", SITE_DIR: RAIZ, ...env });
  const app = criarApp(cfg, { hinova: {}, whatsapp: {}, turnstile: async () => true, log: silencioso });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, fim: () => new Promise((r) => server.close(r)) };
}

// GET cru (sem normalizar "../" como o fetch faz), para testar travessia de pasta
function getCru(base, caminho, headers = {}) {
  const u = new URL(base);
  return new Promise((ok, falha) => {
    http.get({ host: u.hostname, port: u.port, path: caminho, headers }, (res) => {
      let corpo = "";
      res.on("data", (d) => { corpo += d; });
      res.on("end", () => ok({ status: res.statusCode, headers: res.headers, corpo }));
    }).on("error", falha);
  });
}

test("site: páginas e pastas públicas com os cabeçalhos de segurança e cache", async (t) => {
  const s = await subir(); t.after(s.fim);
  const home = await fetch(`${s.base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.match(await home.text(), /Integra/);
  // A CSP da página vem do <meta> (testada no navegador); o servidor não manda outra por cima
  assert.equal(home.headers.get("content-security-policy"), null);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(home.headers.get("permissions-policy"), /camera=\(self\), geolocation=\(self\), microphone=\(\)/);
  assert.equal(home.headers.get("cache-control"), "no-cache");
  assert.equal(home.headers.get("x-powered-by"), null);

  const vistoria = await fetch(`${s.base}/vistoria-teste.html`);
  assert.equal(vistoria.status, 200);
  assert.match(await vistoria.text(), /noindex,nofollow/);

  // Biblioteca e modelo com versão no nome: 1 ano no aparelho; JS comprimido
  const tf = await getCru(s.base, "/js/vendor/tf-4.22.0.min.js", { "Accept-Encoding": "gzip" });
  assert.equal(tf.status, 200);
  assert.match(tf.headers["cache-control"], /max-age=31536000, immutable/);
  assert.equal(tf.headers["content-encoding"], "gzip");
  assert.match((await fetch(`${s.base}/assets/modelos/coco-ssd-lite/model.json`)).headers.get("cache-control"), /immutable/);
  assert.match((await fetch(`${s.base}/assets/logo.svg`)).headers.get("cache-control"), /max-age=604800/);
  assert.equal((await fetch(`${s.base}/js/vistoria.js`)).headers.get("cache-control"), "no-cache");

  // A API continua com a CSP restritiva do helmet; /healthz diz se o site está sendo servido
  const saude = await fetch(`${s.base}/healthz`);
  assert.ok(saude.headers.get("content-security-policy"));
  assert.deepEqual(await saude.json(), { ok: true, site: true });
});

test("site: nada fora da lista de permissão (servidor, .env, docs, testes, git, ../)", async (t) => {
  const s = await subir(); t.after(s.fim);
  for (const caminho of [
    "/server/app.js", "/server/.env.example", "/server/lib/config.js", "/server/package.json",
    "/docs/api/hinova-sga-api-v2.md", "/README.md", "/AGENTS.md", "/package.json", "/Dockerfile",
    "/tests/vistoria.test.cjs", "/.git/config", "/.gitignore", "/.env",
    "/js/../server/app.js", "/css/..%2f..%2fserver/app.js", "/assets/%2e%2e/%2e%2e/server/app.js", "/js/.hidden"
  ]) {
    const r = await getCru(s.base, caminho);
    assert.equal(r.status, 404, caminho);
    assert.ok(!/import |TURNSTILE|HINOVA/.test(r.corpo), `conteúdo vazou em ${caminho}`);
  }
  // Endereço de API inexistente: JSON curto
  const api = await fetch(`${s.base}/api/nada`);
  assert.equal(api.status, 404);
  assert.deepEqual(await api.json(), { ok: false, erro: "nao_encontrado" });
});

test("site: sem SITE_DIR, o app é só a API", async (t) => {
  const s = await subir({ SITE_DIR: "" }); t.after(s.fim);
  assert.equal((await fetch(`${s.base}/`)).status, 404);
  assert.deepEqual(await (await fetch(`${s.base}/healthz`)).json(), { ok: true, site: false });
});
