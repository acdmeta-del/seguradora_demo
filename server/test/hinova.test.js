import { test } from "node:test";
import assert from "node:assert/strict";
import { lerConfig } from "../lib/config.js";
import { criarHinova } from "../lib/hinova.js";
import { normalizarTelefone, criarWhatsapp, montarMensagem } from "../lib/whatsapp.js";

const cfg = lerConfig({ HINOVA_TOKEN: "token-associacao", HINOVA_USUARIO: "api", HINOVA_SENHA: "senha" }).hinova;

// Simula a API: registra as chamadas e responde conforme o caminho
function apiFalsa({ expirarPrimeira = false } = {}) {
  const chamadas = [];
  let autenticacoes = 0;
  const responder = (status, dados) => ({ status, ok: status < 400, text: async () => JSON.stringify(dados) });
  const fetchImpl = async (url, opt) => {
    const caminho = url.replace(cfg.baseUrl, "");
    chamadas.push({ caminho, metodo: opt.method, auth: opt.headers.Authorization, body: opt.body });
    if (caminho === "/usuario/autenticar") { autenticacoes++; return responder(200, { token_usuario: `usuario-${autenticacoes}` }); }
    if (expirarPrimeira && autenticacoes === 1 && caminho.startsWith("/veiculo")) return responder(401, {});
    if (caminho === "/veiculo/buscar/ABC1D23/placa") {
      return responder(200, [{ placa: "ABC-1D23", codigo_veiculo: 77, cpf: "529.982.247-25", telefone_celular: "(11) 98765-4321" }]);
    }
    if (caminho === "/listar/boleto-associado-veiculo/77") {
      return responder(200, { boletos: [
        { data_vencimento: "10/09/2026", situacao_boleto: "BAIXADO", linha_digitavel: "pago" },
        { data_vencimento: "10/11/2026", situacao_boleto: "ABERTO", linha_digitavel: "novembro" },
        { data_vencimento: "10/10/2026", situacao_boleto: "ABERTO", linha_digitavel: "outubro", link_boleto: "https://x/b" }
      ] });
    }
    return responder(404, {});
  };
  return { fetchImpl, chamadas };
}

