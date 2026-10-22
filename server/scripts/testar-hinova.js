/*
 * Diagnóstico da integração com o SGA Hinova. Rode NA VPS (console do App no Easypanel):
 *   npm run testar-hinova -- ABC1D23 52998224725
 *
 * Mostra cada etapa e a ESTRUTURA das respostas (nomes dos campos e tipos), sem
 * imprimir valores pessoais, para conferir caminhos e campos (HINOVA_PATH_* e
 * HINOVA_CAMPO_*). Não envia nada pelo WhatsApp.
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

// Lista os campos de um objeto (até 2 níveis) com o tipo, sem os valores
function estrutura(obj, prefixo = "", nivel = 0) {
  if (obj == null || typeof obj !== "object" || nivel > 1) return [];
  return Object.entries(obj).flatMap(([k, v]) => {
    const nome = prefixo + k;
    const tipo = Array.isArray(v) ? `lista[${v.length}]` : v === null ? "null" : typeof v;
    return [`  ${nome}: ${tipo}`, ...(v && typeof v === "object" && !Array.isArray(v) ? estrutura(v, nome + ".", nivel + 1) : [])];
  });
}

const etapa = (n, t) => console.log(`\n[${n}] ${t}`);

try {
  etapa(1, `Autenticando em ${cfg.baseUrl}${cfg.pathAutenticar}`);
  await h.autenticar();
  console.log("  OK: token de usuário obtido");

  const caminhoVeiculo = h._preencher(cfg.pathVeiculo, { placa });
  etapa(2, `Buscando veículo: ${cfg.pathVeiculo}`);
  const rv = await h._get(caminhoVeiculo);
  if (rv.status === 404 || !rv.dados) { console.log("  Veículo não encontrado (404). Confira HINOVA_PATH_VEICULO e a placa."); process.exit(2); }
  const veiculo = comoLista(rv.dados)[0];
  console.log("  Campos da resposta do veículo:");
  console.log(estrutura(veiculo).join("\n"));

  const cpfTitular = String(pegar(veiculo, cfg.campos.cpf) || "").replace(/\D/g, "");
  const tel = String(pegar(veiculo, cfg.campos.telefone) || "").replace(/\D/g, "");
  console.log(`  CPF do titular (${cfg.campos.cpf.join(" | ")}): ${cpfTitular ? mascararCpf(cpfTitular) : "NÃO ENCONTRADO"}`);
  console.log(`  Confere com o informado: ${cpfTitular === cpf ? "sim" : "não"}`);
  console.log(`  Telefone (${cfg.campos.telefone.join(" | ")}): ${tel ? mascararTelefone(tel) : "NÃO ENCONTRADO"}`);
  console.log(`  Código do veículo (${cfg.campos.codigoVeiculo.join(" | ")}): ${pegar(veiculo, cfg.campos.codigoVeiculo) ?? "NÃO ENCONTRADO"}`);

  etapa(3, `Fluxo completo (consultar): ${cfg.pathBoletos}`);
  const r = await h.consultar({ placa, cpf });
  console.log(`  Resultado: ${r.resultado}`);
  if (r.boleto) {
    console.log(`  Vencimento: ${r.boleto.vencimento ?? "-"}`);
    console.log(`  Linha digitável: ${r.boleto.linhaDigitavel ? "presente" : "ausente"} | Link: ${r.boleto.link ? "presente" : "ausente"} | PIX: ${r.boleto.pix ? "presente" : "ausente"}`);
  }
  console.log("\nSe algum campo saiu como NÃO ENCONTRADO, ajuste as variáveis HINOVA_CAMPO_* com os nomes listados acima.");
} catch (e) {
  console.error(`\nFalhou: ${e.message}`);
  console.error("Confira HINOVA_TOKEN, HINOVA_USUARIO, HINOVA_SENHA, os caminhos HINOVA_PATH_* e se o IP da VPS está liberado na Hinova.");
  process.exit(1);
}
