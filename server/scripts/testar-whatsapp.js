/*
 * Teste de envio pelo WhatsApp configurado (Z-API). Rode NA VPS (console do App no Easypanel):
 *   npm run testar-whatsapp -- 11987654321
 * Envia uma mensagem de teste para o número informado (use o seu).
 */
import { lerConfig } from "../lib/config.js";
import { criarWhatsapp, normalizarTelefone } from "../lib/whatsapp.js";
import { mascararTelefone } from "../lib/validar.js";

const numero = normalizarTelefone(process.argv[2] || "");
if (!numero) {
  console.error("Uso: npm run testar-whatsapp -- DDD+NÚMERO   (ex.: 11987654321)");
  process.exit(1);
}

const cfg = lerConfig().whatsapp;
console.log(`Provedor: ${cfg.provedor}. Enviando teste para ${mascararTelefone(numero)}...`);
try {
  const resposta = await criarWhatsapp(cfg).enviar(numero, `Teste de envio da ${cfg.nomeEmpresa}: a integração do WhatsApp está funcionando.`);
  console.log(cfg.provedor === "log" ? "Modo log: nada foi enviado (defina WHATSAPP_PROVIDER=zapi)." : "OK: o provedor aceitou a mensagem.");
  if (resposta && typeof resposta === "object") console.log(`Campos da resposta: ${Object.keys(resposta).join(", ") || "(vazia)"}`);
} catch (e) {
  console.error(`Falhou: ${e.message}`);
  console.error("Confira ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN e se a instância está conectada ao celular no painel da Z-API.");
  process.exit(1);
}
