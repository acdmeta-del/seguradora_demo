/*
 * Validação por LISTA DE PERMISSÃO: só passa o que tem formato exato de placa e CPF.
 * Qualquer outra coisa (aspas, "--", "OR 1=1", unicode, campos extras) é recusada
 * antes de qualquer chamada à Hinova. É a primeira barreira contra SQL injection.
 */

// Placa antiga (ABC1234) ou Mercosul (ABC1D23)
export const PLACA_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

const CAMPOS_PERMITIDOS = new Set(["placa", "cpf", "token"]);

export function normalizarPlaca(valor) {
  if (typeof valor !== "string" || valor.length > 10) return null;
  // Aceita no máximo um separador (hífen ou espaço) entre letras e números: ABC-1D23
  const m = valor.trim().toUpperCase().match(/^([A-Z]{3})[-\s]?([0-9][A-Z0-9][0-9]{2})$/);
  const placa = m ? m[1] + m[2] : "";
  return PLACA_RE.test(placa) ? placa : null;
}

export function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function normalizarCpf(valor) {
  // Só dígitos, ponto e hífen (formato 000.000.000-00 ou só os 11 dígitos)
  if (typeof valor !== "string" || valor.length > 14 || !/^[\d.-]+$/.test(valor)) return null;
  const d = valor.replace(/\D/g, "");
  return cpfValido(d) ? d : null;
}

export function validarPedido(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { erro: "corpo" };
  if (Object.keys(body).some((k) => !CAMPOS_PERMITIDOS.has(k))) return { erro: "campos" };

  const placa = normalizarPlaca(body.placa);
  const cpf = normalizarCpf(body.cpf);
  const token = typeof body.token === "string" && body.token.length > 0 && body.token.length <= 2048 ? body.token : null;

  if (!placa) return { erro: "placa" };
  if (!cpf) return { erro: "cpf" };
  if (!token) return { erro: "token" };
  return { placa, cpf, token };
}

/* Máscaras para registros (logs): nunca gravar CPF ou telefone completos */
export const mascararCpf = (cpf) => `***.***.*${String(cpf).slice(7, 9)}-${String(cpf).slice(9, 11)}`;
export const mascararTelefone = (tel) => `(**) *****-${String(tel).replace(/\D/g, "").slice(-4)}`;
export const mascararPlaca = (placa) => `${String(placa).slice(0, 3)}****`;
