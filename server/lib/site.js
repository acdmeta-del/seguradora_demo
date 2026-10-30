/*
 * Site e vistoria servidos pelo mesmo app da API (Easypanel): um domínio, um HTTPS.
 * Só entrega o que é do site, por LISTA DE PERMISSÃO (páginas e pastas abaixo). Nunca o
 * código do servidor, .env, docs ou testes, mesmo que estejam na mesma pasta (dev local).
 * As páginas têm CSP própria em <meta> (testada nos testes do navegador).
 */
import path from "node:path";
import express from "express";

// PERSONALIZAR: páginas e pastas públicas
export const PAGINAS = ["index.html", "vistoria-teste.html"];
export const PASTAS = ["css", "js", "content", "assets"];

// Cache: bibliotecas e modelo têm a versão no nome/pasta (podem ficar 1 ano no aparelho);
// imagens, 1 semana; páginas, scripts e textos sempre conferem se mudaram (ETag)
function cabecalhoCache(res, arquivo) {
  const p = arquivo.split(path.sep).join("/");
  if (p.includes("/js/vendor/") || p.includes("/assets/modelos/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  else if (p.includes("/assets/")) res.setHeader("Cache-Control", "public, max-age=604800");
  else res.setHeader("Cache-Control", "no-cache");
}

export function servirSite(app, raiz) {
  const base = path.resolve(raiz);
  const opcoes = { index: false, redirect: false, dotfiles: "ignore", setHeaders: cabecalhoCache };
  for (const pasta of PASTAS) app.use(`/${pasta}`, express.static(path.join(base, pasta), opcoes));
  const pagina = (nome) => (_req, res, next) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(base, nome), (e) => { if (e) next(); });
  };
  app.get("/", pagina("index.html"));
  for (const nome of PAGINAS) app.get(`/${nome}`, pagina(nome));
}
