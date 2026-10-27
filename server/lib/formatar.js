/*
 * Conversão e validação dos dados do boleto antes de irem para a mensagem.
 * Regra: nada entra na mensagem sem virar texto e passar pela validação do seu tipo.
 * Assim, um objeto nunca aparece como "[object Object]" e um valor estranho é omitido.
 */

// Só texto ou número viram texto; objeto, lista, null etc. → null
export function comoTexto(v) {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

// Vencimento sempre em DD/MM/AAAA ("2026-11-05", "2026-11-05 00:00:00", "2026-11-05T03:00:00Z", "05/11/2026")
export function formatarData(v) {
  const s = comoTexto(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return null;
}

// Valor em reais: "55.00" (como vem da Hinova), "55,00", "1.234,56", "55" ou 55 → "R$ 55,00".
// Só formatos sem ambiguidade ("55.000" pode ser 55 ou 55 mil: recusado) e maiores que zero;
// qualquer outra coisa → null (a linha do valor é omitida).
export function formatarValor(v) {
  let n = null;
  if (typeof v === "number" && Number.isFinite(v)) n = v;
  const s = comoTexto(v);
  if (n === null && s) {
    if (/^\d+(\.\d{2})?$/.test(s)) n = Number(s);                                       // 55.00 ou 55
    else if (/^(\d{1,3}(\.\d{3})+|\d+),\d{2}$/.test(s)) n = Number(s.replace(/\./g, "").replace(",", ".")); // 1.234,56 ou 55,00
  }
  if (n === null || !(n > 0) || n > 1e7) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n).replace(/\u00a0/g, " ");
}

// Linha digitável: boleto bancário (47 dígitos) ou de arrecadação (48)
export function linhaDigitavel(v) {
  const s = comoTexto(v);
  if (!s) return null;
  const n = s.replace(/\D/g, "").length;
  return (n === 47 || n === 48) && /^[\d.\s-]+$/.test(s) ? s.replace(/\s+/g, " ") : null;
}

// Link do boleto: só https
export function linkSeguro(v) {
  const s = comoTexto(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/* ---------- PIX copia e cola (padrão EMV do Banco Central) ---------- */

// CRC16-CCITT (poli 0x1021, inicial 0xFFFF), usado no campo 63 do PIX
export function crc16(texto) {
  let crc = 0xffff;
  for (const ch of Buffer.from(texto, "utf8")) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// É um PIX copia e cola válido? Começa com 000201, tem o domínio do PIX e o CRC confere
export function pixValido(v) {
  // Só tira quebras de linha e as pontas: espaços internos (ex.: nome do recebedor) fazem parte do CRC
  const s = comoTexto(v)?.replace(/[\r\n\t]/g, "");
  if (!s || s.length < 50 || s.length > 600) return null;
  if (!s.startsWith("000201") || !/br\.gov\.bcb\.pix/i.test(s)) return null;
  const m = s.match(/^(.*6304)([0-9A-Fa-f]{4})$/);
  if (!m || crc16(m[1]) !== m[2].toUpperCase()) return null;
  return s;
}

// PIX copia e cola lido SOMENTE do(s) campo(s) configurado(s) (padrão "pix.copia_cola").
// Devolve { pix, campo, presente }: presente=true e pix=null quando o campo existe mas não é
// um código válido (aí a mensagem sai sem PIX e o servidor registra um alerta).
export function pixDoCampo(obj, campos = []) {
  for (const c of campos) {
    const v = c.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== "") return { pix: pixValido(v), campo: c, presente: true };
  }
  return { pix: null, campo: null, presente: false };
}
