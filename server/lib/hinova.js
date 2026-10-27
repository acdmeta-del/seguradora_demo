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
 * REFERÊNCIA OBRIGATÓRIA: docs/api/hinova-sga-api-v2.md. Toda chamada nova ou alterada
 * deve seguir esse documento (caminhos, parâmetros, formatos, limites e regras de segurança).
 * Caminhos e nomes de campos ficam em config.js; "npm run testar-hinova" confere na prática.
 *
 * Placa e CPF chegam aqui já validados (validar.js) e entram codificados no
 * caminho (encodeURIComponent), nunca como texto livre.
 */
import { extrairTelefone } from "./whatsapp.js";
import { normalizarPlaca, finalPlaca } from "./validar.js";
import { formatarData, formatarValor, linhaDigitavel, linkSeguro, pixDoCampo } from "./formatar.js";
// Lê o primeiro campo existente de uma lista ("a", "a.b")
export function pegar(obj, caminhos) {
  const ler = (c) => c.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  for (const c of caminhos) {
    // "ddd_celular+telefone_celular": junta as partes, só se todas vierem como texto/número
    const v = c.includes("+")
      ? (() => {
          const partes = c.split("+").map((p) => ler(p.trim()));
          return partes.every((p) => typeof p === "string" ? p.trim() : typeof p === "number") ? partes.join("") : undefined;
        })()
      : ler(c);
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

// SÓ PARA DIAGNÓSTICO (testar-hinova): sugere nomes de campo para configurar.
// O fluxo real não usa esta busca; lê apenas os campos exatos de config.js.
// Procura, em até 3 níveis, o 1º campo cujo nome casa com os padrões e cujo valor é aceito.
export function procurarCampo(obj, padroes, aceitar) {
  for (const padrao of padroes) {
    const pilha = [[obj, "", 0]];
    while (pilha.length) {
      const [o, prefixo, nivel] = pilha.shift();
      if (!o || typeof o !== "object" || nivel > 3) continue;
      for (const [k, v] of Object.entries(o)) {
        const campo = prefixo + k;
        if (v && typeof v === "object") { pilha.push([v, campo + ".", nivel + 1]); continue; }
        if (padrao.test(k)) {
          const valor = aceitar(v);
          if (valor) return { valor, campo };
        }
      }
    }
  }
  return null;
}

const comoTextoSimples = (v) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
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
  // Documentação, seção 6: nova tentativa SÓ em GET de leitura e só em erro de rede ou 5xx,
  // com espera crescente (máx. cfg.tentativasGet). POST nunca é repetido automaticamente.
  async function chamarComTentativas(metodo, caminho, opcoes) {
    const max = metodo === "GET" ? Math.max(1, cfg.tentativasGet) : 1;
    for (let tentativa = 1; ; tentativa++) {
      try {
        const resp = await chamar(metodo, caminho, opcoes);
        if (resp.status < 500 || tentativa >= max) return resp;
      } catch (e) {
        if (tentativa >= max) throw e;
      }
      await new Promise((r) => setTimeout(r, 300 * 2 ** (tentativa - 1) + Math.random() * 200));
    }
  }

  async function requisitar(metodo, caminho, body) {
    let auth = await autenticar();
    let resp = await chamarComTentativas(metodo, caminho, { auth, body });
    if (resp.status === 401 && cfg.modoAuth === "usuario") {
      auth = await autenticar(true);
      resp = await chamarComTentativas(metodo, caminho, { auth, body });
    }
    const rota = caminho.split("/").slice(0, 3).join("/");
    // 404 = não encontrado. 406 é o formato de erro da API ({ mensagem, error: [...] }, documentação
    // seção 3): só conta como "não encontrado" quando a própria mensagem diz isso; senão é erro.
    if (resp.status === 404) return { status: 404, dados: null };
    if (resp.status === 406) {
      const textoErro = JSON.stringify(resp.dados || "");
      if (/n[ãa]o\s+(foi\s+)?encontrad|nenhum|sem\s+registro/i.test(textoErro)) return { status: 406, dados: null };
      const erro = new Error(`Hinova: erro HTTP 406 em ${rota}`);
      erro.diagnostico = diagnosticar(406, resp.dados);
      throw erro;
    }
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
          // Documentação (Boleto › listar/boleto-associado-veiculo): basta UM identificador.
          // Com placa: só aquele veículo. Sem placa: cpf_associado (string) → todos os veículos.
          ...(valores.placa ? { placa: valores.placa } : { cpf_associado: cpfParaBusca(valores.cpf) }),
          data_vencimento_inicial: dataBr(-cfg.boletoDiasAntes),
          data_vencimento_final: dataBr(cfg.boletoDiasDepois),
          link_boleto: true
        });
    return comoLista(dados);
  }

  // Boleto aberto = situação na lista de abertas E sem data de pagamento.
  // Sem situação conhecida, NÃO conta como aberto (na dúvida, não envia).
  function estaAberto(b) {
    const sit = semAcento(comoTextoSimples(pegar(b, cfg.campos.situacao)));
    const pago = comoTextoSimples(pegar(b, cfg.campos.dataPagamento));
    return Boolean(sit) && cfg.situacoesAbertas.map(semAcento).includes(sit) && !pago;
  }

  const cpfParaBusca = (cpf) => (cfg.formatoCpf === "mascara"
    ? String(cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
    : String(cpf));

  // Rótulo dos veículos cobertos pelo boleto, para o associado identificar na mensagem:
  // "CG 150 FAN ESDI · placa final 3D63". Só modelo e final da placa (nada de placa inteira).
  function veiculosDe(b) {
    const lista = pegar(b, cfg.campos.veiculos);
    return (Array.isArray(lista) ? lista : []).map((v) => {
      const modelo = comoTextoSimples(pegar(v, cfg.campos.veiculoModelo)).replace(/\s+/g, " ").slice(0, 40);
      const fim = finalPlaca(comoTextoSimples(pegar(v, cfg.campos.veiculoPlaca)));
      return [modelo, fim ? `placa final ${fim}` : ""].filter(Boolean).join(" · ");
    }).filter(Boolean);
  }

  // Boletos em aberto, do vencimento mais antigo ao mais novo, sem repetir o mesmo nosso_numero.
  // Só serve boleto com linha digitável ou PIX (consulta o detalhe se a lista não trouxer).
  async function buscarBoletosAbertos(valores, listaPronta, max = 1) {
    const vistos = new Set();
    const abertos = (listaPronta || (await listarBoletos(valores))).filter(estaAberto).filter((b) => {
      const n = comoTextoSimples(pegar(b, cfg.campos.codigoBoleto));
      if (n && vistos.has(n)) return false;
      if (n) vistos.add(n);
      return true;
    });
    abertos.sort((a, b) => dataNum(pegar(a, cfg.campos.vencimento)) - dataNum(pegar(b, cfg.campos.vencimento)));

    const escolhidos = [];
    for (const candidato of abertos.slice(0, max + 2)) {
      if (escolhidos.length >= max) break;
      let b = candidato;
      // Detalhe (GET /buscar/boleto/:nosso_numero) quando a lista não traz linha digitável ou PIX
      const codigo = pegar(b, cfg.campos.codigoBoleto);
      const incompleto = !linhaDigitavel(pegar(b, cfg.campos.linhaDigitavel)) || !pixDoCampo(b, cfg.campos.pix).pix;
      if (incompleto && codigo && cfg.pathBoletoDetalhe) {
        const { dados } = await get(preencher(cfg.pathBoletoDetalhe, { ...valores, nosso_numero: codigo }));
        const detalhe = comoLista(dados)[0];
        if (detalhe && typeof detalhe === "object") b = { ...b, ...detalhe };
      }
      // Campos exatos, convertidos e validados (formatar.js): o que não for válido fica de fora
      const pix = pixDoCampo(b, cfg.campos.pix);
      const linha = linhaDigitavel(pegar(b, cfg.campos.linhaDigitavel));
      if (!linha && !pix.pix) continue;
      const alertas = [];
      if (pix.presente && !pix.pix) alertas.push(`PIX no campo "${pix.campo}" não é um código válido; enviado sem PIX`);
      if (!pix.presente) alertas.push(`campo de PIX (${cfg.campos.pix.join(" | ")}) não veio na resposta; enviado sem PIX`);
      escolhidos.push({
        vencimento: formatarData(pegar(b, cfg.campos.vencimento)),
        valor: formatarValor(pegar(b, cfg.campos.valor)),
        linhaDigitavel: linha,
        link: linkSeguro(pegar(b, cfg.campos.link)),
        pix: pix.pix,
        veiculos: veiculosDe(candidato).length ? veiculosDe(candidato) : veiculosDe(b),
        alertas
      });
    }
    return escolhidos;
  }

  async function buscarBoletoAberto(valores, listaPronta) {
    return (await buscarBoletosAbertos(valores, listaPronta, 1))[0] || null;
  }

  const digitos = (v) => String(v || "").replace(/\D/g, "");

  // Fluxo completo: titular confere com o CPF → boleto em aberto → telefone cadastrado.
  // Com HINOVA_PATH_VEICULO vazio, usa só as rotas de boleto (CPF/telefone vêm da lista de boletos).
  // CPF e telefone do titular num registro, lidos SOMENTE dos campos configurados
  // (HINOVA_CAMPO_CPF, HINOVA_CAMPO_TELEFONE). Sem busca por nomes parecidos: um campo
  // errado poderia mandar o boleto para o número de outra pessoa.
  function titularDe(obj) {
    return {
      cpf: digitos(pegar(obj, cfg.campos.cpf)),
      telefone: extrairTelefone(pegar(obj, cfg.campos.telefone)) || ""
    };
  }

  // Fluxo igual ao do n8n do cliente:
  //   1. POST /listar/boleto-associado-veiculo (placa + período) → CPF do titular e telefone
  //   2. confere o CPF informado com o do titular (só segue com os boletos desse CPF)
  //   3. boleto em aberto → GET /buscar/boleto/{nosso_numero} → linha digitável e PIX
  // Veículo (HINOVA_PATH_VEICULO) e associado (HINOVA_PATH_ASSOCIADO) só são consultados
  // se a lista não trouxer o CPF ou o telefone.
  async function consultar({ placa, cpf }) {
    const valores = { placa, cpf };
    const lista = await listarBoletos(valores);
    if (!lista.length) return { resultado: "sem_boleto_no_periodo" };

    const dados = lista.map(titularDe);
    const comCpf = dados.filter((d) => d.cpf);
    let cpfTitular = comCpf.length ? (comCpf.some((d) => d.cpf === cpf) ? cpf : comCpf[0].cpf) : "";
    // Só os boletos do CPF informado (ou sem CPF no registro) seguem adiante
    const doTitular = lista.filter((_, i) => !dados[i].cpf || dados[i].cpf === cpf);
    let telefone = (dados.find((d, i) => d.telefone && doTitular.includes(lista[i])) || {}).telefone || "";

    // Reservas: veículo e associado, só para completar o que faltou. Sem placa no pedido,
    // usa a placa de um veículo da própria lista de boletos desse CPF.
    const placaDaLista = () => {
      for (const b of doTitular) {
        const veiculos = pegar(b, cfg.campos.veiculos);
        for (const v of Array.isArray(veiculos) ? veiculos : []) {
          const p = normalizarPlaca(comoTextoSimples(pegar(v, cfg.campos.veiculoPlaca)));
          if (p) return p;
        }
      }
      return null;
    };
    const placaReserva = placa || placaDaLista();
    if ((!cpfTitular || !telefone) && cfg.pathVeiculo && placaReserva) {
      const veiculo = await buscarVeiculo(placaReserva);
      if (veiculo) {
        valores.codigo_veiculo = pegar(veiculo, cfg.campos.codigoVeiculo);
        valores.codigo_associado = pegar(veiculo, cfg.campos.codigoAssociado);
        const t = titularDe(veiculo);
        cpfTitular = cpfTitular || t.cpf;
        telefone = telefone || t.telefone;
      }
    }
    if ((!cpfTitular || !telefone) && cfg.pathAssociado) {
      const { dados: resp } = await get(preencher(cfg.pathAssociado, valores));
      const t = titularDe(comoLista(resp)[0] || {});
      cpfTitular = cpfTitular || t.cpf;
      telefone = telefone || t.telefone;
    }

    if (!cpfTitular) return { resultado: "cpf_titular_nao_encontrado" };
    if (cpfTitular !== cpf) return { resultado: "cpf_nao_confere" };

    // Com placa: o boleto daquele veículo. Só CPF: todos os abertos (até maxBoletosCpf).
    const boletos = await buscarBoletosAbertos(valores, doTitular, placa ? 1 : Math.max(1, cfg.maxBoletosCpf));
    if (!boletos.length) return { resultado: "sem_boleto_aberto" };
    if (!telefone) return { resultado: "sem_telefone" };
    return { resultado: "ok", telefone, boleto: boletos[0], boletos };
  }

  return { autenticar, buscarVeiculo, listarBoletos, buscarBoletoAberto, buscarBoletosAbertos, consultar, titularDe, estaAberto, _chamar: chamar, _get: get, _preencher: preencher };
}
