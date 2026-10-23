/*
 * POST /api/boleto: 2ª via de boleto, com proteções em camadas, nesta ordem:
 *   1. Origem permitida (CORS + conferência do cabeçalho Origin)
 *   2. Limite de requisições por IP e teto global
 *   3. Validação estrita de placa e CPF (lista de permissão)
 *   4. Turnstile verificado no servidor
 *   5. Limite de envios por CPF por dia
 *   6. Consulta à Hinova e envio ao WhatsApp CADASTRADO, em segundo plano
 * A resposta é sempre a mesma e leva sempre o mesmo tempo mínimo, para não
 * revelar se placa/CPF existem (anti-enumeração, LGPD).
 */
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { validarPedido, mascararCpf, mascararPlaca } from "./lib/validar.js";
import { normalizarOrigem } from "./lib/config.js";
import { verificarTurnstile } from "./lib/turnstile.js";
import { montarMensagem } from "./lib/whatsapp.js";

export const MENSAGEM_PADRAO =
  "Se os dados estiverem corretos e houver boleto em aberto, enviaremos a 2ª via para o WhatsApp cadastrado em instantes.";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Limite de envios por CPF por dia (guarda só um hash do CPF, nunca o CPF)
function criarLimiteCpf(maxPorDia) {
  const sal = crypto.randomBytes(16);
  const contagem = new Map();
  let dia = new Date().toISOString().slice(0, 10);
  return (cpf) => {
    const hoje = new Date().toISOString().slice(0, 10);
    if (hoje !== dia) { contagem.clear(); dia = hoje; }
    const chave = crypto.createHmac("sha256", sal).update(cpf).digest("base64url");
    const n = (contagem.get(chave) || 0) + 1;
    contagem.set(chave, n);
    return n <= maxPorDia;
  };
}

export function criarApp(cfg, deps) {
  const { hinova, whatsapp, turnstile = verificarTurnstile, log = console } = deps;
  const app = express();

  app.set("trust proxy", cfg.trustProxy);
  app.use(helmet());

  // CORS: só as origens configuradas (GitHub Pages e, no futuro, o domínio próprio)
  const origemOk = (origem) => !cfg.origens.length || (Boolean(origem) && cfg.origens.includes(normalizarOrigem(origem)));
  app.use("/api", cors({
    origin: (origem, cb) => {
      const ok = Boolean(origem) && origemOk(origem);
      // Ajuda a diagnosticar ALLOWED_ORIGINS (a origem é o endereço do site, não é dado pessoal)
      if (origem && !ok) log.info(`[cors] origem recusada: ${origem} (permitidas: ${cfg.origens.join(", ")})`);
      cb(null, ok);
    },
    methods: ["POST"],
    allowedHeaders: ["Content-Type"],
    maxAge: 600
  }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  const limiteIp = rateLimit({
    windowMs: cfg.limites.janelaIpMin * 60 * 1000,
    limit: cfg.limites.porIp,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { ok: false, erro: "muitas_tentativas" }
  });
  const limiteGlobal = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: cfg.limites.globalPorHora,
    keyGenerator: () => "global",
    standardHeaders: false,
    legacyHeaders: false,
    message: { ok: false, erro: "muitas_tentativas" }
  });
  const limiteCpf = criarLimiteCpf(cfg.limites.enviosPorCpfDia);

  async function processar({ placa, cpf }) {
    const ref = `${mascararPlaca(placa)} / ${mascararCpf(cpf)}`;
    if (cfg.modo === "simulado") { log.info(`[boleto] simulado: ${ref}`); return "simulado"; }

    const r = await hinova.consultar({ placa, cpf });
    if (r.resultado !== "ok") { log.info(`[boleto] ${r.resultado}: ${ref}`); return r.resultado; }

    if (cfg.modo === "homologacao") {
      const numero = r.telefone.replace(/^55(?=\d{10,11}$)/, "");
      if (!cfg.whatsapp.permitidosTeste.includes(numero)) {
        log.info(`[boleto] homologação: telefone fora da lista de teste, nada enviado: ${ref}`);
        return "bloqueado_homologacao";
      }
    }
    await whatsapp.enviar(r.telefone, montarMensagem(r.boleto, cfg.whatsapp.nomeEmpresa));
    log.info(`[boleto] enviado: ${ref}`);
    return "enviado";
  }

  app.post("/api/boleto", limiteIp, limiteGlobal, express.json({ limit: "2kb" }), async (req, res) => {
    const inicio = Date.now();

    if (!origemOk(req.get("origin"))) return res.status(403).json({ ok: false, erro: "origem" });

    const pedido = validarPedido(req.body);
    if (pedido.erro) return res.status(400).json({ ok: false, erro: "dados_invalidos", campo: pedido.erro });

    const humano = await turnstile({
      token: pedido.token,
      ip: req.ip,
      segredo: cfg.turnstile.segredo,
      hostnames: cfg.turnstile.hostnames,
      acao: cfg.turnstile.acao
    });
    if (!humano) return res.status(403).json({ ok: false, erro: "verificacao_humana" });

    // Processa em segundo plano: o tempo de resposta não depende do resultado
    if (limiteCpf(pedido.cpf)) {
      app.locals.ultimoProcesso = processar(pedido).catch((e) => {
        log.error(`[boleto] falha: ${e.message}`);
        return "erro";
      });
    } else {
      log.info(`[boleto] limite diário do CPF atingido: ${mascararCpf(pedido.cpf)}`);
      app.locals.ultimoProcesso = Promise.resolve("limite_cpf");
    }

    await esperar(Math.max(0, cfg.limites.respostaMinMs - (Date.now() - inicio)));
    res.json({ ok: true, mensagem: MENSAGEM_PADRAO });
  });

  // JSON malformado, corpo grande demais e demais erros: resposta genérica
  app.use((err, _req, res, _next) => {
    const status = err.type === "entity.too.large" ? 413 : err.status === 400 || err.type === "entity.parse.failed" ? 400 : 500;
    if (status === 500) log.error(`[app] ${err.message}`);
    res.status(status).json({ ok: false, erro: status === 500 ? "interno" : "dados_invalidos" });
  });

  return app;
}
