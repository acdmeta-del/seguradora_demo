const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

let browser, server, origin;
const root = path.resolve(__dirname, "..");
const files = new Map([
  ["/", ["index.html", "text/html"]],
  ["/js/main.js", ["js/main.js", "text/javascript"]],
  ["/content/content.js", ["content/content.js", "text/javascript"]],
  ["/css/styles.css", ["css/styles.css", "text/css"]]
]);

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--disable-dev-shm-usage"]
  });
  server = createServer(async (req, res) => {
    const file = files.get(new URL(req.url, origin).pathname);
    if (!file) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": file[1] });
    res.end(await readFile(path.join(root, file[0])));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function open(t, mode) {
  const context = await browser.newContext({ javaScriptEnabled: mode !== "no-js" });
  t.after(() => context.close());
  const requests = [];
  context.on("request", (r) => requests.push(r));
  // Tests never contact WhatsApp, CDNs or any other external service.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "wa.me") return route.fulfill({ body: "Mock WhatsApp" });
    if (url.origin !== origin) return route.abort();
    if ((mode === "missing-main" && url.pathname === "/js/main.js") ||
        (mode === "missing-content" && url.pathname === "/content/content.js")) return route.abort();
    if (mode === "startup-error" && url.pathname === "/js/main.js") {
      const source = await readFile(path.join(root, "js/main.js"), "utf8");
      return route.fulfill({ contentType: "text/javascript", body: source.replace("  initForm();", '  throw new Error("Simulated startup failure");') });
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(origin);
  return { page, context, requests };
}

function noNativeRequest(requests) {
  const local = requests.filter((r) => new URL(r.url()).origin === origin);
  assert.ok(local.every((r) => r.method() === "GET" && !new URL(r.url()).search && !r.postData()),
    "No native form request or personal data may reach the site");
}

for (const mode of ["no-js", "missing-main", "missing-content", "startup-error"]) {
  test(`fails closed: ${mode}`, async (t) => {
    const { page, requests } = await open(t, mode);
    for (const selector of ["#f-nome", "#f-whats", "#f-veiculo", '#cotacao button[type="submit"]']) {
      assert.equal(await page.locator(selector).isDisabled(), true);
    }
    assert.equal(await page.locator("#cotacao-indisponivel").isVisible(), true);
    await page.locator('#cotacao button[type="submit"]').click({ force: true });
    await page.keyboard.press("Enter");
    if (mode === "no-js") {
      // With scripting disabled, page callbacks (including CSP listeners) cannot run.
      assert.equal(page.url(), `${origin}/`);
      noNativeRequest(requests);
      return;
    }
    // Exercise the CSP too, even if disabled controls were accidentally enabled later.
    const directive = await page.evaluate(() => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Native submission was not blocked")), 2000);
      document.addEventListener("securitypolicyviolation", (e) => {
        clearTimeout(timeout); resolve(e.effectiveDirective);
      }, { once: true });
      const form = document.querySelector("#cotacao");
      form.querySelector("fieldset").disabled = false;
      form.nome.value = "Alice Teste";
      form.whatsapp.value = "11987654321";
      form.veiculo.value = "ABC1D23";
      HTMLFormElement.prototype.submit.call(form);
    }));
    assert.equal(directive, "form-action");
    assert.equal(page.url(), `${origin}/`);
    noNativeRequest(requests);
  });
}

async function fillQuote(page) {
  assert.equal(await page.locator("#cotacao-indisponivel").isHidden(), true);
  await page.locator("#f-nome").fill("Alice Teste");
  await page.locator("#f-whats").fill("11987654321");
  assert.equal(await page.locator("#f-whats").inputValue(), "(11) 98765-4321");
  await page.locator("#f-veiculo").fill("ABC1D23");
}

function checkMessage(url) {
  const wa = new URL(url);
  assert.equal(wa.origin, "https://wa.me");
  assert.equal(wa.searchParams.get("text"), [
    "Olá! Quero fazer uma cotação grátis.",
    "Nome: Alice Teste",
    "WhatsApp: (11) 98765-4321",
    "Veículo (placa ou modelo): ABC1D23"
  ].join("\n"));
}

for (const trigger of ["click", "Enter"]) {
  test(`normal WhatsApp flow: ${trigger}`, async (t) => {
    const { page, requests } = await open(t);
    await fillQuote(page);
    const popupPromise = page.waitForEvent("popup");
    if (trigger === "click") await page.locator('#cotacao button[type="submit"]').click();
    else await page.locator("#f-veiculo").press("Enter");
    const popup = await popupPromise;
    await popup.waitForLoadState();
    checkMessage(popup.url());
    assert.equal(await popup.evaluate(() => window.opener), null);
    assert.equal(page.url(), `${origin}/`);
    noNativeRequest(requests);
  });
}

test("invalid fields stay on the page without opening WhatsApp", async (t) => {
  const { page, requests } = await open(t);
  await page.locator('#cotacao button[type="submit"]').click();
  assert.equal(await page.locator("#cotacao .quote-form__error").isVisible(), true);
  assert.equal(await page.locator("#f-nome").getAttribute("aria-invalid"), "true");
  assert.equal(requests.some((r) => new URL(r.url()).hostname === "wa.me"), false);
  noNativeRequest(requests);
});

test("blocked popup keeps the existing WhatsApp navigation fallback", async (t) => {
  const { page, requests } = await open(t);
  await fillQuote(page);
  await page.evaluate(() => { window.open = () => null; });
  await page.locator('#cotacao button[type="submit"]').click();
  await page.waitForURL("https://wa.me/**");
  checkMessage(page.url());
  noNativeRequest(requests);
});

test("a runtime error in the submit handler cannot trigger a native GET", async (t) => {
  const { page, requests } = await open(t);
  await fillQuote(page);
  await page.evaluate(() => { window.open = () => { throw new Error("Simulated failure"); }; });
  const error = page.waitForEvent("pageerror");
  await page.locator('#cotacao button[type="submit"]').click();
  assert.match((await error).message, /Simulated failure/);
  assert.equal(page.url(), `${origin}/`);
  noNativeRequest(requests);
});

test("privacy dialog still closes with method=dialog", async (t) => {
  const { page, requests } = await open(t);
  await page.locator('[data-open="privacidade"]').click();
  assert.equal(await page.locator("#privacidade").isVisible(), true);
  await page.locator("#privacidade button").click();
  assert.equal(await page.locator("#privacidade").isVisible(), false);
  noNativeRequest(requests);
});

test("boleto fetch remains allowed by connect-src", async (t) => {
  const { page, requests } = await open(t);
  const response = await page.evaluate(async () => {
    const r = await fetch("/api/boleto", { method: "POST", body: "test" });
    return r.status;
  });
  // The static test server has no API. Receiving its 404 proves CSP allowed fetch.
  assert.equal(response, 404);
  assert.equal(requests.find((r) => r.url() === `${origin}/api/boleto`).method(), "POST");
});
