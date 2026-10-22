/*
 * Configuração lida das variáveis de ambiente (no Easypanel: aba Environment).
 * Nenhuma chave fica no código ou no repositório. Ver .env.example.
 */
const lista = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
const num = (v, padrao) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : padrao);

export function lerConfig(env = process.env) {
  return {
    producao: env.NODE_ENV === "production",
    porta: num(env.PORT, 3000),
    // simulado | homologacao | producao
    modo: env.MODO || "simulado",
    // Quantos proxies confiáveis à frente (Traefik do Easypanel = 1)
    trustProxy: num(env.TRUST_PROXY, 1),
    origens: lista(env.ALLOWED_ORIGINS),

    turnstile: {
      segredo: env.TURNSTILE_SECRET || "",
      hostnames: lista(env.TURNSTILE_HOSTNAMES),
      acao: "boleto"
    },

    limites: {
      porIp: num(env.LIMITE_POR_IP, 5),            // consultas por IP...
      janelaIpMin: num(env.LIMITE_JANELA_MIN, 15), // ...a cada N minutos
      globalPorHora: num(env.LIMITE_GLOBAL_HORA, 300),
      enviosPorCpfDia: num(env.LIMITE_CPF_DIA, 3),
      respostaMinMs: num(env.RESPOSTA_MIN_MS, 1000)
    },

    hinova: {
      baseUrl: (env.HINOVA_BASE_URL || "https://api.hinova.com.br/api/sga/v2").replace(/\/+$/, ""),
      token: env.HINOVA_TOKEN || "",
      usuario: env.HINOVA_USUARIO || "",
      senha: env.HINOVA_SENHA || "",
      // CONFIRMAR na documentação/coleção Postman do SGA v2 do cliente.
      // Marcadores aceitos: {placa} {cpf} {codigo_veiculo} {codigo_associado}
      pathAutenticar: env.HINOVA_PATH_AUTENTICAR || "/usuario/autenticar",
      pathVeiculo: env.HINOVA_PATH_VEICULO || "/veiculo/buscar/{placa}/placa",
      pathBoletos: env.HINOVA_PATH_BOLETOS || "/listar/boleto-associado-veiculo/{codigo_veiculo}",
      // Opcional: busca o associado quando o veículo não traz CPF/telefone do titular
      pathAssociado: env.HINOVA_PATH_ASSOCIADO || "",
      // Nomes de campos nas respostas (lista separada por vírgula, aceita "a.b")
      campos: {
        tokenUsuario: lista(env.HINOVA_CAMPO_TOKEN_USUARIO || "token_usuario,token,access_token,dados.token_usuario,data.token_usuario"),
        cpf: lista(env.HINOVA_CAMPO_CPF || "cpf,cpf_associado,cpf_cnpj,associado.cpf"),
        telefone: lista(env.HINOVA_CAMPO_TELEFONE || "telefone_celular,celular,associado.telefone_celular,associado.celular"),
        placa: lista(env.HINOVA_CAMPO_PLACA || "placa"),
        codigoVeiculo: lista(env.HINOVA_CAMPO_CODIGO_VEICULO || "codigo_veiculo"),
        codigoAssociado: lista(env.HINOVA_CAMPO_CODIGO_ASSOCIADO || "codigo_associado,associado.codigo_associado"),
        vencimento: lista(env.HINOVA_CAMPO_VENCIMENTO || "data_vencimento,vencimento"),
        linhaDigitavel: lista(env.HINOVA_CAMPO_LINHA || "linha_digitavel"),
        link: lista(env.HINOVA_CAMPO_LINK || "link_boleto,url_boleto,link"),
        pix: lista(env.HINOVA_CAMPO_PIX || "pix_copia_cola,pix"),
        situacao: lista(env.HINOVA_CAMPO_SITUACAO || "situacao_boleto,descricao_situacao_boleto,situacao")
      },
      // Situações que NÃO são boleto em aberto (comparação sem acento, maiúsculas)
      situacoesFechadas: lista(env.HINOVA_SITUACOES_FECHADAS || "BAIXADO,PAGO,CANCELADO,LIQUIDADO"),
      timeoutMs: num(env.HINOVA_TIMEOUT_MS, 8000)
    },

    whatsapp: {
      // zapi (usado pelo cliente) | evolution | log (não envia, só registra)
      provedor: env.WHATSAPP_PROVIDER || "log",
      // Em MODO=homologacao, só estes números recebem mensagens (DDD + número)
      permitidosTeste: lista(env.WHATSAPP_TESTE_PERMITIDOS).map((n) => n.replace(/\D/g, "")),
      evolution: { url: (env.EVOLUTION_URL || "").replace(/\/+$/, ""), instancia: env.EVOLUTION_INSTANCE || "", apikey: env.EVOLUTION_APIKEY || "" },
      zapi: { instancia: env.ZAPI_INSTANCE || "", token: env.ZAPI_TOKEN || "", clientToken: env.ZAPI_CLIENT_TOKEN || "" },
      nomeEmpresa: env.NOME_EMPRESA || "Integra Proteção Veicular",
      timeoutMs: num(env.WHATSAPP_TIMEOUT_MS, 8000)
    }
  };
}

// Em produção, recusa subir sem as proteções configuradas
export function conferirConfig(cfg) {
  const faltando = [];
  if (!cfg.turnstile.segredo) faltando.push("TURNSTILE_SECRET");
  if (!cfg.origens.length) faltando.push("ALLOWED_ORIGINS");
  if (!["simulado", "homologacao", "producao"].includes(cfg.modo)) faltando.push("MODO (simulado|homologacao|producao)");
  if (cfg.modo !== "simulado") {
    if (!cfg.hinova.token) faltando.push("HINOVA_TOKEN");
    if (!cfg.hinova.usuario) faltando.push("HINOVA_USUARIO");
    if (!cfg.hinova.senha) faltando.push("HINOVA_SENHA");
  }
  if (cfg.modo === "homologacao" && !cfg.whatsapp.permitidosTeste.length) faltando.push("WHATSAPP_TESTE_PERMITIDOS");
  const w = cfg.whatsapp;
  if (!["log", "evolution", "zapi"].includes(w.provedor)) faltando.push("WHATSAPP_PROVIDER (log|evolution|zapi)");
  if (w.provedor === "zapi") {
    if (!w.zapi.instancia) faltando.push("ZAPI_INSTANCE");
    if (!w.zapi.token) faltando.push("ZAPI_TOKEN");
    if (!w.zapi.clientToken) faltando.push("ZAPI_CLIENT_TOKEN");
  }
  if (w.provedor === "evolution") {
    if (!w.evolution.url) faltando.push("EVOLUTION_URL");
    if (!w.evolution.instancia) faltando.push("EVOLUTION_INSTANCE");
    if (!w.evolution.apikey) faltando.push("EVOLUTION_APIKEY");
  }
  return faltando;
}
