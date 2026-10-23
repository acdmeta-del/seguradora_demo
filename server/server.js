/*
 * Integra: intermediário seguro da 2ª via de boleto (SGA Hinova).
 * As chaves ficam nas variáveis de ambiente do Easypanel; ver .env.example e README.md.
 */
import { lerConfig, conferirConfig } from "./lib/config.js";
import { criarHinova } from "./lib/hinova.js";
import { criarWhatsapp } from "./lib/whatsapp.js";
import { criarApp } from "./app.js";

const cfg = lerConfig();
const faltando = conferirConfig(cfg);

if (faltando.length) {
  const msg = `Configuração incompleta: ${faltando.join(", ")}`;
  if (cfg.producao) {
    console.error(`${msg}. O servidor não vai subir sem as proteções em produção.`);
    process.exit(1);
  }
  console.warn(`${msg} (ignorado fora de produção).`);
}

const app = criarApp(cfg, {
  hinova: criarHinova(cfg.hinova),
  whatsapp: criarWhatsapp(cfg.whatsapp)
});

app.listen(cfg.porta, () => {
  console.info(`Intermediário no ar na porta ${cfg.porta} (modo: ${cfg.modo}, WhatsApp: ${cfg.whatsapp.provedor}, Hinova: ${cfg.hinova.modoAuth})`);
  console.info(`Origens permitidas: ${cfg.origens.join(", ") || "TODAS (ALLOWED_ORIGINS vazio)"}`);
});
