/*
 * Diagnóstico da integração com o SGA Hinova. Rode NA VPS (console do App no Easypanel):
 *   npm run testar-hinova -- ABC1D23 52998224725
 *
 * Testa cada rota separadamente e mostra a ESTRUTURA das respostas (nomes dos
 * campos e tipos), sem imprimir valores pessoais nem o token, para conferir os
 * caminhos (HINOVA_PATH_*) e os campos (HINOVA_CAMPO_*). Não envia nada pelo WhatsApp.
 */
import { lerConfig } from "../lib/config.js";
import { criarHinova, comoLista, pegar } from "../lib/hinova.js";
import { normalizarPlaca, normalizarCpf, mascararCpf, mascararTelefone } from "../lib/validar.js";

const [placaArg, cpfArg] = process.argv.slice(2);
const placa = normalizarPlaca(placaArg || "");
const cpf = normalizarCpf(cpfArg || "");
if (!placa || !cpf) {
  console.error("Uso: npm run testar-hinova -- PLACA CPF   (ex.: ABC1D23 52998224725)");
  process.exit(1);
}

const cfg = lerConfig().hinova;
const h = criarHinova(cfg);
let falhas = 0;

// Campos de um objeto (até 2 níveis) com o tipo, sem os valores
function estrutura(obj, prefixo = "", nivel = 0) {
  if (obj == null || typeof obj !== "object" || nivel > 1) return [];
  return Object.entries(obj).flatMap(([k, v]) => {
    const nome = prefixo + k;
    const tipo = Array.isArray(v) ? `lista[${v.length}]` : v === null ? "null" : typeof v;
    return [`    ${nome}: ${tipo}`, ...(v && typeof v === "object" && !Array.isArray(v) ? estrutura(v, nome + ".", nivel + 1) : [])];
  });
}
const digitos = (v) => String(v || "").replace(/\D/g, "");
function titular(obj) {
  const c = digitos(pegar(obj, cfg.campos.cpf));
  const t = digitos(pegar(obj, cfg.campos.telefone));
  console.log(`  CPF do titular (${cfg.campos.cpf.join(" | ")}): ${c ? `${mascararCpf(c)} (confere: ${c === cpf ? "sim" : "não"})` : "NÃO ENCONTRADO"}`);
  console.log(`  Telefone (${cfg.campos.telefone.join(" | ")}): ${t ? mascararTelefone(t) : "NÃO ENCONTRADO"}`);
}
function falhou(e) {
  falhas++;
  console.log(`  FALHOU: ${e.message}`);
  if (e.diagnostico?.mensagens?.length) console.log(`  Mensagem da Hinova:\n    ${e.diagnostico.mensagens.join("\n    ")}`);
  else if (e.diagnostico?.campos?.length) console.log(`  Campos da resposta:\n    ${e.diagnostico.campos.join("\n    ")}`);
}
const etapa = (n, t) => console.log(`\n[${n}] ${t}`);

// 1. Autenticação
if (cfg.modoAuth === "token") {
  etapa(1, "Autenticação: token da associação direto no cabeçalho (HINOVA_AUTH=token)");
} else {
  etapa(1, `Autenticação com usuário/senha (HINOVA_AUTH=usuario): ${cfg.pathAutenticar}`);
  try { await h.autenticar(); console.log("  OK: token de usuário obtido"); } catch (e) { falhou(e); }
}

// 2. Veículo
if (cfg.pathVeiculo) {
  etapa(2, `Veículo: GET ${cfg.pathVeiculo}`);
  try {
    const r = await h._get(h._preencher(cfg.pathVeiculo, { placa }));
    if (!r.dados) console.log(`  Não encontrado (HTTP ${r.status}).`);
    else { const v = comoLista(r.dados)[0]; console.log("  Campos:"); console.log(estrutura(v).join("\n")); titular(v); }
  } catch (e) { falhou(e); }
} else {
  etapa(2, "Veículo: não consultado (HINOVA_PATH_VEICULO vazio; usa a lista de boletos)");
}

// 3. Lista de boletos (mesma chamada do n8n)
etapa(3, `Boletos: ${cfg.metodoBoletos} ${cfg.pathBoletos} (vencimento de -${cfg.boletoDiasAntes} a +${cfg.boletoDiasDepois} dias)`);
try {
  const lista = await h.listarBoletos({ placa, cpf });
  console.log(`  ${lista.length} boleto(s) no período.`);
  if (lista[0]) {
    console.log("  Campos do 1º boleto:"); console.log(estrutura(lista[0]).join("\n"));
    titular(lista[0]);
    console.log(`  Número do boleto (${cfg.campos.codigoBoleto.join(" | ")}): ${pegar(lista[0], cfg.campos.codigoBoleto) != null ? "presente" : "NÃO ENCONTRADO"}`);
    console.log(`  Situações encontradas: ${[...new Set(lista.map((b) => pegar(b, cfg.campos.situacao)).filter(Boolean))].join(", ") || "NÃO ENCONTRADO"}`);
  }
} catch (e) { falhou(e); }

// 4. Fluxo completo
etapa(4, "Fluxo completo (o que o site faz)");
try {
  const r = await h.consultar({ placa, cpf });
  console.log(`  Resultado: ${r.resultado}`);
  if (r.boleto) {
    console.log(`  Vencimento: ${r.boleto.vencimento ?? "-"}`);
    console.log(`  Linha digitável: ${r.boleto.linhaDigitavel ? "presente" : "ausente"} | Link: ${r.boleto.link ? "presente" : "ausente"} | PIX: ${r.boleto.pix ? "presente" : "ausente"}`);
  }
} catch (e) { falhou(e); }

console.log(falhas
  ? "\nAlgo falhou. Se for 401/\"Login ou senha inválido\", o token não foi aceito: confira HINOVA_TOKEN (sem espaços) e as rotas liberadas em Gerenciar APIs."
  : "\nSe algum campo saiu como NÃO ENCONTRADO, ajuste HINOVA_CAMPO_* com os nomes listados acima.");
process.exit(falhas ? 1 : 0);