test("autentica com o token da associação e usa o token de usuário depois", async () => {
  const api = apiFalsa();
  const h = criarHinova(cfg, { fetchImpl: api.fetchImpl });
  const r = await h.consultar({ placa: "ABC1D23", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(api.chamadas[0].auth, "Bearer token-associacao");
  assert.deepEqual(JSON.parse(api.chamadas[0].body), { usuario: "api", senha: "senha" });
  assert.equal(api.chamadas[1].auth, "Bearer usuario-1");
  assert.equal(r.telefone, "11987654321");
});

test("escolhe o boleto em aberto mais antigo e ignora os baixados", async () => {
  const h = criarHinova(cfg, { fetchImpl: apiFalsa().fetchImpl });
  const r = await h.consultar({ placa: "ABC1D23", cpf: "52998224725" });
  assert.equal(r.boleto.linhaDigitavel, "outubro");
  assert.equal(r.boleto.link, "https://x/b");
});

test("CPF diferente do titular não segue para o boleto", async () => {
  const api = apiFalsa();
  const h = criarHinova(cfg, { fetchImpl: api.fetchImpl });
  const r = await h.consultar({ placa: "ABC1D23", cpf: "11144477735" });
  assert.equal(r.resultado, "cpf_nao_confere");
  assert.ok(!api.chamadas.some((c) => c.caminho.startsWith("/listar")));
});

test("veículo inexistente (404) não é erro", async () => {
  const h = criarHinova(cfg, { fetchImpl: apiFalsa().fetchImpl });
  assert.equal((await h.consultar({ placa: "ZZZ9Z99", cpf: "52998224725" })).resultado, "veiculo_nao_encontrado");
});

test("token de usuário expirado (401): autentica de novo e repete", async () => {
  const api = apiFalsa({ expirarPrimeira: true });
  const h = criarHinova(cfg, { fetchImpl: api.fetchImpl });
  assert.equal((await h.consultar({ placa: "ABC1D23", cpf: "52998224725" })).resultado, "ok");
  assert.equal(api.chamadas.filter((c) => c.caminho === "/usuario/autenticar").length, 2);
});

test("valores entram codificados no caminho", () => {
  const h = criarHinova(cfg, { fetchImpl: apiFalsa().fetchImpl });
  assert.equal(h._preencher("/x/{placa}/{cpf}", { placa: "A/B?C", cpf: "1 2" }), "/x/A%2FB%3FC/1%202");
});

test("telefone: normaliza para 55 + DDD + número", () => {
  assert.equal(normalizarTelefone("(11) 98765-4321"), "5511987654321");
  assert.equal(normalizarTelefone("5511987654321"), "5511987654321");
  assert.equal(normalizarTelefone("1234"), null);
});

test("Evolution API: monta a chamada com apikey e número cadastrado", async () => {
  const pedidos = [];
  const wa = criarWhatsapp(
    { ...lerConfig({}).whatsapp, provedor: "evolution", evolution: { url: "https://evo.exemplo", instancia: "integra", apikey: "chave" } },
    { fetchImpl: async (url, opt) => { pedidos.push({ url, opt }); return { ok: true, json: async () => ({ key: { id: "1" } }) }; } }
  );
  await wa.enviar("11987654321", montarMensagem({ vencimento: "10/10/2026", linhaDigitavel: "123" }, "Integra"));
  assert.equal(pedidos[0].url, "https://evo.exemplo/message/sendText/integra");
  assert.equal(pedidos[0].opt.headers.apikey, "chave");
  const corpo = JSON.parse(pedidos[0].opt.body);
  assert.equal(corpo.number, "5511987654321");
  assert.match(corpo.text, /Linha digitável: 123/);
});

test("Z-API: monta a chamada com instância, token e Client-Token", async () => {
  const pedidos = [];
  const wa = criarWhatsapp(
    { ...lerConfig({}).whatsapp, provedor: "zapi", zapi: { instancia: "INST1", token: "TOK1", clientToken: "SEG1" } },
    { fetchImpl: async (url, opt) => { pedidos.push({ url, opt }); return { ok: true, json: async () => ({ zaapId: "z", messageId: "m" }) }; } }
  );
  await wa.enviar("(11) 98765-4321", "olá");
  assert.equal(pedidos[0].url, "https://api.z-api.io/instances/INST1/token/TOK1/send-text");
  assert.equal(pedidos[0].opt.headers["Client-Token"], "SEG1");
  assert.deepEqual(JSON.parse(pedidos[0].opt.body), { phone: "5511987654321", message: "olá" });
});

test("Z-API: erro no corpo com HTTP 200 vira falha", async () => {
  const wa = criarWhatsapp(
    { ...lerConfig({}).whatsapp, provedor: "zapi", zapi: { instancia: "I", token: "T", clientToken: "C" } },
    { fetchImpl: async () => ({ ok: true, json: async () => ({ error: "Instance not connected" }) }) }
  );
  await assert.rejects(wa.enviar("11987654321", "x"), /recusou/);
});

test("config: Z-API exige as três credenciais", async () => {
  const { conferirConfig } = await import("../lib/config.js");
  const faltando = conferirConfig(lerConfig({ TURNSTILE_SECRET: "s", ALLOWED_ORIGINS: "https://a", MODO: "simulado", WHATSAPP_PROVIDER: "zapi", ZAPI_INSTANCE: "i" }));
  assert.deepEqual(faltando, ["ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"]);
});

test("autenticação 200 sem token: erro com diagnóstico seguro (sem valores)", async () => {
  const fetchImpl = async () => ({ status: 200, text: async () => JSON.stringify({ mensagem: "Usuário ou senha inválidos", sessao: "VALOR-SECRETO", codigo: 7 }) });
  const h = criarHinova(cfg, { fetchImpl });
  await assert.rejects(h.autenticar(), (e) => {
    assert.match(e.message, /HTTP 200/);
    assert.deepEqual(e.diagnostico.mensagens, ["mensagem: Usuário ou senha inválidos"]);
    assert.ok(e.diagnostico.campos.includes("sessao: string"));
    assert.ok(!JSON.stringify(e.diagnostico).includes("VALOR-SECRETO"));
    return true;
  });
});

test("autenticação aceita o token em campo alternativo (token)", async () => {
  const fetchImpl = async () => ({ status: 200, text: async () => JSON.stringify({ token: "abc" }) });
  assert.equal(await criarHinova(cfg, { fetchImpl }).autenticar(), "abc");
});
