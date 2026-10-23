/*
 * Configuração lida das variáveis de ambiente (no Easypanel: aba Environment).
 * Nenhuma chave fica no código ou no repositório. Ver .env.example.
 */
// Credencial colada no painel: remove espaços nas pontas e um "Bearer " colado por engano
const credencial = (v) => String(v || "").trim().replace(/^Bearer\s+/i, "");
// Aceita "https://site.com/", "https://site.com/pasta" ou com espaços: fica só a origem
export const normalizarOrigem = (v) => {
  const t = String(v || "").trim().toLowerCase();
  try { return new URL(t).origin; } catch { return t.replace(/\/+$/, ""); }
};
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
    // Origem = esquema + domínio, sem caminho e sem barra final (ex.: https://acdmeta-del.github.io)
    origens: lista(env.ALLOWED_ORIGINS).map(normalizarOrigem),

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
      token: credencial(env.HINOVA_TOKEN),
      usuario: String(env.HINOVA_USUARIO || "").trim(),
      senha: env.HINOVA_SENHA || "",
      // token   → o token da associação vai direto no Authorization (como no n8n)
      // usuario → troca token + usuário/senha por um token_usuario (/usuario/autenticar)
      // Padrão: "usuario" se HINOVA_USUARIO e HINOVA_SENHA estiverem preenchidos; senão "token"
      modoAuth: env.HINOVA_AUTH || (env.HINOVA_USUARIO && env.HINOVA_SENHA ? "usuario" : "token"),
      // CONFIRMAR na documentação/coleção Postman do SGA v2 do cliente.
      // Marcadores aceitos: {placa} {cpf} {codigo_veiculo} {codigo_associado} {codigo_boleto}
      pathAutenticar: env.HINOVA_PATH_AUTENTICAR || "/usuario/autenticar",
      // Vazio = não consulta o veículo; CPF e telefone saem da lista de boletos
      pathVeiculo: env.HINOVA_PATH_VEICULO ?? "/veiculo/buscar/{placa}",
      // Boletos: como no n8n do cliente (POST com placa e período de vencimento)
      pathBoletos: env.HINOVA_PATH_BOLETOS || "/listar/boleto-associado-veiculo",
      metodoBoletos: (env.HINOVA_METODO_BOLETOS || "POST").toUpperCase(),
      boletoDiasAntes: num(env.HINOVA_BOLETO_DIAS_ANTES, 60),   // vencidos há até N dias
      boletoDiasDepois: num(env.HINOVA_BOLETO_DIAS_DEPOIS, 30), // vencendo nos próximos N dias
      // Detalhe de um boleto pelo número (marcador {codigo_boleto})
      pathBoletoDetalhe: env.HINOVA_PATH_BOLETO_DETALHE ?? "/buscar/boleto/{codigo_boleto}",
      // Opcional: busca o associado quando o veículo não traz CPF/telefone do titular
      pathAssociado: env.HINOVA_PATH_ASSOCIADO || "",
      // Nomes EXATOS dos campos nas respostas (lista separada por vírgula, aceita "a.b").
      // Padrões conferidos com respostas reais da Hinova (a lista de boletos pode vir com
      // "descricao_situacao_boleto"/"cpf_associado" ou "situacao_boleto"/"cpf"/"celular").
      // Só estes campos são lidos: não há busca por nomes parecidos no fluxo.
      campos: {
        tokenUsuario: lista(env.HINOVA_CAMPO_TOKEN_USUARIO || "token_usuario,token,access_token,dados.token_usuario,data.token_usuario"),
        cpf: lista(env.HINOVA_CAMPO_CPF || "cpf_associado,cpf"),
        // "a+b" junta campos separados (ex.: DDD + número, como no /veiculo/buscar)
        telefone: lista(env.HINOVA_CAMPO_TELEFONE || "celular,ddd_celular+telefone_celular,telefone_celular"),
        placa: lista(env.HINOVA_CAMPO_PLACA || "placa"),
        codigoVeiculo: lista(env.HINOVA_CAMPO_CODIGO_VEICULO || "codigo_veiculo"),
        codigoAssociado: lista(env.HINOVA_CAMPO_CODIGO_ASSOCIADO || "codigo_associado,associado.codigo_associado"),
        vencimento: lista(env.HINOVA_CAMPO_VENCIMENTO || "data_vencimento,vencimento"),
        linhaDigitavel: lista(env.HINOVA_CAMPO_LINHA || "linha_digitavel"),
        link: lista(env.HINOVA_CAMPO_LINK || "link_boleto,url_boleto,link"),
        pix: lista(env.HINOVA_CAMPO_PIX || "pix.copia_cola"),            // texto; "pix.qrcode" é a imagem
        situacao: lista(env.HINOVA_CAMPO_SITUACAO || "descricao_situacao_boleto,situacao_boleto"),
        dataPagamento: lista(env.HINOVA_CAMPO_DATA_PAGAMENTO || "data_pagamento"),   // preenchido = pago
        codigoBoleto: lista(env.HINOVA_CAMPO_CODIGO_BOLETO || "nosso_numero,codigo_boleto,numero_boleto")
      },
      // Situações que NÃO são boleto em aberto (comparação sem acento, maiúsculas)
      // Boleto só conta como aberto se a situação estiver NESTA lista (sem situação = não envia)
      situacoesAbertas: lista(env.HINOVA_SITUACOES_ABERTAS || "ABERTO,EM ABERTO"),
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
    if (!["token", "usuario"].includes(cfg.hinova.modoAuth)) faltando.push("HINOVA_AUTH (token|usuario)");
    if (cfg.hinova.modoAuth === "usuario" && !cfg.hinova.usuario) faltando.push("HINOVA_USUARIO");
    if (cfg.hinova.modoAuth === "usuario" && !cfg.hinova.senha) faltando.push("HINOVA_SENHA");
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
