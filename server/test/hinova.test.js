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
    if (caminho === "/veiculo/buscar/ABC1D23") {
      return responder(200, [{ placa: "ABC-1D23", codigo_veiculo: 77, cpf: "529.982.247-25", telefone_celular: "(11) 98765-4321" }]);
    }
    if (caminho === "/listar/boleto-associado-veiculo" && opt.method === "POST") {
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
  assert.equal(r.telefone, "5511987654321");
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
  assert.ok(!api.chamadas.some((c) => c.caminho.startsWith("/buscar/boleto")));
});

test("sem CPF na lista e veículo inexistente (404): não é erro e não envia", async () => {
  const h = criarHinova(cfg, { fetchImpl: apiFalsa().fetchImpl });
  assert.equal((await h.consultar({ placa: "ZZZ9Z99", cpf: "52998224725" })).resultado, "cpf_titular_nao_encontrado");
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

test("diagnóstico lê mensagens dentro de error como objeto ou lista", async () => {
  const { diagnosticar } = await import("../lib/hinova.js");
  const d = diagnosticar(200, { error: { mensagem: "Token inválido", codigo: 401, lista: ["Usuário bloqueado"] } });
  assert.deepEqual(d.mensagens, ["error.mensagem: Token inválido", "error.codigo: 401", "error.lista[0]: Usuário bloqueado"]);
});

test("modo token (padrão sem usuário/senha): usa o token da associação direto, sem /usuario/autenticar", async () => {
  const cfgToken = lerConfig({ HINOVA_TOKEN: "token-associacao" }).hinova;
  assert.equal(cfgToken.modoAuth, "token");
  const chamadas = [];
  const fetchImpl = async (url, opt) => {
    chamadas.push({ url, auth: opt.headers.Authorization });
    if (url.endsWith("/veiculo/buscar/ABC1D23")) return { status: 200, text: async () => JSON.stringify({ placa: "ABC1D23", codigo_veiculo: 1, cpf: "52998224725", telefone_celular: "11987654321" }) };
    return { status: 200, text: async () => JSON.stringify([{ data_vencimento: "10/10/2026", situacao_boleto: "ABERTO", linha_digitavel: "1" }]) };
  };
  const r = await criarHinova(cfgToken, { fetchImpl }).consultar({ placa: "ABC1D23", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.ok(chamadas.every((c) => c.auth === "Bearer token-associacao"));
  assert.ok(!chamadas.some((c) => c.url.includes("/usuario/autenticar")));
});

test("406 da Hinova = não encontrado (sem boletos no período)", async () => {
  const fetchImpl = async () => ({ status: 406, text: async () => JSON.stringify({ mensagem: "Nenhum registro encontrado" }) });
  const h = criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl });
  assert.equal((await h.consultar({ placa: "ABC1D23", cpf: "52998224725" })).resultado, "sem_boleto_no_periodo");
});

test("rota recusada com HTTP 200 e { error }: falha com diagnóstico", async () => {
  const fetchImpl = async () => ({ status: 200, text: async () => JSON.stringify({ error: { mensagem: "Rota não liberada para este token" } }) });
  const h = criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl });
  await assert.rejects(h.consultar({ placa: "ABC1D23", cpf: "52998224725" }), (e) => {
    assert.deepEqual(e.diagnostico.mensagens, ["error.mensagem: Rota não liberada para este token"]);
    return true;
  });
});

test("config: modo token não exige usuário e senha", async () => {
  const { conferirConfig } = await import("../lib/config.js");
  assert.deepEqual(conferirConfig(lerConfig({ TURNSTILE_SECRET: "s", ALLOWED_ORIGINS: "https://a", MODO: "producao", HINOVA_TOKEN: "t" })), []);
  assert.deepEqual(conferirConfig(lerConfig({ TURNSTILE_SECRET: "s", ALLOWED_ORIGINS: "https://a", MODO: "producao", HINOVA_TOKEN: "t", HINOVA_AUTH: "usuario" })), ["HINOVA_USUARIO", "HINOVA_SENHA"]);
});

