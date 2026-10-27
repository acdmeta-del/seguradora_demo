import { test } from "node:test";
import assert from "node:assert/strict";
import { lerConfig } from "../lib/config.js";
import { criarHinova } from "../lib/hinova.js";
import { normalizarTelefone, criarWhatsapp, montarMensagem, montarMensagens } from "../lib/whatsapp.js";


// Valores no formato real (os fictícios simples são recusados pela validação de propósito)
const LINHA = "34191.09933 79997.470939 75008.900005 5 16210000005500";
const LINHA2 = "34191.79001 01043.510047 91020.150008 1 99990000010000";
const LINHA3 = "23793.38128 60000.000003 00000.000400 1 84340000010000";
const PIX = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

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
        { data_vencimento: "10/09/2026", descricao_situacao_boleto: "BAIXADO", linha_digitavel: LINHA3 },
        { data_vencimento: "10/11/2026", descricao_situacao_boleto: "ABERTO", linha_digitavel: LINHA2 },
        { data_vencimento: "10/10/2026", descricao_situacao_boleto: "ABERTO", linha_digitavel: LINHA, link_boleto: "https://x/b", pix: { qrcode: "iVBORw0KGgo=", copia_cola: PIX } }
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
  assert.equal(r.boleto.linhaDigitavel, LINHA);
  assert.equal(r.boleto.pix, PIX, "PIX dentro de objeto deve sair como texto");
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
  await wa.enviar("11987654321", montarMensagem({ vencimento: "10/10/2026", linhaDigitavel: LINHA }, "Integra"));
  assert.equal(pedidos[0].url, "https://evo.exemplo/message/sendText/integra");
  assert.equal(pedidos[0].opt.headers.apikey, "chave");
  const corpo = JSON.parse(pedidos[0].opt.body);
  assert.equal(corpo.number, "5511987654321");
  assert.match(corpo.text, /Linha digitável:\*\n```34191\.09933/);
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
    return { status: 200, text: async () => JSON.stringify([{ data_vencimento: "10/10/2026", descricao_situacao_boleto: "ABERTO", linha_digitavel: LINHA, pix: { copia_cola: PIX } }]) };
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
    if (url.endsWith("/buscar/boleto/380977")) return { status: 200, text: async () => JSON.stringify({ linha_digitavel: LINHA, link_boleto: "https://b", pix: { copia_cola: PIX } }) };
    return { status: 200, text: async () => JSON.stringify([{ nosso_numero: 380977, data_vencimento: "10/11/2026", descricao_situacao_boleto: "ABERTO" }]) };
  };
  const b = await criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl }).buscarBoletoAberto({ placa: "PGN3D63" });
  assert.deepEqual(b, { vencimento: "10/11/2026", valor: null, linhaDigitavel: LINHA, link: "https://b/", pix: PIX, alertas: [] });
  assert.deepEqual(urls, ["POST /listar/boleto-associado-veiculo", "GET /buscar/boleto/380977"]);
});

test("só rotas de boleto (HINOVA_PATH_VEICULO vazio): CPF e telefone vêm da lista", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return { status: 200, text: async () => JSON.stringify([{ cpf: "529.982.247-25", telefone_celular: "(11) 98765-4321", data_vencimento: "10/11/2026", descricao_situacao_boleto: "ABERTO", linha_digitavel: LINHA, link_boleto: "https://b", pix: { copia_cola: PIX } }]) };
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
    if (caminho === "/buscar/boleto/380977") return { status: 200, text: async () => JSON.stringify({ linha_digitavel: LINHA, pix: { qrcode: "iVBORw0KGgo=", copia_cola: PIX } }) };
    return { status: 404, text: async () => "{}" };
  };
  return { fetchImpl, urls };
}
const cfgToken = lerConfig({ HINOVA_TOKEN: "t" }).hinova;

test("fluxo n8n: telefone e CPF vêm da lista; veículo não é consultado; detalhe pelo nosso_numero", async () => {
  const api = apiN8n({ boletos: [
    { nosso_numero: 380977, data_vencimento: "05/11/2026", descricao_situacao_boleto: "ABERTO", cpf_associado: "529.982.247-25", telefone_celular: "(87) 999999999" }
  ] });
  const r = await criarHinova(cfgToken, { fetchImpl: api.fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5587999999999");
  assert.equal(r.boleto.linhaDigitavel, LINHA);
  assert.equal(r.boleto.pix, PIX);
  assert.deepEqual(api.urls, ["POST /listar/boleto-associado-veiculo", "GET /buscar/boleto/380977"]);
});

test("campos com nome parecido NÃO são usados; só os configurados", async () => {
  const boletos = [{ nosso_numero: 380977, data_vencimento: "05/11/2026", descricao_situacao_boleto: "ABERTO", linha_digitavel: LINHA,
    pix: { copia_cola: PIX }, cpf_associado: "52998224725", celular_associado: "(87) 99999-9999" }];
  const semConfig = await criarHinova(lerConfig({ HINOVA_TOKEN: "t", HINOVA_PATH_VEICULO: "" }).hinova, { fetchImpl: apiN8n({ boletos }).fetchImpl })
    .consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(semConfig.resultado, "sem_telefone", "não pode adivinhar o campo do telefone");
  const comConfig = await criarHinova(lerConfig({ HINOVA_TOKEN: "t", HINOVA_PATH_VEICULO: "", HINOVA_CAMPO_TELEFONE: "celular_associado" }).hinova, { fetchImpl: apiN8n({ boletos }).fetchImpl })
    .consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(comConfig.resultado, "ok");
  assert.equal(comConfig.telefone, "5587999999999");
});

test("fluxo n8n: boletos de outro CPF na mesma placa não são enviados", async () => {
  const api = apiN8n({ boletos: [
    { nosso_numero: 111, data_vencimento: "01/10/2026", descricao_situacao_boleto: "ABERTO", cpf: "11144477735", telefone_celular: "(11) 911111111", linha_digitavel: LINHA3, link_boleto: "https://outro" },
    { nosso_numero: 380977, data_vencimento: "05/11/2026", descricao_situacao_boleto: "ABERTO", cpf: "52998224725", telefone_celular: "(87) 999999999" }
  ] });
  const r = await criarHinova(cfgToken, { fetchImpl: api.fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5587999999999");
  assert.equal(r.boleto.linhaDigitavel, LINHA);
});

test("fluxo n8n: CPF que não está na lista não recebe nada", async () => {
  const api = apiN8n({ boletos: [{ nosso_numero: 380977, descricao_situacao_boleto: "ABERTO", cpf: "11144477735", telefone_celular: "(87) 999999999" }] });
  const r = await criarHinova(cfgToken, { fetchImpl: api.fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "cpf_nao_confere");
  assert.ok(!api.urls.some((u) => u.includes("/buscar/boleto")));
});

test("vencimento sempre em DD/MM/AAAA", async () => {
  const { formatarData } = await import("../lib/formatar.js");
  assert.equal(formatarData("2026-11-05"), "05/11/2026");
  assert.equal(formatarData("2026-11-05 00:00:00"), "05/11/2026");
  assert.equal(formatarData("2026-11-05T03:00:00.000Z"), "05/11/2026");
  assert.equal(formatarData("05/11/2026"), "05/11/2026");
  assert.equal(formatarData({ data: "2026-11-05" }), null);
  assert.equal(formatarData("amanhã"), null);
});

test("PIX copia e cola: só aceita código EMV válido (CRC do Banco Central)", async () => {
  const { pixValido } = await import("../lib/formatar.js");
  assert.equal(pixValido(PIX), PIX);
  assert.equal(pixValido(PIX.replace("Fulano", "Fulana")), null, "CRC não confere");
  assert.equal(pixValido({ copia_cola: PIX }), null, "objeto não é texto");
  assert.equal(pixValido("[object Object]"), null);
  assert.equal(pixValido("iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6AQAAAACgl2eQ"), null, "imagem do QR não é PIX");
});

test("PIX lido só do campo exato pix.copia_cola (nada de busca em outros campos)", async () => {
  const { pixDoCampo } = await import("../lib/formatar.js");
  const campos = lerConfig({}).hinova.campos.pix;
  assert.deepEqual(campos, ["pix.copia_cola"]);
  assert.equal(pixDoCampo({ pix: { qrcode: "iVBOR", copia_cola: PIX } }, campos).pix, PIX);
  // Um PIX válido em outro campo não pode ser usado
  const vizinho = pixDoCampo({ observacao: PIX, pix: { qrcode: "iVBOR" } }, campos);
  assert.equal(vizinho.pix, null);
  assert.equal(vizinho.presente, false);
  // Campo existe mas é inválido: omitido, com alerta
  const invalido = pixDoCampo({ pix: { copia_cola: "000201xx" } }, campos);
  assert.equal(invalido.pix, null);
  assert.equal(invalido.presente, true);
});

test("mensagem nunca contém [object Object] e omite o que for inválido", () => {
  const texto = montarMensagem({
    vencimento: "2026-11-05",
    linhaDigitavel: LINHA,
    pix: { copia_e_cola: PIX },          // objeto (o caso do bug): deve ser omitido aqui, não impresso
    link: "https://short.hinova.com.br/v2/GyFl7YRm.pdf"
  }, "Integra Proteção Veicular");
  assert.ok(!texto.includes("[object"), texto);
  assert.match(texto, /\*Vencimento:\* 05\/11\/2026/);
  assert.match(texto, /```34191\.09933 79997\.470939 75008\.900005 5 16210000005500```/);
  assert.ok(!/PIX|000201/.test(texto), "PIX inválido não entra nem é anunciado");
  const comPix = montarMensagens({ vencimento: "05/11/2026", linhaDigitavel: LINHA, pix: PIX, link: "javascript:alert(1)" }, "Integra");
  assert.equal(comPix.length, 2);
  assert.equal(comPix[1], PIX, "a 2ª mensagem é só o código PIX, sem texto junto");
  assert.match(comPix[0], /próxima mensagem/);
  assert.ok(!comPix[0].includes("000201"), "o código não vai no resumo");
  assert.ok(!comPix.join("").includes("javascript:"), "link não https é omitido");
});

test("resposta real de /listar/boleto-associado-veiculo (anonimizada): PIX, datas e campos exatos", async () => {
  const PIX_REAL = "00020101021226770014BR.GOV.BCB.PIX2555api.itau/pix/qr/v2/b25d8c92-2eff-49b0-8ef4-ba91d7e950615204000053039865802BR5915HINOVA PAYMENTS6014BELO HORIZONTE62070503***63049C99";
  const item = {
    codigo_associado: 12195, nome_associado: "ASSOCIADO TESTE", cpf_associado: "529.982.247-25", email: "teste@exemplo.com",
    codigo_boleto: "381011", nosso_numero: 380978, codigo_situacao_boleto: "2", descricao_situacao_boleto: "ABERTO",
    data_emissao: "2026-09-09", data_vencimento_original: "2026-11-05", data_vencimento: "2026-11-05", valor_boleto: "55.00",
    linha_digitavel: LINHA, link_boleto: "https://short.hinova.com.br/v2/GyFl7YRm.pdf",
    short_link: "https://short.hinova.com.br/v2/GyFl7YRm.pdf",
    pix: { qrcode: "iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6AQAAAACgl2eQAAAC0klEQVR4Xu2X0W3kMAwFpUas", copia_cola: PIX_REAL },
    veiculos: [{ codigo_veiculo: 5753, placa: "PGN3D63", descricao_situacao_veicul: "ATIVO" }]
  };
  const urls = [];
  const fetchImpl = async (url, opt) => {
    const caminho = url.replace(/^https:\/\/[^/]+\/api\/sga\/v2/, "");
    urls.push(`${opt.method} ${caminho}`);
    if (caminho === "/listar/boleto-associado-veiculo") return { status: 200, text: async () => JSON.stringify([item, item]) };
    // a lista não traz telefone: vem do veículo (reserva)
    if (caminho === "/veiculo/buscar/PGN3D63") return { status: 200, text: async () => JSON.stringify({ placa: "PGN3D63", telefone_celular: "(87) 999999999" }) };
    return { status: 404, text: async () => "{}" };
  };
  const r = await criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5587999999999");
  assert.deepEqual(r.boleto, { vencimento: "05/11/2026", valor: "R$ 55,00", linhaDigitavel: LINHA, link: "https://short.hinova.com.br/v2/GyFl7YRm.pdf", pix: PIX_REAL, alertas: [] });
  assert.deepEqual(urls, ["POST /listar/boleto-associado-veiculo", "GET /veiculo/buscar/PGN3D63"], "lista já traz linha e PIX: sem chamada de detalhe");
  const texto = montarMensagem(r.boleto, "Integra Proteção Veicular");
  assert.ok(!texto.includes("[object"));
  assert.match(texto, /\*Vencimento:\* 05\/11\/2026/);
  assert.equal(montarMensagens(r.boleto, "Integra")[1], PIX_REAL);
});

test("escolha do boleto: sem situação ou pago não é enviado; sem linha/PIX passa para o próximo", async () => {
  const base = { cpf_associado: "52998224725", telefone_celular: "(87) 999999999" };
  const rodar = async (boletos) => {
    const fetchImpl = async (url) => (url.endsWith("/listar/boleto-associado-veiculo")
      ? { status: 200, text: async () => JSON.stringify(boletos) }
      : { status: 404, text: async () => "{}" });
    return criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  };
  // Sem situação: na dúvida, não envia
  assert.equal((await rodar([{ ...base, data_vencimento: "2026-10-05", linha_digitavel: LINHA }])).resultado, "sem_boleto_aberto");
  // Pago (data_pagamento preenchida), mesmo com situação "ABERTO"
  assert.equal((await rodar([{ ...base, descricao_situacao_boleto: "ABERTO", data_pagamento: "2026-10-04", data_vencimento: "2026-10-05", linha_digitavel: LINHA }])).resultado, "sem_boleto_aberto");
  // Outubro está "aberto" mas sem linha nem PIX: usa novembro
  const r = await rodar([
    { ...base, descricao_situacao_boleto: "ABERTO", data_pagamento: null, data_vencimento: "2026-10-05" },
    { ...base, descricao_situacao_boleto: "ABERTO", data_pagamento: null, data_vencimento: "2026-11-05", linha_digitavel: LINHA, pix: { copia_cola: PIX } }
  ]);
  assert.equal(r.resultado, "ok");
  assert.equal(r.boleto.vencimento, "05/11/2026");
  assert.equal(r.boleto.pix, PIX);
});

test("resposta real do servidor (situacao_boleto, cpf, celular): escolhe o boleto aberto de novembro", async () => {
  const comum = { codigo_associado: 12195, nome_associado: "ASSOCIADO TESTE", cpf: "529.982.247-25", telefone_fixo: "", celular: "(87) 999999999",
    telefone_comercial: "", codigo_situacao_boleto: "", veiculos: [{ placa: "PGN3D63" }] };
  const boletos = [
    { ...comum, nosso_numero: 380000, data_vencimento: "2026-10-05", data_pagamento: "2026-10-04", situacao_boleto: "BAIXADO", linha_digitavel: LINHA3, link_boleto: "https://short.hinova.com.br/v2/a.pdf", pix: { qrcode: null, copia_cola: null } },
    { ...comum, nosso_numero: 380978, data_vencimento: "2026-11-05", data_pagamento: "", situacao_boleto: "ABERTO", linha_digitavel: LINHA, link_boleto: "https://short.hinova.com.br/v2/b.pdf", pix: { qrcode: "iVBOR", copia_cola: PIX } }
  ];
  const fetchImpl = async (url) => (url.endsWith("/listar/boleto-associado-veiculo")
    ? { status: 200, text: async () => JSON.stringify(boletos) }
    : { status: 404, text: async () => "{}" });
  const r = await criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl }).consultar({ placa: "PGN3D63", cpf: "52998224725" });
  assert.equal(r.resultado, "ok");
  assert.equal(r.telefone, "5587999999999");
  assert.equal(r.boleto.vencimento, "05/11/2026");
  assert.equal(r.boleto.pix, PIX);
  assert.deepEqual(r.boleto.alertas, []);
});

test("telefone do veículo em campos separados (ddd_celular + telefone_celular)", async () => {
  const h = criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl: async () => ({ status: 404, text: async () => "{}" }) });
  assert.equal(h.titularDe({ cpf: "52998224725", ddd_celular: "87", telefone_celular: "999999999" }).telefone, "5587999999999");
  assert.equal(h.titularDe({ cpf: "52998224725", ddd_celular: null, telefone_celular: "999999999" }).telefone, "", "sem DDD não dá para enviar");
});

test("valor do boleto: \"55.00\" da Hinova vira R$ 55,00; inválido é omitido", async () => {
  const { formatarValor } = await import("../lib/formatar.js");
  assert.equal(formatarValor("55.00"), "R$ 55,00");
  assert.equal(formatarValor("1234.50"), "R$ 1.234,50");
  assert.equal(formatarValor("55,00"), "R$ 55,00");
  assert.equal(formatarValor("1.234,56"), "R$ 1.234,56");
  assert.equal(formatarValor(55), "R$ 55,00");
  for (const v of ["0.00", "-5", "abc", { valor: 55 }, null, "", "55.000", "1234.5", "55,0"]) assert.equal(formatarValor(v), null, JSON.stringify(v));
  const texto = montarMensagem({ vencimento: "2026-11-05", valor: "55.00", linhaDigitavel: LINHA }, "Integra");
  assert.match(texto, /💰 \*Valor:\* R\$ 55,00/);
  assert.ok(!montarMensagem({ vencimento: "2026-11-05", valor: { x: 1 }, linhaDigitavel: LINHA }, "Integra").includes("Valor"), "valor inválido não entra");
});

// ---- Conformidade com docs/api/hinova-sga-api-v2.md ----

test("doc §3: 406 só é 'não encontrado' se a mensagem disser; outro 406 é erro", async () => {
  const resp406 = (corpo) => async () => ({ status: 406, text: async () => JSON.stringify(corpo) });
  const naoAchou = criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl: resp406({ mensagem: "Nenhum boleto encontrado", error: [] }) });
  assert.equal((await naoAchou.consultar({ placa: "PGN3D63", cpf: "52998224725" })).resultado, "sem_boleto_no_periodo");
  const erro = criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl: resp406({ mensagem: "Erro", error: ["Intervalo de datas inválido"] }) });
  await assert.rejects(erro.consultar({ placa: "PGN3D63", cpf: "52998224725" }), (e) => {
    assert.match(e.message, /406/);
    assert.deepEqual(e.diagnostico.mensagens, ["mensagem: Erro", "error[0]: Intervalo de datas inválido"]);
    return true;
  });
});

test("doc §6: GET de leitura tenta de novo em 5xx; POST nunca é repetido", async () => {
  let gets = 0, posts = 0;
  const fetchImpl = async (url, opt) => {
    if (opt.method === "POST") { posts++; return { status: 503, text: async () => "{}" }; }
    gets++;
    return gets < 3 ? { status: 502, text: async () => "{}" } : { status: 200, text: async () => JSON.stringify({ placa: "PGN3D63" }) };
  };
  const h = criarHinova(lerConfig({ HINOVA_TOKEN: "t" }).hinova, { fetchImpl });
  assert.equal((await h.buscarVeiculo("PGN3D63")).placa, "PGN3D63");
  assert.equal(gets, 3);
  await assert.rejects(h.listarBoletos({ placa: "PGN3D63" }), /503/);
  assert.equal(posts, 1, "POST não pode ser repetido automaticamente");
});

test("doc §3: período de boletos limitado a 90 dias", async () => {
  const { conferirConfig } = await import("../lib/config.js");
  const base = { TURNSTILE_SECRET: "s", ALLOWED_ORIGINS: "https://a", MODO: "simulado" };
  assert.deepEqual(conferirConfig(lerConfig(base)), []);
  assert.ok(conferirConfig(lerConfig({ ...base, HINOVA_BOLETO_DIAS_ANTES: "80", HINOVA_BOLETO_DIAS_DEPOIS: "30" })).some((f) => /90 dias/.test(f)));
});

test("doc §1: detalhe do boleto é GET /buscar/boleto/:nosso_numero", () => {
  const c = lerConfig({}).hinova;
  assert.equal(c.pathBoletoDetalhe, "/buscar/boleto/{nosso_numero}");
  assert.deepEqual(c.campos.codigoBoleto, ["nosso_numero"]);
});

test("doc §0: aceita HINOVA_TOKEN_SGA e HINOVA_TOKEN_USUARIO (e o legado HINOVA_TOKEN)", () => {
  const usuarioPronto = lerConfig({ HINOVA_TOKEN_USUARIO: "hash-usuario" }).hinova;
  assert.equal(usuarioPronto.token, "hash-usuario");
  assert.equal(usuarioPronto.modoAuth, "token");
  const sga = lerConfig({ HINOVA_TOKEN_SGA: "token-sga", HINOVA_USUARIO: "u", HINOVA_SENHA: "s" }).hinova;
  assert.equal(sga.token, "token-sga");
  assert.equal(sga.modoAuth, "usuario");
  assert.equal(lerConfig({ HINOVA_TOKEN: "legado" }).hinova.token, "legado");
});
