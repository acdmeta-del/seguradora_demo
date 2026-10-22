/*
 * Verificação de "usuário humano" com Cloudflare Turnstile, feita NO SERVIDOR.
 * O token gerado no navegador é de uso único e só vale com o segredo, que fica aqui.
 */
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verificarTurnstile({ token, ip, segredo, hostnames = [], acao, fetchImpl = fetch }) {
  if (!segredo || !token) return false;
  const body = new URLSearchParams({ secret: segredo, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const r = await fetchImpl(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (!d.success) return false;
    if (acao && d.action && d.action !== acao) return false;
    if (hostnames.length && !hostnames.includes(d.hostname)) return false;
    return true;
  } catch {
    return false; // na dúvida, recusa
  }
}
