/*
 * Cliente do SGA Hinova (API v2).
 *
 * Autenticação (HINOVA_AUTH):
 *   token   → o token da associação (HINOVA_TOKEN, gerado em Área do cliente > APIs >
 *             Gerenciar APIs) vai direto em "Authorization: Bearer ...". Padrão sem usuário/senha.
 *   usuario → o token da associação + HINOVA_USUARIO/HINOVA_SENHA geram um token_usuario
 *             em /usuario/autenticar, guardado em cache e renovado ao expirar ou receber 401.
 *
 * Os caminhos e nomes de campos vêm da configuração (config.js) porque precisam
 * ser conferidos na documentação do SGA do cliente. Use "npm run testar-hinova".
 *
 * Placa e CPF chegam aqui já validados (validar.js) e entram codificados no
 * caminho (encodeURIComponent), nunca como texto livre.
 */
const TOKEN_TTL_MS = 50 * 60 * 1000;

// Lê o primeiro campo existente de uma lista ("a", "a.b")
export function pegar(obj, caminhos) {
  for (const c of caminhos) {
    const v = c.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// Respostas podem vir como objeto, lista ou { dados: [...] }
export function comoLista(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (resposta && typeof resposta === "object") {
    const lista = Object.values(resposta).find(Array.isArray);
    return lista || [resposta];
  }
  return [];
}

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// "dd/mm/aaaa" ou "aaaa-mm-dd" → número comparável
function dataNum(v) {
  const s = String(v || "");
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return Number(m[3] + m[2] + m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Number(m[1] + m[2] + m[3]);
  return Number.MAX_SAFE_INTEGER;
}

// Resumo seguro de uma resposta: campos e tipos, mais o texto de mensagens de erro.
// Nunca inclui valores de outros campos (podem conter token ou dados pessoais).
const CAMPOS_MENSAGEM = ["mensagem", "message", "msg", "erro", "error", "errors", "detalhe", "descricao", "retorno", "status"];
export function diagnosticar(status, dados) {
  const tipo = Array.isArray(dados) ? `lista[${dados.length}]` : dados === null ? "vazia ou não-JSON" : typeof dados;
  const campos = dados && typeof dados === "object" && !Array.isArray(dados)
    ? Object.entries(dados).map(([k, v]) => `${k}: ${Array.isArray(v) ? "lista" : v === null ? "null" : typeof v}`)
    : [];
  const mensagens = [];
  // Texto de um campo de mensagem: valores simples, listas e objetos aninhados (até 3 níveis)
  const textos = (v, prefixo, nivel = 0) => {
    if (v == null || nivel > 3) return;
    if (["string", "number", "boolean"].includes(typeof v)) mensagens.push(`${prefixo}: ${String(v).slice(0, 200)}`);
    else if (Array.isArray(v)) v.slice(0, 10).forEach((x, i) => textos(x, `${prefixo}[${i}]`, nivel + 1));
    else if (typeof v === "object") Object.entries(v).slice(0, 20).forEach(([k, x]) => textos(x, `${prefixo}.${k}`, nivel + 1));
  };
  if (dados && typeof dados === "object" && !Array.isArray(dados)) {
    for (const k of CAMPOS_MENSAGEM) textos(dados[k], k);
  }
  return { status, tipo, campos, mensagens };
}

export function criarHinova(cfg, { fetchImpl = fetch, agora = Date.now } = {}) {
  let tokenUsuario = null;
  let tokenValidoAte = 0;

  const preencher = (modelo, valores) =>
    modelo.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(valores[k] ?? ""));

  async function chamar(metodo, caminho, { body, auth } = {}) {
    const r = await fetchImpl(cfg.baseUrl + caminho, {
      method: metodo,
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(cfg.timeoutMs)
    });
    const texto = await r.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch { dados = null; }
    return { status: r.status, dados };
  }

  async function autenticar(forcar = false) {
    if (cfg.modoAuth === "token") return cfg.token;
    if (!forcar && tokenUsuario && agora() < tokenValidoAte) return tokenUsuario;
    const { status, dados } = await chamar("POST", cfg.pathAutenticar, {
      auth: cfg.token,
      body: { usuario: cfg.usuario, senha: cfg.senha }
    });
    const t = pegar(dados, cfg.campos.tokenUsuario);
    if (status >= 400 || !t || typeof t !== "string") {
      const erro = new Error(`Hinova: falha na autenticação (HTTP ${status})`);
      erro.diagnostico = diagnosticar(status, dados);
      throw erro;
    }
    tokenUsuario = t;
    tokenValidoAte = agora() + TOKEN_TTL_MS;
    return t;
  }

  // GET autenticado, com uma nova tentativa se o token expirou
  async function get(caminho) {
    let auth = await autenticar();
    let resp = await chamar("GET", caminho, { auth });
    if (resp.status === 401 && cfg.modoAuth === "usuario") {
      auth = await autenticar(true);
      resp = await chamar("GET", caminho, { auth });
    }
    // A Hinova responde 404 ou 406 quando não encontra o registro
    if (resp.status === 404 || resp.status === 406) return { status: resp.status, dados: null };
    if (resp.status >= 400) {
      const erro = new Error(`Hinova: erro HTTP ${resp.status} em ${caminho.split("/").slice(0, 3).join("/")}`);
      erro.diagnostico = diagnosticar(resp.status, resp.dados);
      throw erro;
    }
    // Erro com HTTP 200 ({ error: ... }), como na autenticação
    if (resp.dados && typeof resp.dados === "object" && !Array.isArray(resp.dados) && resp.dados.error) {
      const erro = new Error(`Hinova: a API recusou a consulta em ${caminho.split("/").slice(0, 3).join("/")}`);
      erro.diagnostico = diagnosticar(resp.status, resp.dados);
      throw erro;
    }
    return resp;
  }

  async function buscarVeiculo(placa) {
    const { dados } = await get(preencher(cfg.pathVeiculo, { placa }));
    const lista = comoLista(dados);
    // Se vier mais de um, fica com o da placa informada
    return lista.find((v) => String(pegar(v, cfg.campos.placa) || "").toUpperCase().replace(/\W/g, "") === placa) || lista[0] || null;
  }

  async function buscarBoletoAberto(valores) {
    const { dados } = await get(preencher(cfg.pathBoletos, valores));
    const fechadas = cfg.situacoesFechadas.map(semAcento);
    const abertos = comoLista(dados).filter((b) => {
      const sit = semAcento(pegar(b, cfg.campos.situacao));
      return !fechadas.some((f) => sit.includes(f));
    });
    // O boleto em aberto com vencimento mais antigo é a 2ª via mais urgente
    abertos.sort((a, b) => dataNum(pegar(a, cfg.campos.vencimento)) - dataNum(pegar(b, cfg.campos.vencimento)));
    const b = abertos[0];
    if (!b) return null;
    return {
      vencimento: pegar(b, cfg.campos.vencimento),
      linhaDigitavel: pegar(b, cfg.campos.linhaDigitavel),
      link: pegar(b, cfg.campos.link),
      pix: pegar(b, cfg.campos.pix)
    };
  }

  // Fluxo completo: veículo → confere titular → boleto → telefone cadastrado
  async function consultar({ placa, cpf }) {
    const veiculo = await buscarVeiculo(placa);
    if (!veiculo) return { resultado: "veiculo_nao_encontrado" };

    const valores = {
      placa,
      cpf,
      codigo_veiculo: pegar(veiculo, cfg.campos.codigoVeiculo),
      codigo_associado: pegar(veiculo, cfg.campos.codigoAssociado)
    };
    const digitos = (v) => String(v || "").replace(/\D/g, "");
    let cpfTitular = digitos(pegar(veiculo, cfg.campos.cpf));
    let telefone = digitos(pegar(veiculo, cfg.campos.telefone));

    // Se o veículo não traz os dados do titular, busca o associado
    if ((!cpfTitular || !telefone) && cfg.pathAssociado) {
      const { dados } = await get(preencher(cfg.pathAssociado, valores));
      const associado = comoLista(dados)[0] || {};
      cpfTitular = cpfTitular || digitos(pegar(associado, cfg.campos.cpf));
      telefone = telefone || digitos(pegar(associado, cfg.campos.telefone));
    }

    if (cpfTitular !== cpf) return { resultado: "cpf_nao_confere" };

    const boleto = await buscarBoletoAberto(valores);
    if (!boleto) return { resultado: "sem_boleto_aberto" };
    if (!telefone) return { resultado: "sem_telefone" };
    return { resultado: "ok", telefone, boleto };
  }

  return { autenticar, buscarVeiculo, buscarBoletoAberto, consultar, _chamar: chamar, _get: get, _preencher: preencher };
}
