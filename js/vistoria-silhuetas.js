/*
 * Vistoria (TESTE, Fase 1): silhuetas em traço (SVG) sobre a câmera.
 * Todas no mesmo quadro 400 x 225 (16:9), na escala em que o carro deve aparecer:
 * frente/traseira ~65% da largura, diagonais ~72%, laterais ~80% (carro e moto).
 * Peças simétricas são desenhadas só do lado esquerdo e espelhadas (ESPELHO).
 * PERSONALIZAR: os desenhos. O lado direito (espelhar no config) inverte a figura toda.
 */
(function (raiz) {
  "use strict";

  const ESPELHO = (metade) => `<g>${metade}</g><g transform="translate(400 0) scale(-1 1)">${metade}</g>`;

  // ---------- Frente ----------
  const frenteMetade = `
    <path d="M200 40H150c-9 0-15 4-19 12l-25 56"/>
    <path d="M106 108c-13 6-21 16-25 30l-4 38c0 10 4 16 12 18h16"/>
    <path d="M86 194v14c0 5 3 8 8 8h16c5 0 8-3 8-8v-13"/>
    <path d="M100 106c-8-5-22-6-34-2-5 6-4 14 2 17h28c4-4 5-10 4-15z"/>
    <path d="M100 118l8 2"/>
    <path d="M108 110c30-6 60-7 92-7"/>
    <path d="M115 113c12 11 25 21 37 27"/>
    <path d="M86 134c16-2 44 2 64 8l-4 11c-22 0-44-2-56-5-5-3-6-9-4-14z"/>
    <path d="M93 141c16 0 34 3 48 7"/>
    <path d="M89 162c14 2 30 4 43 6l-4 16c-15 0-28-2-37-4-4-5-4-12-2-18z"/>
    <path d="M97 191h103"/>
    <path d="M80 176c40 4 80 6 120 6"/>`;
  const frente = `
    ${ESPELHO(frenteMetade)}
    <path d="M132 98l18-46c2-4 6-6 10-6h80c4 0 8 2 10 6l18 46c-28-4-108-4-136 0z"/>
    <path d="M164 92l2-20c0-4 4-6 8-6h10c4 0 6 2 6 6l2 20M208 92l2-20c0-4 2-6 6-6h10c4 0 8 2 8 6l2 20"/>
    <path d="M150 141h100l14 14-16 22h-96l-16-22z"/>
    <path d="M158 150h84M156 160h88"/>
    <rect x="172" y="164" width="56" height="13" rx="2"/>
    <circle cx="200" cy="146" r="4"/>`;

  // ---------- Traseira ----------
  const traseiraMetade = `
    <path d="M200 42H156c-9 0-15 4-19 12l-23 52"/>
    <path d="M114 106c-15 6-25 16-29 30l-6 40c0 10 4 16 12 18h14"/>
    <path d="M88 194v14c0 5 3 8 8 8h16c5 0 8-3 8-8v-13"/>
    <path d="M108 106c-8-5-22-6-34-2-5 6-4 14 2 17h28c4-4 5-10 4-15z"/>
    <path d="M86 122c18-4 42-4 60-2l-2 18c-20 2-42 1-56-1-4-4-5-10-2-15z"/>
    <path d="M94 129h44"/>
    <path d="M120 110h80"/>
    <path d="M84 166c38 4 78 5 116 5"/>
    <path d="M94 178h20"/>
    <path d="M100 190h100"/>`;
  const traseira = `
    ${ESPELHO(traseiraMetade)}
    <path d="M140 98l16-44c2-4 6-6 10-6h68c4 0 8 2 10 6l16 44c-26-4-94-4-120 0z"/>
    <path d="M152 50h96"/>
    <path d="M146 120h108l-6 34h-96z"/>
    <rect x="172" y="137" width="56" height="13" rx="2"/>
    <circle cx="200" cy="126" r="5"/>`;

  // ---------- Lateral (frente à esquerda) ----------
  const lateral = `
    <path d="M48 162c-4-2-6-6-6-12 0-10 4-18 14-21l62-12 36-34c6-6 14-9 24-9h100c12 0 20 3 28 11l36 36c14 4 22 12 22 26v16c0 6-4 10-10 10h-12"/>
    <path d="M330 173a30 30 0 0 0-58 0"/>
    <path d="M272 173H130"/>
    <path d="M130 173a30 30 0 0 0-58 0"/>
    <path d="M72 173H56c-5 0-8-4-8-11"/>
    <circle cx="101" cy="178" r="25"/><circle cx="101" cy="178" r="15"/><circle cx="101" cy="178" r="4"/>
    <circle cx="301" cy="178" r="25"/><circle cx="301" cy="178" r="15"/><circle cx="301" cy="178" r="4"/>
    <path d="M140 115l20-26c4-5 9-7 16-7h42v33z"/>
    <path d="M226 82h44c9 0 15 3 21 9l24 24h-89z"/>
    <path d="M118 117l218 3"/>
    <path d="M222 118l2 52"/>
    <path d="M152 118c-4 18-3 36 0 52"/>
    <path d="M190 130h16M262 131h16"/>
    <path d="M146 112l-14-5v11h14"/>
    <path d="M46 138l26-5-2 11-24 1"/>
    <path d="M350 128l8 2v16l-10-2z"/>
    <path d="M58 146l284 4"/>
    <path d="M132 166h138"/>`;

  // ---------- Diagonal frontal (frente e lateral esquerda) ----------
  const diagonalFrontal = `
    <path d="M70 186c-6-2-9-7-9-14l-1-30c0-10 5-18 14-22l38-12 30-48c4-6 10-9 18-9l106 2c10 0 17 4 23 11l32 38c12 5 18 13 18 25v28c0 7-4 11-10 11h-6"/>
    <path d="M323 166a24 24 0 0 0-47 0"/>
    <path d="M276 166l-80 6"/>
    <path d="M196 172a28 28 0 0 0-55 2"/>
    <path d="M141 174l0 14H78"/>
    <ellipse cx="300" cy="170" rx="18" ry="22"/><ellipse cx="300" cy="170" rx="10" ry="13"/>
    <ellipse cx="168" cy="180" rx="21" ry="26"/><ellipse cx="168" cy="180" rx="12" ry="15"/>
    <path d="M114 108l28-44c3-4 7-6 12-6h22l-10 50z"/>
    <path d="M176 58h52l-4 46h-58z"/>
    <path d="M236 58h28c7 0 12 3 16 8l26 36-80 2z"/>
    <path d="M112 110l20 2h200"/>
    <path d="M228 106l-4 60"/>
    <path d="M166 108c-2 20-2 40 0 56"/>
    <path d="M200 120h14M262 120h14"/>
    <path d="M162 104l-12-6-2 10h12"/>
    <path d="M64 130l38-6 6 12-40 6z"/>
    <path d="M70 148l34-2 4 18-34 4z"/>
    <path d="M80 152h22M80 158h22"/>
    <rect x="76" y="170" width="26" height="9" rx="1.5"/>
    <path d="M112 112c4 20 8 40 14 60"/>`;

  // ---------- Diagonal traseira (traseira e lateral esquerda) ----------
  const diagonalTraseira = `
    <path d="M330 186c6-2 9-7 9-14l1-30c0-10-5-18-14-22l-38-12-30-48c-4-6-10-9-18-9l-106 2c-10 0-17 4-23 11l-32 38c-12 5-18 13-18 25v28c0 7 4 11 10 11h6"/>
    <path d="M77 166a24 24 0 0 1 47 0"/>
    <path d="M124 166l80 6"/>
    <path d="M204 172a28 28 0 0 1 55 2"/>
    <path d="M259 174v14h63"/>
    <ellipse cx="100" cy="170" rx="18" ry="22"/><ellipse cx="100" cy="170" rx="10" ry="13"/>
    <ellipse cx="232" cy="180" rx="21" ry="26"/><ellipse cx="232" cy="180" rx="12" ry="15"/>
    <path d="M286 108l-28-44c-3-4-7-6-12-6h-22l10 50z"/>
    <path d="M224 58h-52l4 46h58z"/>
    <path d="M164 58h-28c-7 0-12 3-16 8l-26 36 80 2z"/>
    <path d="M288 110l-20 2H68"/>
    <path d="M172 106l4 60"/>
    <path d="M234 108c2 20 2 40 0 56"/>
    <path d="M186 120h14M124 120h14"/>
    <path d="M336 128l-36-4-4 14 38 2z"/>
    <path d="M330 166h-34"/>
    <rect x="298" y="146" width="26" height="9" rx="1.5"/>
    <path d="M288 112c-4 20-8 40-14 60"/>`;

  // ---------- Painel com odômetro ----------
  const painel = `
    <path d="M40 150c10-60 80-96 160-96s150 36 160 96"/>
    <path d="M60 150c14-46 72-74 140-74s126 28 140 74"/>
    <circle cx="140" cy="118" r="38"/><circle cx="260" cy="118" r="38"/>
    <path d="M140 118l-22-16M260 118l20-18"/>
    <path d="M112 136l6-6M106 118h8M112 98l6 6M140 88v8M168 98l-6 6M174 118h-8"/>
    <path d="M232 136l6-6M226 118h8M232 98l6 6M260 88v8M288 98l-6 6M294 118h-8"/>
    <rect x="172" y="126" width="56" height="20" rx="3"/>
    <path d="M180 136h40" stroke-dasharray="4 4"/>
    <path d="M90 225c10-36 54-58 110-58s100 22 110 58"/>`;

  // ---------- Chassi / plaqueta ----------
  const chassi = `
    <rect x="50" y="78" width="300" height="70" rx="8"/>
    <rect x="62" y="90" width="276" height="46" rx="4"/>
    <path d="M78 113h244" stroke-dasharray="14 8"/>
    <circle cx="60" cy="86" r="3"/><circle cx="340" cy="86" r="3"/><circle cx="60" cy="140" r="3"/><circle cx="340" cy="140" r="3"/>`;

  // ---------- Estepe / porta-malas ----------
  const portamalas = `
    <path d="M60 210V96c0-6 3-10 8-12l40-20h184l40 20c5 2 8 6 8 12v114"/>
    <path d="M86 60l22-38h184l22 38"/>
    <path d="M84 104h232v92H84z"/>
    <circle cx="200" cy="150" r="40"/><circle cx="200" cy="150" r="22"/><circle cx="200" cy="150" r="5"/>
    <path d="M200 128v8M222 150h-8M200 172v-8M178 150h8"/>`;

  /* ================= MOTO ================= */

  // Lateral (frente à esquerda). rf/rt: raios horizontais das rodas (diagonais usam elipses)
  const motoLado = ({ rf = 36, rt = 36, ry = 36 } = {}) => `
    <ellipse cx="96" cy="170" rx="${rf}" ry="${ry}"/><ellipse cx="96" cy="170" rx="${rf * 0.72}" ry="${ry * 0.72}"/><ellipse cx="96" cy="170" rx="${rf * 0.16}" ry="${ry * 0.16}"/>
    <ellipse cx="304" cy="170" rx="${rt}" ry="${ry}"/><ellipse cx="304" cy="170" rx="${rt * 0.72}" ry="${ry * 0.72}"/><ellipse cx="304" cy="170" rx="${rt * 0.16}" ry="${ry * 0.16}"/>
    <path d="M96 170l34-92M104 172l34-92"/>
    <path d="M62 150c8-22 50-28 66-8"/>
    <path d="M126 70l18-8M132 66l-8-18"/><ellipse cx="122" cy="44" rx="9" ry="5"/>
    <ellipse cx="120" cy="96" rx="9" ry="12" transform="rotate(-20 120 96)"/>
    <path d="M140 92c10-14 56-18 74-8l4 16-68 8z"/>
    <path d="M214 86c26-4 56-2 76 6l-4 10h-68"/>
    <path d="M286 92l36 4-4 8h-30"/>
    <path d="M318 104l8 20"/><rect x="316" y="124" width="18" height="12" rx="1.5"/>
    <path d="M138 86l42 54h50"/>
    <rect x="160" y="112" width="64" height="40" rx="8"/><path d="M170 112v-8M182 112v-8M194 112v-8M206 112v-8"/>
    <path d="M230 140l74 30"/>
    <path d="M246 104l22 46"/>
    <path d="M190 152c30 8 70 8 110-2"/><path d="M262 146l56-6v10l-56 6z"/>
    <path d="M206 156h16"/>`;

  const motoFrente = `
    <rect x="188" y="120" width="24" height="92" rx="12"/>
    <path d="M182 124c4-14 32-14 36 0"/>
    <path d="M186 120V72M214 120V72"/>
    <circle cx="200" cy="74" r="18"/><circle cx="200" cy="74" r="10"/>
    <path d="M182 56l6-28h24l6 28"/>
    <path d="M128 54c24-4 48-6 72-6s48 2 72 6"/>
    <path d="M128 54h-14M272 54h14"/>
    <path d="M144 52l-14-26M256 52l14-26"/><ellipse cx="128" cy="22" rx="12" ry="7"/><ellipse cx="272" cy="22" rx="12" ry="7"/>
    <rect x="152" y="78" width="14" height="8" rx="2"/><rect x="234" y="78" width="14" height="8" rx="2"/>
    <path d="M176 60c-14 18-14 40 2 58M224 60c14 18 14 40-2 58"/>
    <path d="M170 124l-8 44M230 124l8 44"/>
    <path d="M150 170h24M226 170h24"/>`;

  const motoTraseira = `
    <rect x="184" y="128" width="32" height="84" rx="14"/>
    <path d="M178 116h44l-6 16h-32z"/>
    <rect x="180" y="100" width="40" height="22" rx="2"/>
    <rect x="186" y="84" width="28" height="10" rx="4"/>
    <path d="M176 84c4-16 44-16 48 0"/>
    <path d="M176 84l-6 12M224 84l6 12"/>
    <rect x="156" y="94" width="14" height="8" rx="2"/><rect x="230" y="94" width="14" height="8" rx="2"/>
    <path d="M136 52c22-4 42-6 64-6s42 2 64 6"/>
    <path d="M150 50l-14-24M250 50l14-24"/><ellipse cx="134" cy="22" rx="12" ry="7"/><ellipse cx="266" cy="22" rx="12" ry="7"/>
    <path d="M170 96l-8 32M230 96l8 32"/>
    <path d="M226 140l26 6v14l-26-4z"/>
    <path d="M150 172h24M226 172h24"/>`;

  const motoPainel = `
    <path d="M30 92c50-24 110-34 170-34s120 10 170 34"/>
    <path d="M30 92l-14 8M370 92l14 8"/>
    <circle cx="200" cy="120" r="52"/><circle cx="200" cy="120" r="44"/>
    <path d="M200 120l-30-22"/>
    <path d="M164 140l6-5M156 120h9M164 100l6 5M200 76v9M236 100l-6 5M244 120h-9"/>
    <rect x="176" y="136" width="48" height="16" rx="3"/>
    <path d="M184 144h32" stroke-dasharray="4 4"/>
    <path d="M118 84c-8 10-12 22-12 36M282 84c8 10 12 22 12 36"/>`;

  const motor = `
    <rect x="104" y="58" width="192" height="104" rx="14"/>
    <path d="M124 58V40M148 58V40M172 58V40M196 58V40M220 58V40M244 58V40M268 58V40"/>
    <circle cx="150" cy="110" r="22"/><circle cx="150" cy="110" r="8"/>
    <rect x="196" y="96" width="80" height="26" rx="3"/>
    <path d="M204 109h64" stroke-dasharray="7 5"/>
    <path d="M120 162l-10 30M280 162l10 30"/>`;

  raiz.VistoriaSilhuetas = {
    frente, traseira, lateral,
    "diagonal-frontal": diagonalFrontal,
    "diagonal-traseira": diagonalTraseira,
    painel, chassi, portamalas,
    "moto-frente": motoFrente,
    "moto-traseira": motoTraseira,
    "moto-lateral": motoLado(),
    "moto-diagonal-frontal": motoLado({ rf: 26, rt: 22, ry: 34 }),
    "moto-diagonal-traseira": motoLado({ rf: 20, rt: 28, ry: 34 }),
    "moto-painel": motoPainel,
    motor
  };
})(typeof self !== "undefined" ? self : this);
