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

// Procura o PIX copia e cola: primeiro nos campos configurados, depois em qualquer
// texto da resposta (até 4 níveis), aceitando só o que passa em pixValido.
// Imagens de QR Code (base64), links e outros textos são ignorados.
export function acharPix(obj, camposPreferidos = []) {
  const visitar = (v, nivel) => {
    if (nivel > 4 || v == null) return null;
    const direto = pixValido(v);
    if (direto) return direto;
    if (typeof v === "object") {
      for (const x of Array.isArray(v) ? v : Object.values(v)) {
        const achado = visitar(x, nivel + 1);
        if (achado) return achado;
      }
    }
    return null;
  };
  for (const c of camposPreferidos) {
    const v = c.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    const achado = visitar(v, 0);
    if (achado) return achado;
  }
  return visitar(obj, 0);
}
