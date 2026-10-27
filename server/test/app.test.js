import { test } from "node:test";
import assert from "node:assert/strict";
import { lerConfig } from "../lib/config.js";
import { criarApp, MENSAGEM_PADRAO } from "../app.js";

const ORIGEM = "https://acdmeta-del.github.io";
const CPF_TITULAR = "52998224725";
const TELEFONE = "11987654321";
const silencioso = { info() {}, error() {} };

// Sobe o app numa porta livre com Hinova, Turnstile e WhatsApp simulados
async function subir(env = {}, { humano = true } = {}) {
  const cfg = lerConfig({
    MODO: "producao",
    ALLOWED_ORIGINS: ORIGEM,
    TURNSTILE_SECRET: "segredo-de-teste",
    RESPOSTA_MIN_MS: "60",
    ...env
  });
  const chamadas = { hinova: 0, enviados: [] };
  const hinova = {
    async consultar({ placa, cpf }) {
      chamadas.hinova++;
      if (placa === null && cpf === CPF_TITULAR) {
        // Só CPF: dois veículos, um boleto em aberto para cada
        const linha = "34191.79001 01043.510047 91020.150008 1 99990000010000";
        const boletos = [
          { vencimento: "05/10/2026", linhaDigitavel: linha, pix: env.PIX_HINOVA, veiculos: ["CG 150 FAN · placa final 3D63"] },
          { vencimento: "05/11/2026", linhaDigitavel: linha, pix: env.PIX_HINOVA, veiculos: ["ONIX · placa final 4R56"] }
        ];
        return { resultado: "ok", telefone: TELEFONE, boleto: boletos[0], boletos };
      }
      if (placa !== "ABC1D23") return { resultado: "veiculo_nao_encontrado" };
      if (cpf !== CPF_TITULAR) return { resultado: "cpf_nao_confere" };
      return { resultado: "ok", telefone: env.TELEFONE_HINOVA || TELEFONE, boleto: { vencimento: "10/11/2026", linhaDigitavel: "34191.79001 01043.510047 91020.150008 1 99990000010000", link: "https://exemplo/boleto", pix: env.PIX_HINOVA } };
    }
  };
  const whatsapp = { async enviar(tel, texto) { chamadas.enviados.push({ tel, texto }); } };
  const app = criarApp(cfg, { hinova, whatsapp, turnstile: async () => humano, log: silencioso });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/boleto`;

  const post = async (body, { origem = ORIGEM, cru = false } = {}) => {
    const t0 = Date.now();
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(origem ? { Origin: origem } : {}) },
      body: cru ? body : JSON.stringify(body)
    });
    const texto = await r.text();
    return { status: r.status, texto, json: (() => { try { return JSON.parse(texto); } catch { return null; } })(), headers: r.headers, ms: Date.now() - t0 };
  };
  const preflight = (origem) => fetch(url, {
    method: "OPTIONS",
    headers: { Origin: origem, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" }
  });
  const fim = () => new Promise((r) => server.close(r));
  return { post, preflight, chamadas, app, fim };
}

const valido = { placa: "ABC-1D23", cpf: "529.982.247-25", token: "tok" };

test("pedido válido: envia ao WhatsApp cadastrado e responde só a mensagem genérica", async (t) => {
  const s = await subir(); t.after(s.fim);
  const r = await s.post(valido);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, mensagem: MENSAGEM_PADRAO });
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGEM);
  assert.equal(await s.app.locals.ultimoProcesso, "enviado");
  assert.equal(s.chamadas.enviados.length, 1);
  assert.equal(s.chamadas.enviados[0].tel, TELEFONE);
  // Nada sensível na resposta
  for (const proibido of [TELEFONE, "4321", "34191", "boleto\"", CPF_TITULAR]) assert.ok(!r.texto.includes(proibido), proibido);
});

test("CPF que não é do titular: mesma resposta, nada enviado", async (t) => {
  const s = await subir(); t.after(s.fim);
  const ok = await s.post(valido);
  await s.app.locals.ultimoProcesso;
  const outro = await s.post({ ...valido, cpf: "111.444.777-35" });
  assert.equal(outro.status, 200);
  assert.equal(outro.texto, ok.texto);
  assert.equal(await s.app.locals.ultimoProcesso, "cpf_nao_confere");
  assert.equal(s.chamadas.enviados.length, 1);
});

test("injeção SQL e dados inválidos: 400 antes de chamar a Hinova", async (t) => {
  const s = await subir({ LIMITE_POR_IP: "50" }); t.after(s.fim);
  const casos = [
    { ...valido, placa: "ABC1D23' OR '1'='1" },
    { ...valido, placa: "ABC1D23; DROP TABLE associado;--" },
    { ...valido, cpf: "529.982.247-24" },
    { ...valido, cpf: "00000000000" },
    { ...valido, cpf: "52998224725' OR 1=1 --" },
    { ...valido, extra: "x" },
    { ...valido, placa: { $ne: null } }
  ];
  for (const c of casos) {
    const r = await s.post(c);
    assert.equal(r.status, 400, JSON.stringify(c));
  }
  const malformado = await s.post("{placa:", { cru: true });
  assert.equal(malformado.status, 400);
  assert.equal(s.chamadas.hinova, 0);
});

test("corpo acima de 2 KB: 413", async (t) => {
  const s = await subir(); t.after(s.fim);
  const r = await s.post({ ...valido, token: "x".repeat(3000) });
  assert.equal(r.status, 413);
});

test("Turnstile inválido: 403 e nenhuma consulta", async (t) => {
  const s = await subir({}, { humano: false }); t.after(s.fim);
  const r = await s.post(valido);
  assert.equal(r.status, 403);
  assert.equal(r.json.erro, "verificacao_humana");
  assert.equal(s.chamadas.hinova, 0);
});

test("origem não permitida: 403 e sem cabeçalho CORS", async (t) => {
  const s = await subir(); t.after(s.fim);
  const r = await s.post(valido, { origem: "https://site-malicioso.com" });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  const semOrigem = await s.post(valido, { origem: null });
  assert.equal(semOrigem.status, 403);
  assert.equal(s.chamadas.hinova, 0);
});

test("limite por IP: a 6ª consulta em 15 min recebe 429", async (t) => {
  const s = await subir({ RESPOSTA_MIN_MS: "0" }); t.after(s.fim);
  const status = [];
  for (let i = 0; i < 6; i++) status.push((await s.post({ ...valido, placa: "XYZ9A99" })).status);
  assert.deepEqual(status, [200, 200, 200, 200, 200, 429]);
});

test("limite por CPF: no máximo N envios por dia, resposta igual", async (t) => {
  const s = await subir({ LIMITE_CPF_DIA: "1", RESPOSTA_MIN_MS: "0" }); t.after(s.fim);
  const a = await s.post(valido); await s.app.locals.ultimoProcesso;
  const b = await s.post(valido);
  assert.equal(await s.app.locals.ultimoProcesso, "limite_cpf");
  assert.equal(a.texto, b.texto);
  assert.equal(s.chamadas.enviados.length, 1);
});

test("homologação: só envia para números da lista de teste", async (t) => {
  const fora = await subir({ MODO: "homologacao", WHATSAPP_TESTE_PERMITIDOS: "11900000000" }); t.after(fora.fim);
  await fora.post(valido);
  assert.equal(await fora.app.locals.ultimoProcesso, "bloqueado_homologacao");
  assert.equal(fora.chamadas.enviados.length, 0);

  const dentro = await subir({ MODO: "homologacao", WHATSAPP_TESTE_PERMITIDOS: `(11) 98765-4321` }); t.after(dentro.fim);
  await dentro.post(valido);
  assert.equal(await dentro.app.locals.ultimoProcesso, "enviado");

  // Número da Hinova com máscara e lista com só dígitos (o caso real): precisa bater
  const formatos = await subir({ MODO: "homologacao", WHATSAPP_TESTE_PERMITIDOS: "11987654321", TELEFONE_HINOVA: "(011) 98765-4321" }); t.after(formatos.fim);
  await formatos.post(valido);
  assert.equal(await formatos.app.locals.ultimoProcesso, "enviado");
});

test("tempo mínimo de resposta igual para associado e não associado", async (t) => {
  const s = await subir({ RESPOSTA_MIN_MS: "200" }); t.after(s.fim);
  const a = await s.post(valido);
  const b = await s.post({ ...valido, placa: "QQQ0Q00" });
  assert.ok(a.ms >= 195 && b.ms >= 195, `${a.ms} / ${b.ms}`);
});

test("cabeçalhos de segurança do helmet presentes", async (t) => {
  const s = await subir(); t.after(s.fim);
  const r = await s.post(valido);
  assert.ok(r.headers.get("content-security-policy"));
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-powered-by"), null);
});

test("ALLOWED_ORIGINS com barra final, caminho ou espaço ainda libera a origem", async (t) => {
  const s = await subir({ ALLOWED_ORIGINS: " https://acdmeta-del.github.io/seguradora_demo/ " }); t.after(s.fim);
  const r = await s.post(valido);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGEM);
});

test("preflight (OPTIONS) da origem permitida devolve os cabeçalhos CORS", async (t) => {
  const s = await subir(); t.after(s.fim);
  const r = await s.preflight(ORIGEM);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGEM);
  assert.match(r.headers.get("access-control-allow-methods"), /POST/);
  const outra = await s.preflight("https://site-malicioso.com");
  assert.equal(outra.headers.get("access-control-allow-origin"), null);
});

test("com PIX: envia o resumo e depois o código PIX sozinho, nessa ordem", async (t) => {
  const PIX = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
  const s = await subir({ PIX_HINOVA: PIX, WHATSAPP_INTERVALO_MS: "10" }); t.after(s.fim);
  await s.post(valido);
  assert.equal(await s.app.locals.ultimoProcesso, "enviado");
  assert.equal(s.chamadas.enviados.length, 2);
  assert.match(s.chamadas.enviados[0].texto, /próxima mensagem/);
  assert.equal(s.chamadas.enviados[1].texto, PIX);
});

test("só CPF (placa em branco): envia todos os boletos ao WhatsApp cadastrado, resposta igual", async (t) => {
  const PIX = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
  const s = await subir({ PIX_HINOVA: PIX, WHATSAPP_INTERVALO_MS: "5" }); t.after(s.fim);
  const comPlaca = await s.post(valido);
  await s.app.locals.ultimoProcesso;
  const semPlaca = await s.post({ placa: "", cpf: valido.cpf, token: "tok" });
  assert.equal(semPlaca.status, 200);
  assert.equal(semPlaca.texto, comPlaca.texto, "resposta genérica, sem nenhum dado");
  assert.equal(await s.app.locals.ultimoProcesso, "enviado");
  const msgs = s.chamadas.enviados.slice(2).map((e) => e.texto);
  assert.equal(msgs.length, 5);
  assert.match(msgs[0], /2 boletos em aberto/);
  assert.match(msgs[1], /Boleto 1 de 2[\s\S]*placa final 3D63/);
  assert.equal(msgs[2], PIX);
  assert.match(msgs[3], /Boleto 2 de 2[\s\S]*placa final 4R56/);
  assert.equal(msgs[4], PIX);
  assert.ok(s.chamadas.enviados.every((e) => e.tel === TELEFONE));

  const outro = await s.post({ cpf: "111.444.777-35", token: "tok" });
  assert.equal(outro.texto, comPlaca.texto);
  assert.equal(await s.app.locals.ultimoProcesso, "veiculo_nao_encontrado");
});
