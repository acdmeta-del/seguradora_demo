/*
 * Envio da 2ª via pelo WhatsApp CADASTRADO na Hinova (nunca um número digitado no site).
 * Provedor escolhido por WHATSAPP_PROVIDER:
 *   log       → não envia; só registra (padrão, para testes)
 *   evolution → Evolution API v2 (POST /message/sendText/{instancia}, cabeçalho apikey)
 *   zapi      → Z-API, usada pelo cliente (POST /instances/{id}/token/{token}/send-text,
 *               cabeçalho Client-Token = token de segurança da conta)
 */
import { mascararTelefone } from "./validar.js";

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

export function montarMensagem(boleto, nomeEmpresa) {
  const linhas = [`Olá! Aqui é a ${nomeEmpresa}. Segue a 2ª via do seu boleto:`];
  if (boleto.vencimento) linhas.push(`Vencimento: ${boleto.vencimento}`);
  if (boleto.linhaDigitavel) linhas.push(`Linha digitável: ${boleto.linhaDigitavel}`);
  if (boleto.pix) linhas.push(`PIX copia e cola: ${boleto.pix}`);
  if (boleto.link) linhas.push(`Boleto: ${boleto.link}`);
  linhas.push("Se você não pediu esta mensagem, pode ignorá-la.");
  return linhas.join("\n");
}

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
