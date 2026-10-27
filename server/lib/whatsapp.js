/*
 * Envio da 2ª via pelo WhatsApp CADASTRADO na Hinova (nunca um número digitado no site).
 * Provedor escolhido por WHATSAPP_PROVIDER:
 *   log       → não envia; só registra (padrão, para testes)
 *   evolution → Evolution API v2 (POST /message/sendText/{instancia}, cabeçalho apikey)
 *   zapi      → Z-API, usada pelo cliente (POST /instances/{id}/token/{token}/send-text,
 *               cabeçalho Client-Token = token de segurança da conta)
 */
import { mascararTelefone } from "./validar.js";
import { comoTexto, formatarData, formatarValor, linhaDigitavel, linkSeguro, pixValido } from "./formatar.js";

// Celular brasileiro → formato internacional só com dígitos (55 + DDD + número)
export function normalizarTelefone(tel) {
  const d = String(tel || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

// Primeiro celular válido de um campo que pode trazer máscara, zero do DDD ou vários números
// ("(87) 999999999", "(087) 99999-9999", "(87) 99999-9999 / (87) 3333-4444") → "5587999999999"
export function extrairTelefone(valor) {
  const partes = String(valor || "").split(/[\/,;|]|\s+e\s+|\s+ou\s+/i);
  for (const parte of partes) {
    const n = normalizarTelefone(parte);
    if (n) return n;
  }
  return normalizarTelefone(valor);
}

// Mesmo número? Compara já normalizados e tolera a falta do 9º dígito de um dos lados
export function mesmoTelefone(a, b) {
  const x = normalizarTelefone(a);
  const y = normalizarTelefone(b);
  if (!x || !y) return false;
  const semNono = (n) => (n.length === 13 && n[4] === "9" ? n.slice(0, 4) + n.slice(5) : n);
  return x === y || semNono(x) === semNono(y);
}

// Mensagens da 2ª via. Cada dado só entra se passar na validação do seu tipo (formatar.js);
// valida de novo aqui para que nenhum chamador consiga colocar um objeto ou lixo na mensagem.
// O PIX vai SOZINHO numa segunda mensagem: no WhatsApp, basta tocar e segurar sobre ela e
// escolher "Copiar" para levar só o código. Formatação do WhatsApp: *negrito*, ```monoespaçado```.
export function montarMensagens(boleto, nomeEmpresa) {
  const vencimento = formatarData(boleto.vencimento);
  const valor = formatarValor(boleto.valor);
  const linha = linhaDigitavel(boleto.linhaDigitavel);
  const pix = pixValido(boleto.pix);
  const link = linkSeguro(boleto.link);
  const empresa = comoTexto(nomeEmpresa) || "associação";

  const partes = [`Olá! Aqui é a *${empresa}*.\nSegue a 2ª via do seu boleto.`];
  if (vencimento) partes.push(`📅 *Vencimento:* ${vencimento}`);
  if (valor) partes.push(`💰 *Valor:* ${valor}`);
  if (pix) partes.push("💠 *Pague com PIX:* o código *copia e cola* está na próxima mensagem. Toque e segure sobre ela e escolha *Copiar*.");
  if (linha) partes.push(`🧾 *Linha digitável:*\n\`\`\`${linha}\`\`\``);
  if (link) partes.push(`📄 *Boleto em PDF:*\n${link}`);
  partes.push("_Se você não pediu esta mensagem, pode ignorá-la._");

  const mensagens = [partes.join("\n\n")];
  if (pix) mensagens.push(pix); // só o código, sem nenhum texto junto
  return mensagens;
}

// Versão em texto único (diagnóstico e testes)
export const montarMensagem = (boleto, nomeEmpresa) => montarMensagens(boleto, nomeEmpresa).join("\n\n");

export function criarWhatsapp(cfg, { fetchImpl = fetch, log = console } = {}) {
  async function postar(url, headers, body) {
    const r = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs)
    });
    if (!r.ok) throw new Error(`WhatsApp: erro HTTP ${r.status}`);
    // Alguns provedores respondem 200 com { error: ... } no corpo
    const dados = await r.json().catch(() => ({}));
    if (dados && (dados.error || dados.erro)) throw new Error("WhatsApp: o provedor recusou o envio");
    return dados;
  }

  async function enviar(telefone, texto) {
    const numero = normalizarTelefone(telefone);
    if (!numero) throw new Error("WhatsApp: telefone cadastrado inválido");

    switch (cfg.provedor) {
      case "evolution": {
        const { url, instancia, apikey } = cfg.evolution;
        return postar(`${url}/message/sendText/${encodeURIComponent(instancia)}`, { apikey }, { number: numero, text: texto });
      }
      case "zapi": {
        const { instancia, token, clientToken } = cfg.zapi;
        return postar(
          `https://api.z-api.io/instances/${encodeURIComponent(instancia)}/token/${encodeURIComponent(token)}/send-text`,
          { "Client-Token": clientToken },
          { phone: numero, message: texto }
        );
      }
      default:
        log.info(`[whatsapp:log] enviaria a 2ª via para ${mascararTelefone(numero)}`);
    }
  }

  return { enviar };
}