test("boletos: POST igual ao n8n (placa, período dd/mm/aaaa, link_boleto)", async () => {
  const corpos = [];
  const fetchImpl = async (url, opt) => { if (opt.body) corpos.push(JSON.parse(opt.body)); return { status: 200, text: async () => "[]" }; };
  const agora = () => Date.UTC(2026, 9, 22, 15, 0, 0); // 22/10/2026
  const h = criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl, agora });
  await h.listarBoletos({ placa: "PGN3D63" });
  assert.deepEqual(corpos[0], { placa: "PGN3D63", data_vencimento_inicial: "23/08/2026", data_vencimento_final: "21/11/2026", link_boleto: true });
});

test("boletos: busca o detalhe (/buscar/boleto/{número}) quando falta linha digitável", async () => {
  const urls = [];
  const fetchImpl = async (url, opt) => {
    urls.push(`${opt.method} ${url.replace(/^https:\/\/[^/]+\/api\/sga\/v2/, "")}`);
    if (url.endsWith("/buscar/boleto/380977")) return { status: 200, text: async () => JSON.stringify({ linha_digitavel: "LINHA", link_boleto: "https://b" }) };
    return { status: 200, text: async () => JSON.stringify([{ nosso_numero: 380977, data_vencimento: "10/11/2026", situacao_boleto: "ABERTO" }]) };
  };
  const b = await criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl }).buscarBoletoAberto({ placa: "PGN3D63" });
  assert.deepEqual(b, { vencimento: "10/11/2026", linhaDigitavel: "LINHA", link: "https://b", pix: undefined });
  assert.deepEqual(urls, ["POST /listar/boleto-associado-veiculo", "GET /buscar/boleto/380977"]);
});

test("só rotas de boleto (HINOVA_PATH_VEICULO vazio): CPF e telefone vêm da lista", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return { status: 200, text: async () => JSON.stringify([{ cpf: "529.982.247-25", telefone_celular: "(11) 98765-4321", data_vencimento: "10/11/2026", situacao_boleto: "ABERTO", linha_digitavel: "L", link_boleto: "https://b" }]) };
  };
  const cfgBoleto = lerConfig({ HINOVA_TOKEN: "t", HINOVA_PATH_VEICULO: "" }).hinova;
  const h = criarHinova(cfgBoleto, { fetchImpl });
  const r = await h.consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5511987654321");
  assert.ok(!urls.some((u) => u.includes("/veiculo/")));
  assert.equal((await h.consultar({ placa: "PGN3D63", cpf: "11144477735" })).resultado, "cpf_nao_confere");
});

test("credenciais: remove espaços nas pontas e \"Bearer \" colado no token", () => {
  const c = lerConfig({ HINOVA_TOKEN: "  Bearer abc123 \n", HINOVA_USUARIO: " api ", HINOVA_SENHA: "s" }).hinova;
  assert.equal(c.token, "abc123");
  assert.equal(c.usuario, "api");
  assert.equal(c.modoAuth, "usuario");
});

test("token_usuario não expira: autentica uma vez e reaproveita", async () => {
  let autenticacoes = 0;
  let relogio = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/usuario/autenticar")) { autenticacoes++; return { status: 200, text: async () => JSON.stringify({ mensagem: "OK", token_usuario: "hash" }) }; }
    return { status: 200, text: async () => "[]" };
  };
  const h = criarHinova(cfg, { fetchImpl, agora: () => relogio });
  await h.autenticar();
  relogio += 30 * 24 * 60 * 60 * 1000; // 30 dias depois
  await h.listarBoletos({ placa: "ABC1D23" });
  assert.equal(autenticacoes, 1);
});

