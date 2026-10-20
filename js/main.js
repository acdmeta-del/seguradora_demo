/*
 * Integra Proteção Veicular: script principal.
 * 1) Preenche a página com os textos de content/content.js
 * 2) Menu, formulário de cotação (abre o WhatsApp) e diálogo de privacidade
 * 3) Entrada do carro no banner ao carregar a página (GSAP)
 * PERSONALIZAR: textos e contatos ficam em content/content.js, não aqui.
 */
(function () {
  "use strict";

  const C = window.SITE_CONTENT;
  if (!C) return;

  /* ---------- Utilidades ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), C);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const digits = (s) => String(s).replace(/\D/g, "");
  const slug = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const ICONS = {
    whatsapp: '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.2-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.6-5.7C5.2 10 10 5.3 16 5.3S26.8 10 26.8 15.8 22 26.4 16 26.4zm5.9-7.8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.8.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.7 1.2 3.1 1.3 3.3c.2.2 2.3 3.5 5.6 4.9 2.1.9 2.9 1 4 .8.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5c-.1-.2-.3-.3-.6-.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#98C61D"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#1E2B00" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  const iconImg = (name, size = 40) =>
    `<img src="assets/icons/${esc(name)}.svg" alt="" width="${size}" height="${size}" loading="lazy">`;

  // Link do WhatsApp com mensagem pré-preenchida (número vem de content.js)
  const waLink = (msg) =>
    `https://wa.me/${digits(C.contatos.ddi)}${digits(C.contatos.whatsapp)}?text=${encodeURIComponent(msg || C.contatos.mensagemPadrao)}`;
  const telLink = (n) => `tel:+${digits(C.contatos.ddi)}${digits(n)}`;
  // "#ancora" | "tel:<chave em contatos>" | "wa:<mensagem>"
  const actionHref = (acao) => {
    if (acao.startsWith("tel:")) return telLink(C.contatos[acao.slice(4)] || "");
    if (acao.startsWith("wa:")) return waLink(acao.slice(3));
    return acao;
  };
  // Pontuação final do título em verde-limão (assinatura visual), ou um ponto se não houver
  const accentize = (el) => {
    const t = el.textContent.trim();
    const m = t.match(/^(.*?)([.!?])$/s);
    el.innerHTML = m
      ? `${esc(m[1])}<span class="accent">${m[2]}</span>`
      : `${esc(t)}<span class="accent" aria-hidden="true">.</span>`;
  };

  /* ---------- Renderização ---------- */
  const renderers = {
    nav: () => C.nav.map((i) => `<li><a href="${esc(i.ancora)}">${esc(i.rotulo)}</a></li>`).join(""),

    // Linhas de planos no cartão do topo (ícone, nome, descrição, "Saiba mais")
    linhas: () => C.planos.itens.map((p) => `
      <li>
        <a class="hero__row" href="#planos">
          ${iconImg("carro-linha", 48)}
          <span class="hero__row-text">
            <strong class="hero__row-title">${esc(C.hero.linhaPrefixo)} ${esc(p.nome)}<span class="accent" aria-hidden="true">.</span></strong>
            <span>${esc(p.descricao)} <span class="hero__row-link">${esc(C.hero.linhaLink)} ›</span></span>
          </span>
          <svg class="hero__row-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      </li>`).join(""),

    // Atalhos do painel verde
    atalhos: () => C.hero.atalhos.map((a) => {
      const ext = a.acao.startsWith("wa:");
      return `
      <li>
        <a class="hero__tile" href="${esc(actionHref(a.acao))}"${ext ? ' target="_blank" rel="noopener"' : ""}>
          ${iconImg(a.icone, 32)}<span>${esc(a.rotulo)}</span>
        </a>
      </li>`;
    }).join(""),

    servicos: () => C.servicos.itens.map((s) => `
      <li class="service">
        <div class="icon-badge">${iconImg(s.icone)}</div>
        <h3>${esc(s.titulo)}</h3>
        <p>${esc(s.texto)}</p>
      </li>`).join(""),

    passos: () => C.passos.itens.map((p) => `
      <li class="step"><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></li>`).join(""),

    planos: () => C.planos.itens.map((p) => `
      <article class="plan${p.destaque ? " plan--featured" : ""}" aria-labelledby="plano-${slug(p.nome)}">
        ${p.selo ? `<span class="plan__badge">${esc(p.selo)}</span>` : ""}
        <h3 id="plano-${slug(p.nome)}">${esc(p.nome)}</h3>
        <p class="plan__desc">${esc(p.descricao)}</p>
        <ul class="plan__list">
          ${p.beneficios.map((b) => `<li>${ICONS.check}<span>${esc(b)}</span></li>`).join("")}
        </ul>
        <a class="btn ${p.destaque ? "btn--primary" : "btn--outline"} btn--block" target="_blank" rel="noopener"
           href="${esc(waLink(`Olá! Quero uma cotação grátis do plano ${p.nome}.`))}">
          ${esc(C.planos.botao)}<span class="visually-hidden"> ${esc(p.nome)}</span>
        </a>
      </article>`).join(""),

    depoimentos: () => C.depoimentos.itens.map((d) => `
      <li>
        <figure class="testimonial">
          <span class="tag">Exemplo</span>
          <blockquote><p>“${esc(d.texto)}”</p></blockquote>
          <figcaption>
            ${d.foto
              ? `<img class="testimonial__avatar" src="${esc(d.foto)}" alt="" width="44" height="44" loading="lazy">`
              : `<span class="testimonial__avatar" aria-hidden="true">${esc(d.iniciais || "")}</span>`}
            <span><span class="testimonial__name">${esc(d.nome)}</span>${esc(d.cidade)}</span>
          </figcaption>
        </figure>
      </li>`).join(""),

    faq: () => C.faq.itens.map((f) => `
      <details><summary>${esc(f.p)}</summary><p>${esc(f.r)}</p></details>`).join(""),

    glossario: () => C.glossario.itens.map((g) => `<dt>${esc(g.termo)}</dt><dd>${esc(g.def)}</dd>`).join(""),

    contato: () => {
      const c = C.contatos, e = C.empresa;
      return [
        ["WhatsApp", `<a href="${esc(waLink())}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a>`],
        ["Sede", `<a href="${esc(telLink(c.sede))}">${esc(c.sede)}</a>`],
        ["Suporte 24h", `<a href="${esc(telLink(c.suporte24h))}">${esc(c.suporte24h)}</a>`],
        ["E-mail", `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
        ["Endereço", `<span>${esc(e.endereco)}</span>`],
        ["Horário", `<span>${esc(e.horario)}</span>`]
      ].map(([rotulo, valor]) => `<li><strong>${rotulo}</strong>${valor}</li>`).join("");
    },

    redes: () => C.redes.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.nome)}</a></li>`).join(""),
    cnpj: () => `CNPJ: ${esc(C.empresa.cnpj)}`,
    copyright: () => `© ${new Date().getFullYear()} ${esc(C.empresa.nome)} ${esc(C.empresa.assinatura)}. Todos os direitos reservados.`,
    privacidade: () => C.privacidade.texto.map((t) => `<p>${esc(t)}</p>`).join("")
  };

  function render() {
    $$("[data-text]").forEach((el) => {
      const v = get(el.dataset.text);
      if (v != null) el.textContent = v;
    });
    $$("[data-render]").forEach((el) => {
      const fn = renderers[el.dataset.render];
      if (fn) el.innerHTML = fn();
    });
    $$("[data-accent]").forEach(accentize);
    $$("[data-icon]").forEach((el) => { el.outerHTML = ICONS[el.dataset.icon] || ""; });
    $$("[data-wa]").forEach((a) => {
      a.href = waLink();
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  /* ---------- Cabeçalho e menu ---------- */
  function initHeader() {
    const header = $(".header");
    const toggle = $(".header__toggle");
    const nav = $("#menu");

    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });

    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Formulário de cotação → WhatsApp ---------- */
  function initForm() {
    const form = $("#cotacao");
    const error = $(".quote-form__error", form);
    const phone = $("#f-whats");

    // Máscara simples: (00) 00000-0000
    phone.addEventListener("input", () => {
      const d = digits(phone.value).slice(0, 11);
      let out = d;
      if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
      phone.value = out;
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = form.nome.value.trim();
      const whats = form.whatsapp.value.trim();
      const veiculo = form.veiculo.value.trim();

      const invalid = [];
      [form.nome, form.whatsapp, form.veiculo].forEach((f) => f.removeAttribute("aria-invalid"));
      if (!nome) invalid.push([form.nome, "seu nome"]);
      if (digits(whats).length < 10) invalid.push([form.whatsapp, "um WhatsApp com DDD"]);
      if (!veiculo) invalid.push([form.veiculo, "a placa ou o modelo"]);

      if (invalid.length) {
        invalid.forEach(([f]) => f.setAttribute("aria-invalid", "true"));
        error.textContent = `Informe ${invalid.map(([, t]) => t).join(", ")}.`;
        error.hidden = false;
        invalid[0][0].focus();
        return;
      }
      error.hidden = true;

      const msg = [
        "Olá! Quero fazer uma cotação grátis.",
        `Nome: ${nome}`,
        `WhatsApp: ${whats}`,
        `Veículo (placa ou modelo): ${veiculo}`
      ].join("\n");

      const url = waLink(msg);
      const win = window.open(url, "_blank");
      if (win) win.opener = null;
      else window.location.href = url; // pop-up bloqueado
    });
  }

  /* ---------- Diálogo de privacidade ---------- */
  function initDialogs() {
    $$("[data-open]").forEach((btn) => {
      const dialog = document.getElementById(btn.dataset.open);
      if (!dialog || typeof dialog.showModal !== "function") return;
      btn.addEventListener("click", () => dialog.showModal());
      dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    });
  }

  /* ---------- Entrada do carro no banner (ao carregar a página) ----------
   * O carro começa fora do banner, à direita, e anda até a posição final
   * definida no CSS (.hero__car), desacelerando ao estacionar. Não depende da rolagem.
   * Com prefers-reduced-motion ou sem GSAP: o carro já aparece estacionado.
   */
  const CAR_INTRO = {
    duration: 1.8,      // PERSONALIZAR: duração da entrada, em segundos
    delay: 0.3,         // espera antes de começar
    ease: "power3.out"  // desacelera ao estacionar
  };

  function initHeroCar() {
    const root = document.documentElement;
    const banner = $(".hero__banner");
    const car = $(".hero__car");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = () => root.classList.remove("car-intro");

    if (!banner || !car || !window.gsap || reduce) { show(); return; }

    const img = $("img", car);
    const run = () => {
      // Distância até ficar totalmente fora do banner, à direita
      const startX = banner.clientWidth - car.offsetLeft;
      gsap.set(car, { x: startX });
      show();
      gsap.to(car, { x: 0, duration: CAR_INTRO.duration, delay: CAR_INTRO.delay, ease: CAR_INTRO.ease, clearProps: "transform" });
    };

    // Espera a imagem carregar para o carro não entrar "vazio"
    if (img.complete) run();
    else {
      img.addEventListener("load", run, { once: true });
      img.addEventListener("error", show, { once: true });
    }
  }

  render();
  initHeader();
  initForm();
  initDialogs();
  initHeroCar();
})();
