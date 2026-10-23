/*
 * Cliente do SGA Hinova (API v2).
 *
 * Autenticação (documentação oficial, "Autenticar Usuário"):
 *   POST /usuario/autenticar
 *     Authorization: Bearer {token gerado no SGA pela associação}  (HINOVA_TOKEN)
 *     { "usuario": "...", "senha": "..." }   (usuário ATIVO do SGA: HINOVA_USUARIO/HINOVA_SENHA)
 *   → { "mensagem": "OK", "token_usuario": "..." }, usado como Bearer nas demais requisições.
 *   O token_usuario NÃO expira: fica em memória e só é pedido de novo se a Hinova responder 401.
 *
 * HINOVA_AUTH=usuario faz esse fluxo. HINOVA_AUTH=token usa HINOVA_TOKEN direto nas consultas,
 * para quando ele já for um token_usuario obtido antes (como no n8n).
 *
 * Os caminhos e nomes de campos vêm da configuração (config.js) porque precisam
 * ser conferidos na documentação do SGA do cliente. Use "npm run testar-hinova".
 *
 * Placa e CPF chegam aqui já validados (validar.js) e entram codificados no
 * caminho (encodeURIComponent), nunca como texto livre.
 */
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
    if (!forcar && tokenUsuario) return tokenUsuario; // não expira (documentação)
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
    return t;
  }

  // Chamada autenticada (GET ou POST), com nova tentativa se o token de usuário expirou
  async function requisitar(metodo, caminho, body) {
    let auth = await autenticar();
    let resp = await chamar(metodo, caminho, { auth, body });
    if (resp.status === 401 && cfg.modoAuth === "usuario") {
      auth = await autenticar(true);
      resp = await chamar(metodo, caminho, { auth, body });
    }
    const rota = caminho.split("/").slice(0, 3).join("/");
    // A Hinova responde 404 ou 406 quando não encontra o registro
    if (resp.status === 404 || resp.status === 406) return { status: resp.status, dados: null };
    if (resp.status >= 400) {
      const erro = new Error(`Hinova: erro HTTP ${resp.status} em ${rota}`);
      erro.diagnostico = diagnosticar(resp.status, resp.dados);
      throw erro;
    }
    // Erro com HTTP 200 ({ error: ... }), como na autenticação
    if (resp.dados && typeof resp.dados === "object" && !Array.isArray(resp.dados) && resp.dados.error) {
      const erro = new Error(`Hinova: a API recusou a consulta em ${rota}`);
      erro.diagnostico = diagnosticar(resp.status, resp.dados);
      throw erro;
    }
    return resp;
  }
  const get = (caminho) => requisitar("GET", caminho);

  async function buscarVeiculo(placa) {
    const { dados } = await get(preencher(cfg.pathVeiculo, { placa }));
    const lista = comoLista(dados);
    // Se vier mais de um, fica com o da placa informada
    return lista.find((v) => String(pegar(v, cfg.campos.placa) || "").toUpperCase().replace(/\W/g, "") === placa) || lista[0] || null;
  }

  // Data dd/mm/aaaa no fuso de Brasília, deslocada em N dias
  const dataBr = (dias) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(agora() + dias * 86400000));

  // Lista os boletos do veículo, como no fluxo do n8n:
  // POST /listar/boleto-associado-veiculo { placa, data_vencimento_inicial, data_vencimento_final, link_boleto }
  async function listarBoletos(valores) {
    const caminho = preencher(cfg.pathBoletos, valores);
    const { dados } = cfg.metodoBoletos === "GET"
      ? await get(caminho)
      : await requisitar("POST", caminho, {
          placa: valores.placa,
          data_vencimento_inicial: dataBr(-cfg.boletoDiasAntes),
          data_vencimento_final: dataBr(cfg.boletoDiasDepois),
          link_boleto: true
        });
    return comoLista(dados);
  }

  async function buscarBoletoAberto(valores, listaPronta) {
    const fechadas = cfg.situacoesFechadas.map(semAcento);
    const abertos = (listaPronta || (await listarBoletos(valores))).filter((b) => {
      const sit = semAcento(pegar(b, cfg.campos.situacao));
      return !fechadas.some((f) => sit.includes(f));
    });
    // O boleto em aberto com vencimento mais antigo é a 2ª via mais urgente
    abertos.sort((a, b) => dataNum(pegar(a, cfg.campos.vencimento)) - dataNum(pegar(b, cfg.campos.vencimento)));
    let b = abertos[0];
    if (!b) return null;

    // Detalhe do boleto (GET /buscar/boleto/{número}) quando a lista não traz linha digitável/link/PIX
    const codigo = pegar(b, cfg.campos.codigoBoleto);
    const incompleto = !pegar(b, cfg.campos.linhaDigitavel) || !(pegar(b, cfg.campos.link) || pegar(b, cfg.campos.pix));
    if (incompleto && codigo && cfg.pathBoletoDetalhe) {
      const { dados } = await get(preencher(cfg.pathBoletoDetalhe, { ...valores, codigo_boleto: codigo }));
      const detalhe = comoLista(dados)[0];
      if (detalhe && typeof detalhe === "object") b = { ...b, ...detalhe };
    }
    return {
      vencimento: pegar(b, cfg.campos.vencimento),
      linhaDigitavel: pegar(b, cfg.campos.linhaDigitavel),
      link: pegar(b, cfg.campos.link),
      pix: pegar(b, cfg.campos.pix)
    };
  }

  const digitos = (v) => String(v || "").replace(/\D/g, "");

  // Fluxo completo: titular confere com o CPF → boleto em aberto → telefone cadastrado.
  // Com HINOVA_PATH_VEICULO vazio, usa só as rotas de boleto (CPF/telefone vêm da lista de boletos).
  async function consultar({ placa, cpf }) {
    const valores = { placa, cpf };
    let origem = null;
    let lista = null;

    if (cfg.pathVeiculo) {
      origem = await buscarVeiculo(placa);
      if (!origem) return { resultado: "veiculo_nao_encontrado" };
      valores.codigo_veiculo = pegar(origem, cfg.campos.codigoVeiculo);
      valores.codigo_associado = pegar(origem, cfg.campos.codigoAssociado);
    } else {
      lista = await listarBoletos(valores);
      if (!lista.length) return { resultado: "sem_boleto_no_periodo" };
      origem = lista[0];
    }

    let cpfTitular = digitos(pegar(origem, cfg.campos.cpf));
    let telefone = digitos(pegar(origem, cfg.campos.telefone));

    // Se não vieram os dados do titular, busca o associado
    if ((!cpfTitular || !telefone) && cfg.pathAssociado) {
      const { dados } = await get(preencher(cfg.pathAssociado, valores));
      const associado = comoLista(dados)[0] || {};
      cpfTitular = cpfTitular || digitos(pegar(associado, cfg.campos.cpf));
      telefone = telefone || digitos(pegar(associado, cfg.campos.telefone));
    }

    if (!cpfTitular) return { resultado: "cpf_titular_nao_encontrado" };
    if (cpfTitular !== cpf) return { resultado: "cpf_nao_confere" };

    const boleto = await buscarBoletoAberto(valores, lista);
    if (!boleto) return { resultado: "sem_boleto_aberto" };
    if (!telefone) return { resultado: "sem_telefone" };
    return { resultado: "ok", telefone, boleto };
  }

  return { autenticar, buscarVeiculo, listarBoletos, buscarBoletoAberto, consultar, _chamar: chamar, _get: get, _preencher: preencher };
}
