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
    { fetchImpl: async (url, opt) => { pedidos.push({ url, opt }); return { ok: true }; } }
  );
  await wa.enviar("11987654321", montarMensagem({ vencimento: "10/10/2026", linhaDigitavel: "123" }, "Integra"));
  assert.equal(pedidos[0].url, "https://evo.exemplo/message/sendText/integra");
  assert.equal(pedidos[0].opt.headers.apikey, "chave");
  const corpo = JSON.parse(pedidos[0].opt.body);
  assert.equal(corpo.number, "5511987654321");
  assert.match(corpo.text, /Linha digitável: 123/);
});