test("telefone: extrai o 1º celular válido e normaliza máscara, zero do DDD e vários números", async () => {
  const { extrairTelefone, mesmoTelefone } = await import("../lib/whatsapp.js");
  assert.equal(extrairTelefone("(87) 999999999"), "5587999999999");
  assert.equal(extrairTelefone("(087) 99999-9999"), "5587999999999");
  assert.equal(extrairTelefone("(87) 99999-9999 / (87) 3333-4444"), "5587999999999");
  assert.equal(extrairTelefone("+55 (87) 99999-9999"), "5587999999999");
  assert.equal(extrairTelefone(""), null);
  assert.ok(mesmoTelefone("87999999999", "(87) 999999999"));
  assert.ok(mesmoTelefone("5587999999999", "87 99999-9999"));
  assert.ok(mesmoTelefone("8799999999", "87999999999"));     // sem o 9º dígito de um lado
  assert.ok(!mesmoTelefone("87999999999", "87988888888"));
});

// Simula o fluxo do n8n: a lista traz CPF e telefone; o detalhe traz linha digitável e PIX
function apiN8n({ boletos }) {
  const urls = [];
  const fetchImpl = async (url, opt) => {
    const caminho = url.replace(/^https:\/\/[^/]+\/api\/sga\/v2/, "");
    urls.push(`${opt.method} ${caminho}`);
    if (caminho === "/listar/boleto-associado-veiculo") return { status: 200, text: async () => JSON.stringify(boletos) };
    if (caminho === "/buscar/boleto/380977") return { status: 200, text: async () => JSON.stringify({ linha_digitavel: "LINHA-380977", pix_copia_cola: "PIX-380977" }) };
    return { status: 404, text: async () => "{}" };
  };
  return { fetchImpl, urls };
}
const cfgToken = lerConfig({ HINOVA_TOKEN: "t" }).hinova;

test("fluxo n8n: telefone e CPF vêm da lista; veículo não é consultado; detalhe pelo nosso_numero", async () => {
  const api = apiN8n({ boletos: [
    { nosso_numero: 380977, data_vencimento: "05/11/2026", situacao_boleto: "ABERTO", cpf_associado: "529.982.247-25", telefone_celular: "(87) 999999999" }
  ] });
  const r = await criarHinova(cfgToken, { fetchImpl: api.fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5587999999999");
  assert.equal(r.boleto.linhaDigitavel, "LINHA-380977");
  assert.equal(r.boleto.pix, "PIX-380977");
  assert.deepEqual(api.urls, ["POST /listar/boleto-associado-veiculo", "GET /buscar/boleto/380977"]);
});

test("fluxo n8n: acha telefone e CPF em campos com outro nome (busca automática, só celular)", async () => {
  const api = apiN8n({ boletos: [
    { nosso_numero: 380977, data_vencimento: "05/11/2026", situacao_boleto: "ABERTO",
      associado: { documento_cpf: "52998224725", telefone_fixo: "(87) 3333-4444", celular_associado: "(87) 99999-9999" } }
  ] });
  const h = criarHinova(cfgToken, { fetchImpl: api.fetchImpl });
  const r = await h.consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5587999999999");
  const t = h.titularDe({ contato: { telefone: "(87) 3333-4444" } });
  assert.equal(t.telefone, "", "fixo não deve ser usado para WhatsApp na busca automática");
});

test("fluxo n8n: boletos de outro CPF na mesma placa não são enviados", async () => {
  const api = apiN8n({ boletos: [
    { nosso_numero: 111, data_vencimento: "01/10/2026", situacao_boleto: "ABERTO", cpf: "11144477735", telefone_celular: "(11) 911111111", linha_digitavel: "DE-OUTRO", link_boleto: "x" },
    { nosso_numero: 380977, data_vencimento: "05/11/2026", situacao_boleto: "ABERTO", cpf: "52998224725", telefone_celular: "(87) 999999999" }
  ] });
  const r = await criarHinova(cfgToken, { fetchImpl: api.fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5587999999999");
  assert.equal(r.boleto.linhaDigitavel, "LINHA-380977");
});

test("fluxo n8n: CPF que não está na lista não recebe nada", async () => {
  const api = apiN8n({ boletos: [{ nosso_numero: 380977, situacao_boleto: "ABERTO", cpf: "11144477735", telefone_celular: "(87) 999999999" }] });
  const r = await criarHinova(cfgToken, { fetchImpl: api.fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "cpf_nao_confere");
  assert.ok(!api.urls.some((u) => u.includes("/buscar/boleto")));
});
