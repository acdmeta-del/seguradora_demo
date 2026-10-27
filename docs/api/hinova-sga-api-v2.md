# API SGA Hinova v2: Documentação de referência para agentes (Claude Code)

> Fonte: documentação oficial gerada por apiDoc em `https://api.hinova.com.br/api/sga/v2/doc/` (projeto "API SGA Hinova", versão 2.0.0, 190 endpoints, 19 módulos). Este arquivo é uma **condensação otimizada para leitura por LLM**: mesmo conteúdo funcional, sem HTML, com parâmetros em lista, respostas em formato compacto e as inconsistências da documentação original sinalizadas. Quando houver dúvida entre este arquivo e a resposta real da API, **a API real vence**. API de integração com o **SGA (Sistema de Gestão de Associações) da Hinova Soluções Digitais**, usado por associações de proteção veicular: associados, beneficiários, veículos, produtos/cotas, boletos, eventos (sinistros), vistorias, voluntários (vendedores) e financeiro (MGF).

---

## 0\. Regras de ouro para o agente

1. **Base URL**: `https://api.hinova.com.br/api/sga/v2`. Monte a URL como `BASE + "/" + caminho` sem barra duplicada (138 dos 190 caminhos na doc original vêm SEM barra inicial).  
2. **Dois tokens diferentes**: (a) *token do SGA* (gerado no painel, usado SÓ para autenticar) e (b) `token_usuario` (retornado por `POST /usuario/autenticar`, usado em TODAS as outras chamadas). Ver seção 1\.  
3. **Todo o resto da API exige** `Authorization: Bearer {token_usuario}` e `Content-Type: application/json`.  
4. **Nunca coloque** token, usuário ou senha em código, logs, commits ou nesta documentação. Use variáveis de ambiente (`HINOVA_TOKEN_SGA`, `HINOVA_USUARIO`, `HINOVA_SENHA`, `HINOVA_TOKEN_USUARIO`).  
5. **Dados pessoais (LGPD)**: respostas trazem CPF, RG, CNH, endereço, telefone, e-mail. Não logue payloads completos, não copie para fixtures versionadas, mascare em relatórios.  
6. **Alguns GET alteram/apagam dados** (ver seção 5). Nunca chame esses endpoints para "testar", em loops, em prefetch ou com retry automático sem confirmação do usuário.  
7. **Antes de qualquer escrita** (POST/DELETE e os GET destrutivos) em ambiente real, confirme com o usuário. Não há ambiente sandbox documentado.  
8. A doc **não documenta**: limites de taxa (rate limit), códigos de erro por endpoint, formato padrão de erro, idempotência, ambiente de testes. Trate erros de forma defensiva (seção 6).

---

## 1\. Autenticação (fluxo completo)

**Passo 1, gerar o token do SGA (manual, uma vez, feito pela associação):** SGA → menu *Área Cliente \> APIs \> Gerenciar APIs* → botão **Novo** → escolher o **Interveniente** (`Associação`, `Parceiro` ou `Grupo Hinova`, conforme o tipo de integração) → definir *Apelido do Token* → *Permitir Acesso* \= **SIM** (serve para inativar o token depois) → na lista de endpoints, **liberar cada endpoint** que a integração vai usar. É necessário também um **usuário exclusivo para integração** (usuário ATIVO do SGA).

**Passo 2, obter o token de acesso:**

POST {BASE}/usuario/autenticar

Content-Type: application/json

Authorization: Bearer {TOKEN\_DO\_SGA}

{"usuario": "\<usuario\_integracao\>", "senha": "\<senha\>"}

Resposta `200`: `{"mensagem":"OK","token_usuario":"<hash>"}`

**Passo 3, usar o `token_usuario` em todo o resto:**

GET {BASE}/listar/regional/ativo

Content-Type: application/json

Authorization: Bearer {token\_usuario}

Pontos importantes:

- O `token_usuario` **não expira** ("não é necessário fazer nova autenticação antes de cada requisição"). Autentique uma vez, guarde em segredo e reutilize. Se for revogado/inativado no SGA, reautentique.  
- As **permissões são por endpoint no token** (passo 1\) e **por usuário** (regional/cooperativa). Endpoints não liberados falham (o código HTTP exato não é documentado). Endpoints `*-por-permissao` validam as permissões de regional/cooperativa do usuário.  
- 4 endpoints não documentam o header (`POST /alterar/beneficio`, `POST /beneficiario/vincular-beneficio`, `POST /vincular-remover/beneficio`, `POST /veiculo/vincular-remover/produto`). Envie o header padrão mesmo assim.

---

## 2\. Como ler este arquivo

Cada endpoint segue o formato:

\#\#\# MÉTODO /caminho/:param — Título

Descrição (se houver)

Params:            (campos de entrada: path, query/body)

\- \`campo\` (Tipo, req\|opt): descrição

Resp:              (campos de saída documentados, quando existem)

ReqEx: ...         (corpo de exemplo, em forma compacta)

RespEx: \[200\] ...  (resposta de exemplo, em forma compacta)

- **`req` / `opt`** \= obrigatório / opcional **como declarado na doc** (nem sempre confiável, ver seção 5; leia a descrição).  
- **Parâmetros `:nome` no caminho** são *path params* (substituem o `:nome` na URL). Nos GET, todos os `Params:` são path params. Nos POST, `Params:` são campos do corpo JSON (a menos que o caminho tenha `:param`).  
- **Respostas compactas** (valores de exemplo removidos, pois são máscaras fictícias como `"9999"`): `s` \= string, `n` \= número, `b` \= booleano, `{...}` objeto, `[{...}]` lista de objetos, `"LITERAL"` \= valor de exemplo relevante (enum/formato). `"yyyy-mm-dd"` indica formato de data.  
- `keys~ a,b,c` / lista sem tipos \= apenas nomes dos campos (o exemplo original era inválido ou muito extenso).  
- `(idêntico a X)` \= o mesmo método+caminho aparece em outro módulo com conteúdo igual.  
- `(sic)` \= erro de grafia presente na API real; **use exatamente assim**.  
- Tokens de texto repetido (expandidos abaixo):

| Token | Significado |
| :---- | :---- |
| `[SITUACAO]` | Path param `situacao` (String): `todos` (ativos e inativos), `ativo` ou `inativo`. Sempre obrigatório nos endpoints `listar/*/:situacao`. |
| `[QTD_PAG]` | `quantidade_por_pagina` (Number): registros por página. Se omitido, vale o limite padrão do endpoint (varia: 100, 1000, 5000). |
| `[INICIO_PAG_OFFSET]` | `inicio_paginacao` como **OFFSET em itens**. Com `quantidade_por_pagina=1000`: página 1 \= 0, página 2 \= 1000, página 3 \= 2000\. Omitido \= começa do primeiro item. |
| `[INICIO_PAG_PAGINA]` | `inicio_paginacao` como **índice de página**: começa em 0 e soma 1 a cada página. Omitido \= primeira página. |
| `[DT_INI]` / `[DT_FIM]` | Data inicial / final da pesquisa. Formato `dd/mm/yyyy`. |
| `[MASC_TEL]` | Telefone aceita: `99999999999`, `99 999999999`, `99 99999-9999`, `(99) 99999-9999`. |
| `[MASC_CEP]` | CEP aceita: `99999-999`, `99.999-999` ou só números. |
| `[ESTADO]` | Estado: informar a DESCRIÇÃO ("Minas Gerais") ou a SIGLA ("MG"). |

> ATENÇÃO à paginação: os dois sentidos de `inicio_paginacao` coexistem na API. O módulo de cada endpoint indica qual vale (OFFSET vs PÁGINA). Em respostas paginadas costumam vir `total_*`, `mostrando`, `numero_paginas`, `pagina_corrente`.

---

## 3\. Convenções transversais

**Formatos**

- Datas **na requisição**: `dd/mm/yyyy` (padrão). Exceções: `POST /listar/veiculo` e `/listar-por-permissao/veiculo` usam `Y-m-d`; `mes_referente` usa `mm/yyyy`; algumas descrições citam `d/m/a`.  
- Datas **na resposta**: normalmente `yyyy-mm-dd`; há variações (`yyyy/mm/dd`, ISO com fuso `yyyy-mm-ddT00:00:00-0300`).  
- Valores monetários **na requisição** costumam ser string com vírgula (`"99,99"`, `"100,00"`); na resposta, string/número com ponto (`"9.99"`). Alguns campos (`valor_fipe`, `valor_fipe_protegido`, `valor_adesao`) citam máscara `999999.99`. Em caso de erro de valor, teste os dois formatos com um registro inócuo.  
- Flags booleanas são strings: `"Y"`/`"N"` (ou `SIM`/`NAO` em retornos). Exceções reais booleanas: `link_boleto` (bool), `aceito` (Boolean) em termo.  
- Documentos aceitam com ou sem máscara: CPF/CNPJ `999.999.999-99`, `99.999.999/9999-99` ou só números. **Envie CPF como string**, mesmo onde a doc tipa como Number.  
- `codigo_*` são identificadores internos do SGA (inteiros, frequentemente devolvidos como string).  
- Câmbio do veículo: `A` automático, `M` manual, `0` não informado. `forma_pagamento_repasse` e `formato_cobranca` (respostas de cota/produto): `"R$"` ou `"%"`; em voluntário `formato_pagamento`: `"R"` ou `"%"`; em `POST /veiculo/cadastrar` `formato_cobranca` aceita `B` ou `C`.

**Códigos HTTP e corpo**

- Sucesso observado: `200`, `207` (rotulado "207 OK" em várias alterações/remoções, não é multi-status real: trate qualquer 2xx como sucesso e valide `mensagem`), `204` (lista vazia de fornecedores).  
- Erro observado: `406` com `{"mensagem": "...", "error": ["..."]}` (em `POST /listar/evento`). Nenhum endpoint documenta seção de erro; presuma esse formato como padrão e sempre logue status \+ corpo (sem dados pessoais).  
- Respostas de escrita trazem `mensagem` (ex.: `"OK"`) e o código criado (`codigo_associado`, `codigo_veiculo`, `nosso_numero`...). **Guarde sempre esse código.**

**Janelas e limites documentados**

| Endpoint | Limite |
| :---- | :---- |
| `POST /listar/alteracao-associados/`, `/listar/alteracao-historico-atendimento/`, `/listar/alteracao-veiculos`, `/listar/alteracao-voluntario/` | intervalo de até **7 dias** |
| `POST /listar/boleto-associado/periodo` | intervalo de até **31 dias** (exige ao menos um par de datas) |
| `POST /listar/boleto-associado-veiculo` | intervalo de até **90 dias** |
| `POST /listar/evento` | `data_cadastro_final` com intervalo máximo de **30 dias** |
| `POST /listar/veiculo`, `/listar-por-permissao/veiculo` | máx. **5000** por requisição |
| `POST /listar/historico-atendimento-associado` | máx. **5000** |
| `GET /listar/voluntario/:situacao/:pagina` | **5000** por página (página inicia em 0\) |
| `POST /veiculo/listar-observacao`, `POST /mgf-lancamento/listar` | máx. **1000** |
| `POST /modelo/listar` | máx. **200** |
| `POST /listar/evento`, `/listar/alteracao-eventos` | padrão **100** por página |
| `POST /veiculo/foto/cadastrar`, `/historico-atendimento-associado/foto/cadastrar` | máx. **50 fotos** por requisição (.png .jpeg .jpg .pdf; URL `link` OU `binario`) |

**Padrão de "buscar" x "buscar-por-permissao" / "listar" x "listar-por-permissao"**: a variante `-por-permissao` aplica as permissões de regional e cooperativa do usuário da integração. Use-a quando o usuário tiver acesso restrito.

---

## 4\. Modelo de domínio (glossário)

- **Associado**: titular do contrato (pessoa física/jurídica). Tem situação (ATIVO, PENDENTE, EXCLUÍDO...), vencimento, regional, cooperativa, voluntário, cartão recorrente.  
- **Beneficiário**: dependente/agregado de pessoa vinculado a um associado (`codigo_associado`); pode ser promovido a associado (`GET /alterar/beneficiario-para-associado/:codigo_ou_cpf`). Recebe **benefícios** (planos/serviços).  
- **Veículo**: item protegido de um associado. Tem FIPE (`codigo_fipe`, `valor_fipe`), **cota** de participação, **produtos** (coberturas/taxas), **implementos**, **agregados** (outros veículos vinculados, ex.: carreta), situação, voluntário indicador.  
- **Cota**: tabela de participação/adesão por faixa FIPE ou cilindrada, tipo de veículo, regional e cooperativa. **Produto**: item cobrado (pode ser `compulsorio`, `padrao`); **grupo de produto** agrupa produtos; **produto adicional**: cobrança avulsa por veículo com período (`mes_referente`..`mes_referente_final`).  
- **Regional / Cooperativa**: divisões organizacionais. Permissões do usuário são limitadas por elas.  
- **Voluntário**: consultor/vendedor que indica adesões (comissão em `R`/`%`), vinculado a cooperativas; **Indicação** (veículo indicador ganha 1 ponto) e **Indicação Externa**.  
- **Boleto**: cobrança identificada por `nosso_numero` (e `codigo_boleto`); tem situação, tipo (ex.: FECHAMENTO), forma de pagamento, tipo de cobrança recorrente, PIX (`pix.qrcode`, copia e cola), taxas e produtos. **Carnê**: vários boletos via `array_parcela`.  
- **Evento**: sinistro/ocorrência (protocolo, situação, motivo, classificação, associado, veículo, condutor). **Acionamento de fornecedor**: serviço (guincho, oficina...) acionado.  
- **Vistoria**: inspeção do veículo (tipo, vistoriador, pneus, fotos, avarias).  
- **Termo**: documento emitido (PDF) com aceite digital.  
- **MGF**: módulo financeiro (lançamentos, contas a pagar/receber, parcelas, caixas, contas bancárias, operações/sub-operações).  
- **Rateio**: divisão dos custos de eventos entre associados (`/buscar/rateio-medio`, `gerar_cobranca_rateio`).

---

## 5\. Armadilhas e inconsistências da documentação (leia antes de codar)

**5.1 GET que modificam/excluem dados**

- `GET /mgf-lancamento/excluir/:codigo_lancamento`: **exclui** lançamento financeiro.  
- `GET /associado/alterar-situacao-para/:codigo_situacao/:codigo_associado` e `GET /veiculo/alterar-situacao-para/:codigo_situacao/:codigo_veiculo`: mudam a situação do cadastro (tratar como operação de escrita).  
- `GET /produto-adicional/remover/:codigo_veiculo/:codigo_produto_adicional`: remove cobrança.  
- `GET /alterar/beneficiario-para-associado/:codigo_ou_cpf`: converte cadastro.  
- Inverso: `POST /buscar/cliente/:CodigoOuCpf` é uma leitura via POST (parâmetro no path).  
- `DELETE /historico-atendimento/:codigo_historico_atendimento` é o único DELETE.

**5.2 Endpoints sensíveis**

- `GET /associado/buscar-por-cpf-senha/:cpf/:senha`: CPF e **senha do associado na URL** (vai para logs de proxy/servidor). Evite; se inevitável, nunca logue a URL.  
- `POST /associado/alterar-senha`: **reseta a senha do associado para o CPF** (opcional `enviar_email`).  
- Cartão de crédito: a API só trata `hash`, `numero_final_cartao` (últimos dígitos), `codigo_cartao`, `validade`. **Nunca** envie ou armazene número completo de cartão (PCI-DSS). Cadastro de cartão é feito pela URL de `GET /associado/gerar-url-cadastro-cartao/:codigo_associado/:cpf`.

**5.3 Campos obrigatórios/tipos pouco confiáveis**

- `POST /listar/evento`: `data_cadastro` e `protocolo` aparecem ambos `req`, mas são alternativos (protocolo anula a data).  
- `POST /listar/boleto-associado-veiculo`: todos os identificadores aparecem `req`; na prática basta UM (código/CPF do associado ou código/placa do veículo) \+ um par de datas.  
- `POST /proprietario/cadastrar`: todos os campos `req` na doc (inclusive `idade`, `cnh`, telefones).  
- `POST /beneficiario/cadastrar`: `complemento` aparece `req`.  
- `POST /alterar/beneficiario`: `cpf` aparece `req` mas a descrição diz "opcional se enviar o código".  
- `POST /associado/cadastrar`: `codigo_regional`, `codigo_cooperativa`, `codigo_profissao` aparecem opcionais na doc (confirme na prática se a sua associação exige); `codigo_conta` é obrigatório se a regional tiver mais de uma conta.  
- Vários campos de CPF/placa/chassi são tipados `Number` na doc: **envie como string**.  
- `POST /veiculo/incluir/produto-adicional`: `codigo_classificacao` marcado `req` mas descrito como "Opcional".

**5.4 Erros de grafia que valem na prática (use exatamente)** `codigo_benficiario` (alterar-senha), `benficiarios` (chave da resposta de listar/buscar beneficiário), `beneficos` (resposta de beneficiario/cadastrar), `codigobeneficiario` (resposta de vincular-beneficio), `decricao_beneficio`, `decricao_produto` (respostas), `codigo_atedimento` (parâmetro de foto de atendimento; o exemplo usa `codigo_atendimento`: teste), `data_pagamento_finalww` (provável `data_pagamento_final` em listar/boleto-associado-veiculo), `:cpdOuCodigo` (path de buscar voluntário), `mostrando`  com espaço no final (resposta de listar associado/beneficiário), `/listar/placas-por-voluntario/` (exemplo usa `data_pesquisa_inicial/final`, parâmetros descritos são `data_cadastro_*`/`data_contrato_*`). Em `POST /alterar/historico-atendimento-associado` o campo chave é `codigo_historico_atendimento`, mas a descrição o chama de "código do associado atendido" (é o código do atendimento).

**5.5 Duplicatas entre módulos**: os mesmos método+caminho aparecem em mais de um módulo (`GET /listar/situacao/:situacao`, `/listar/estadocivil/:situacao`, `/listar/parentesco/:situacao`, `/listar/profissao/:situacao`, `/listar/vencimento/:situacao`, `/listar/conta/:situacao`, `/listar/forma-pagamento/:situacao`). É o mesmo endpoint; a resposta de `/listar/conta/:situacao` varia levemente por módulo (campos extras `considerado_inadimplencia`, `hinova_bank`, `apelido`). Referências de `{aqui}` nas descrições de `codigo_tipo_boleto`/`codigo_tipo_cobranca_recorrente` apontam para `GET /listar/tipo-boleto/:situacao` e `GET /tipo-cobranca-recorrente/listar/:situacao`.

**5.6 Exemplos que não batem com o tipo real**: vários "RespEx" mostram um objeto único em endpoints de lista; na prática a resposta de lista é **array** (ou objeto com array interno, quando paginado). Escreva parsers tolerantes aos dois formatos. Em `POST /listar/alteracao-historico-atendimento/` a descrição de `inicio_paginacao` é cópia errada da de `ultima_alteracao` (use como índice de página).

**5.7 Upsert escondido**: `POST /voluntario/cadastrar` com CPF já existente **altera** o voluntário (sem mexer em cooperativas). Os demais `cadastrar` não documentam idempotência: não repita POST de cadastro após timeout sem antes consultar (buscar por CPF/placa/chassi) para evitar duplicidade.

---

## 6\. Recomendações de implementação (cliente)

- **Cliente HTTP único** com `base_url`, timeouts (connect 10 s, read 60 s para listas grandes), headers padrão e *redaction* de `Authorization` e de CPF/senha em logs.  
- **Autentique uma vez** (cache em segredo/arquivo protegido); reautentique apenas em 401\.  
- **Retry** só para GET de leitura e apenas em erros de rede/5xx (backoff exponencial com jitter, máx. 3). **Nunca** retry automático em POST/DELETE nem nos GET destrutivos da seção 5.1.  
- **Paginação**: escreva um helper por estilo (OFFSET e PÁGINA). Pare quando a lista vier vazia ou quando `pagina_corrente >= numero_paginas`. Respeite os tetos da seção 3\.  
- **Sincronização incremental**: use `POST /listar/alteracao-*` em janelas de ≤ 7 dias com `campos` (nomes dos campos a monitorar) e `ultima_alteracao:"Y"`.  
- **Lookups em cache**: tabelas pequenas (`/listar/situacao`, `/listar/combustivel`, `/listar/cor`, `/listar/tipo-veiculo`, `/listar/regional`, `/listar/conta`...) mudam raramente: cache por horas.  
- **Valide a entrada** antes de enviar: máscaras de CPF/CNPJ/CEP/telefone, datas `dd/mm/yyyy`, enum `Y/N`.  
- **Parsers tolerantes**: aceitar string ou número em `codigo_*`; objeto único ou array; chaves com typos listadas na seção 5.4; campos ausentes/`null`.  
- **Testes**: não há sandbox. Use apenas leituras em testes de integração, com um registro de teste conhecido, e mocks para escrita.

Esqueleto mínimo (Python):

import os, requests

BASE \= "https\://api.hinova.com.br/api/sga/v2"

def auth() \-\> str:

    r \= requests.post(f"{BASE}/usuario/autenticar",

        headers={"Authorization": f"Bearer {os.environ\['HINOVA\_TOKEN\_SGA'\]}", "Content-Type": "application/json"},

        json={"usuario": os.environ\["HINOVA\_USUARIO"\], "senha": os.environ\["HINOVA\_SENHA"\]}, timeout=30)

    r.raise\_for\_status()

    return r.json()\["token\_usuario"\]

class Sga:

    def \_\_init\_\_(self, token: str):

        self.s \= requests.Session()

        self.s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})

    def get(self, path: str):

        r \= self.s.get(f"{BASE}/{path.lstrip('/')}", timeout=60); r.raise\_for\_status(); return r.json() if r.content else None

    def post(self, path: str, body: dict):

        r \= self.s.post(f"{BASE}/{path.lstrip('/')}", json=body, timeout=60); r.raise\_for\_status(); return r.json() if r.content else None

---

## 7\. Fluxos típicos (receitas)

**7.1 Cadastrar associado \+ veículo \+ cobrança**

1. Lookups: `GET /listar/regional/ativo`, `/listar/cooperativa/ativo`, `/listar/conta/ativo`, `/listar/profissao/ativo`, `/midia/listar/ativo`, `/listar/voluntario/ativo/0`.  
2. `POST /associado/cadastrar` → guarde `codigo_associado`. (Opcional: `beneficios`.)  
3. Lookups do veículo: `GET /listar/tipo-veiculo/ativo`, `/listar/categoria-veiculo/:codigo_tipo/ativo`, `/listar/combustivel/ativo`, `/listar/cor/ativo`, `/listar/alienacao/ativo`, `/tipo-adesao/listar/ativo`, `/listar/cota/:regional/:cooperativa/:tipo/:valor_fipe/:cilindrada` (devolve `codigo_cota`), `/listar/produto/:regional/:cooperativa/:tipo/:valor_fipe/:cilindrada`.  
4. `POST /veiculo/cadastrar` → guarde `codigo_veiculo` (produtos compulsórios entram automaticamente).  
5. (Opcional) `POST /veiculo/foto/cadastrar`, `POST /vincular/implemento`, `POST /termo/emitir` \+ `POST /termo/novo-aceite-digital/`.  
6. Cobrança: `POST /boleto/cadastrar` (`array_parcela` \+ `referencia`), ou deixe o SGA gerar no fechamento.

**7.2 Consultar situação financeira / inadimplência**

- Por veículo: `GET /buscar/situacao-financeira-veiculo/:codigo_ou_placa` (`ADIMPLENTE`...).  
- Boletos por período: `POST /listar/boleto-associado/periodo` (≤ 31 dias) ou por associado/veículo `POST /listar/boleto-associado-veiculo` (≤ 90 dias); detalhe: `GET /buscar/boleto/:nosso_numero`; reemissão/alteração: `POST /alterar/vencimento-boleto`, `POST /boleto/manutencao`, PDFs/PIX: `POST /processa-pdf/boleto`.

**7.3 Sincronizar alterações (ETL)**: `POST /listar/alteracao-associados/` \| `-veiculos` \| `-eventos` \| `-voluntario/` \| `/boleto/listar-alteracao`, em janelas de 7 dias, depois `GET /associado/buscar/...` ou `GET /veiculo/buscar/...` para o estado atual.

**7.4 Painel de eventos (sinistros)**: `POST /evento-aberto/listar`, `/evento-finalizado/listar` (contagens por período), `POST /listar/evento` (detalhe), `GET /evento-sem-alteracao/listar/:dias/:codigo_situacao` (atrasados), `GET /veiculo-reparo-oficina/listar`.

**7.5 Comissionamento de voluntários**: `GET /listar/situacao-adesao-voluntario/:codigo_voluntario`, `POST /listar/placas-por-voluntario/`, `POST /listar/indicacao/`.

**7.6 Trocar titularidade de veículo**: `POST /alterar/veiculo` com novo `codigo_associado` e `transferir_agregados` (array de agregados que acompanham).

---

## 8\. Índice de endpoints

| Módulo | Método | Caminho | Título |
| :---- | :---- | :---- | :---- |
| Autenticacao | POST | `/usuario/autenticar` | Autenticar Usuário |
| Associado | POST | `/alterar/associado` | Alterar |
| Associado | GET | `/associado/alterar-situacao-para/:codigo_situacao/:codigo_associado` | Alterar situação |
| Associado | POST | `/associado/alterar-senha` | Alterar a senha |
| Associado | GET | `/associado/buscar-por-cpf-senha/:cpf/:senha` | Buscar Por CPF-CNPJ e Senha |
| Associado | GET | `/associado/buscar/:cpfOuCodigo/:buscar_por` | Buscar |
| Associado | GET | `/associado/buscar-por-permissao/:cpfOuCodigo/:buscar_por` | Buscar por permissao |
| Associado | GET | `/buscar/situacao-associado/:cpfOuCnpj` | Buscar Situação Associado |
| Associado | POST | `/associado/cadastrar` | Cadastrar |
| Associado | GET | `/associado/gerar-url-cadastro-cartao/:codigo_associado/:cpf` | Gerar URL Cadastro Cartão |
| Associado | POST | `/listar/alteracao-associados/` | Listar Alterações de Associados |
| Associado | GET | `/associado/aniversariante` | Listar Aniversariante Dia |
| Associado | POST | `/listar/associado` | Listar |
| Associado | GET | `/associado/cartao/listar/:codigoOuCpf` | Buscar Cartões associado |
| Associado | GET | `/listar/classificacao-associado/:situacao` | Listar Classificação |
| Associado | GET | `/listar/estadocivil/:situacao` | Listar Estados Civis |
| Associado | GET | `/midia/listar/:situacao` | Listar Mídia |
| Associado | GET | `/listar/parentesco/:situacao` | Listar Parentescos |
| Associado | GET | `/listar/profissao/:situacao` | Listar Profissões |
| Associado | GET | `/associado/novos-contratos/listar` | Listar a quantidade de contratos |
| Associado | GET | `/listar/situacao/:situacao` | Listar Situação |
| Associado | GET | `/listar/situacaomotivo/:situacao` | Listar Situação Motivo |
| Associado | GET | `/listar/vencimento/:situacao` | Listar Vencimentos |
| Associado | GET | `/listar/associado/contatos/:cpfOuCodigo` | Lista Contatos |
| Associado | GET | `/listar/associado/endereco/:cpfOuCodigo` | Lista Endereco |
| Associado | POST | `/listar-por-permissao/associado` | Listar por permissão |
| Associado | GET | `/associado-ativo-inativo/listar` | Quant. Associado Ativo/Inativo |
| Associado | POST | `/campos-opcionais/listar` | Lista os Campos opcionais |
| Associado | POST | `/campos-opcionais/vincular` | Vincula Campos opcionais |
| Atendimento | POST | `/alterar/historico-atendimento-associado` | Alterar Hist. Associado |
| Atendimento | GET | `/buscar/historico-atendimento-associado/:cpf` | Busca Hist. Associado |
| Atendimento | POST | `/historico-atendimento-associado/foto/cadastrar` | Cadastrar foto/documento |
| Atendimento | POST | `/cadastrar/historico-atendimento-associado` | Cadastrar Hist. Associado |
| Atendimento | DELETE | `/historico-atendimento/:codigo_historico_atendimento` | Excluir Histórico Atendimento Associado |
| Atendimento | POST | `/listar/alteracao-historico-atendimento/` | Listar Alterações de Histórico Atendimento |
| Atendimento | POST | `/listar/historico-atendimento-associado` | Listar atendimento Associado |
| Atendimento | GET | `/listar/departamento/:situacao` | Listar departamento |
| Atendimento | GET | `/listar/status-atendimento/:situacao` | Listar status |
| Atendimento | GET | `/listar/tipo-atendimento/:situacao` | Listar tipo |
| Beneficiario | POST | `/alterar/beneficiario` | Alterar |
| Beneficiario | GET | `/alterar/beneficiario-para-associado/:codigo_ou_cpf` | Alterar para associado |
| Beneficiario | POST | `/beneficiario/cadastrar` | Cadastrar |
| Beneficiario | GET | `/listar/vencimento/:situacao` | Listar vencimento |
| Beneficiario | GET | `/listar/beneficio-beneficiario/:codigo_beneficiario` | Listar Benefícios Vinculados |
| Beneficiario | POST | `/listar/beneficiario` | Listar |
| Beneficiario | GET | `/listar/conta/:situacao` | Listar contas bancárias |
| Beneficiario | GET | `/listar/estadocivil/:situacao` | Listar Estado Civil |
| Beneficiario | GET | `/listar/parentesco/:situacao` | Listar parentesco |
| Beneficiario | GET | `/listar/profissao/:situacao` | Listar profissao |
| Beneficiario | GET | `/listar/situacao/:situacao` | Listar situacao |
| Beneficiario | POST | `/beneficiario/listar-observacao` | Listar Observações |
| Beneficiario | GET | `/beneficiario/buscar/:codigo_ou_cpf` | Buscar |
| Beneficio | POST | `/alterar/beneficio` | Alterar |
| Beneficio | GET | `/listar/beneficio-por-situacao/:situacao` | Listar |
| Beneficio | GET | `/listar/classificacao-beneficio/:situacao` | Listar Classificação |
| Beneficio | POST | `/beneficiario/vincular-beneficio` | Vincular |
| Beneficio | POST | `/vincular-remover/beneficio` | Vincular ou remover benefício |
| Boleto | POST | `/alterar/vencimento-boleto` | Alterar Vencimento |
| Boleto | POST | `/boleto/manutencao` | Manutenção de Boleto |
| Boleto | GET | `/buscar/boleto/:nosso_numero` | Buscar |
| Boleto | GET | `/listar/situacao-boleto/:situacao` | Listar Situação |
| Boleto | POST | `/boleto/cadastrar` | Cadastrar |
| Boleto | POST | `/boleto/listar-alteracao` | Listar Alterações de Boleto |
| Boleto | POST | `/listar/boleto-associado/periodo` | Listar por período |
| Boleto | POST | `/listar/boleto/periodo` | Listar Boleto Associado Beneficiario |
| Boleto | POST | `/listar/boleto-associado-veiculo` | Listar por associado/veículo |
| Boleto | GET | `/listar/conta/:situacao` | Listar Contas Bancárias |
| Boleto | GET | `/listar/tipo-boleto/:situacao` | Listar tipo |
| Boleto | GET | `/tipo-envio-boleto/listar/:situacao` | Listar tipo do envio do boleto |
| Boleto | GET | `/listar/forma-pagamento/:situacao` | Listar Forma Pag. |
| Boleto | GET | `/tipo-cobranca-recorrente/listar/:situacao` | Listar Tipo Cobr. Recorrente |
| Boleto | POST | `/processa-pdf/boleto` | Lista boleto por nosso numero |
| Cooperativa | GET | `/cooperativa/buscar/:codigo_cooperativa` | Buscar |
| Cooperativa | POST | `/cooperativa/cadastrar` | Cadastrar |
| Cooperativa | GET | `/listar/cooperativa/:situacao` | Listar |
| Cota | GET | `/cota/buscar/:codigo_cota` | Buscar |
| Cota | GET | `/listar/cota/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` | Listar |
| Evento | GET | `/evento-sem-alteracao/listar/:quantidade_dias/:codigo_situacao` | Listar Eventos Sem Alteração |
| Evento | POST | `/listar/alteracao-eventos` | Listar Histórico Alteração |
| Evento | POST | `/evento-aberto/listar` | Listar Eventos Abertos |
| Evento | POST | `/evento-finalizado/listar` | Listar Eventos Finalizados |
| Evento | GET | `/listar/classificacao-evento/:situacao` | Listar Classificação |
| Evento | POST | `/listar/evento` | Listar |
| Evento | GET | `/listar/evento-veiculo/:placa_ou_codigo` | Listar por veículo |
| Evento | GET | `/listar/motivo-evento/:situacao` | Listar Motivos |
| Evento | GET | `/situacao-evento/listar/:situacao` | Listar Situações Evento |
| Evento | GET | `/listar/situacao-evento/:situacao` | Listar Situações |
| Evento | GET | `/veiculo-reparo-oficina/listar` | Veículos por Oficina/Fornecedor |
| Fornecedor | GET | `/acionamento-fornecedor/buscar/:buscar_por/:filtro` | Buscar Acionamento Fornecedor |
| Fornecedor | GET | `/fornecedor/buscar/:cpf_cnpj` | Buscar |
| Fornecedor | POST | `/fornecedor/cadastrar` | Cadastrar |
| Fornecedor | GET | `/listar/acionamento-fornecedor/:inicio_paginacao/:quantidade_por_pagina` | Listar Acionamento Fornecedor |
| Fornecedor | GET | `/listar/fornecedor/:situacao` | Listar |
| Indicacao\_Externa | POST | `/indicacao-externa/buscar` | Buscar |
| Indicacao\_Externa | POST | `/indicacao-externa/cadastrar` | Cadastrar Indicação Externa |
| Indicacao\_Externa | GET | `/indicacao-externa/listar/:situacao` | Listar Indicação Ext. |
| Produto | GET | `/produto/buscar/:codigo_produto` | Buscar |
| Produto | POST | `/veiculo/incluir/produto-adicional` | Cadastrar Prod. Adicional |
| Produto | GET | `/listar/produto/:codigo_regional/:codigo_cooperativa/:codigo_tipo_veiculo/:valor_fipe/:cilindrada` | Listar |
| Produto | GET | `/listar/produto-por-situacao/:situacao` | Listar Por Situação |
| Produto | GET | `/listar/produto-por-situacao/:situacao/:pg/:limit` | Listar Por Situação Paginado |
| Produto | GET | `/listar/classificacao-produto/:situacao` | Listar Classificação |
| Produto | GET | `/listar/grupo-produto/:situacao` | Listar grupo |
| Produto | GET | `/grupoproduto/listar/:situacao` | Listar Grupo Produto |
| Produto | POST | `/veiculo/listar-produto-adicional` | Listar Prod. Adicional |
| Produto | GET | `/produto-vinculado-veiculo/listar/:codigoOuPlaca` | Listar Produtos Veículo |
| Produto | POST | `/veiculo/vincular-remover/produto` | Vincular ou remover produto |
| Proprietario | POST | `/proprietario/alterar` | Alterar |
| Proprietario | GET | `/proprietario/buscar/:codigoOuCpf` | Buscar |
| Proprietario | POST | `/proprietario/cadastrar` | Cadastrar |
| Proprietario | GET | `/listar/proprietario/:inicio_paginacao/:quantidade_por_pagina` | Listar |
| Regional | POST | `/regional/cadastrar/` | Cadastrar |
| Regional | GET | `/listar/regional/:situacao` | Listar |
| Termo | POST | `/termo/emitir` | Emitir |
| Termo | GET | `/termo/listar` | Listar |
| Termo | POST | `/termo/novo-aceite-digital/` | Aceite Digital |
| Veiculo | POST | `/alterar/veiculo` | Alterar |
| Veiculo | POST | `/veiculo/alterar-situacao-para` | Alterar situação com Motivo |
| Veiculo | GET | `/veiculo/alterar-situacao-para/:codigo_situacao/:codigo_veiculo` | Alterar situação |
| Veiculo | GET | `/veiculo/buscar/:placaOuChassi/:buscar_por` | Buscar |
| Veiculo | GET | `/veiculo/buscar-por-permissao/:placaOuChassi/:buscar_por` | Buscar por permissão |
| Veiculo | POST | `/buscar/rateio-medio` | Buscar rateio |
| Veiculo | GET | `/buscar/situacao-financeira-veiculo/:codigo_ou_placa` | Buscar situação Financeira |
| Veiculo | POST | `/veiculo/cadastrar` | Cadastrar |
| Veiculo | POST | `/veiculo/observacao/cadastrar` | Cadastrar Observação |
| Veiculo | POST | `/veiculo/foto/cadastrar` | Cadastrar foto |
| Veiculo | POST | `/cadastrar/agregado` | Cadastrar Agregado |
| Veiculo | GET | `/listar/alienacao/:situacao` | Listar Alienação |
| Veiculo | POST | `/listar/alteracao-veiculos` | Listar Alterações de Veículos |
| Veiculo | GET | `/listar/categoria-veiculo/:codigo_tipo/:situacao` | Listar categoria |
| Veiculo | GET | `/listar/classificacao-veiculo/:situacao` | Listar Classificacao |
| Veiculo | GET | `/listar/combustivel/:situacao` | Listar combustível |
| Veiculo | GET | `/listar/conta/:situacao` | Listar conta bancária |
| Veiculo | GET | `/listar/cor/:situacao` | Listar cor |
| Veiculo | GET | `/listar/depreciacao/:situacao` | Listar Depreciação |
| Veiculo | GET | `/listar/situacao/:situacao` | Listar situação |
| Veiculo | GET | `/buscar/situacao-veiculo/:placaOuChassi` | Buscar situação veículo |
| Veiculo | GET | `/listar/tabela-avaliacao/:situacao` | Listar Tabela de Avaliação |
| Veiculo | GET | `/tipo-adesao/listar/:situacao` | Listar Tipo Adesão |
| Veiculo | GET | `/tipo-carga/listar/:situacao` | Listar Tipo Carga |
| Veiculo | GET | `/tipo-carroceria/listar/:situacao` | Listar Tipo Carroceria |
| Veiculo | GET | `/listar/tipo-veiculo/:situacao` | Listar tipo |
| Veiculo | POST | `/listar/veiculo` | Listar |
| Veiculo | GET | `/veiculo/listar-veiculo-produto/:codigo_situacao/:inicio_paginacao/:quantidade_por_pagina` | Lista prod. vinculado |
| Veiculo | GET | `/listar/forma-pagamento/:situacao` | Listar Forma Pag. |
| Veiculo | GET | `/implemento-vinculado/listar/:codigoOuPlaca` | Listar Implementos Vinculados |
| Veiculo | GET | `/listar/implemento/:situacao` | Listar Implementos |
| Veiculo | GET | `/listar/marca/:situacao` | Listar marca |
| Veiculo | POST | `/veiculo/listar-observacao` | Listar Observações |
| Veiculo | POST | `/listar-por-permissao/veiculo` | Listar por permissao |
| Veiculo | GET | `/veiculo-ativo-inativo/listar` | Quant. veiculo Ativo/Inativo |
| Veiculo | POST | `/veiculo/produto/remover` | Remover produto |
| Veiculo | GET | `/produto-adicional/remover/:codigo_veiculo/:codigo_produto_adicional` | Remover Prod. Adicional |
| Veiculo | POST | `/vincular/implemento` | Vincular implemento |
| Veiculo | POST | `/veiculo/vincular/produto` | Vincular produto |
| Veiculo | POST | `/modelo/listar` | Listar Modelos |
| Vistoria | POST | `/cadastrar/vistoria` | Cadastrar vistoria |
| Vistoria | GET | `/listar/estado-pneu/:situacao` | Listar estado pneu |
| Vistoria | GET | `/listar/marca-pneu/:situacao` | Listar marca pneu |
| Vistoria | GET | `/listar/medida-pneu/:situacao` | Listar medida pneu |
| Vistoria | GET | `/listar/tipo-foto/:situacao` | Listar tipo foto |
| Vistoria | GET | `/listar/tipo-local/:situacao` | Listar tipo local |
| Vistoria | GET | `/listar/tipo-vistoria/:situacao` | Listar Tipo Vistoria |
| Vistoria | POST | `/listar/vistoria` | Listar vistoria |
| Vistoria | GET | `/listar/vistoriador/:situacao` | Listar Vistoriador |
| Voluntario | GET | `/buscar/voluntario/:cpdOuCodigo` | Buscar |
| Voluntario | POST | `/voluntario/cadastrar` | Cadastrar |
| Voluntario | POST | `/voluntario/cadastrar-cooperativa/` | Vincular à cooperativa |
| Voluntario | POST | `/voluntario/excluir-cooperativa/` | Remover de cooperativa |
| Voluntario | POST | `/listar/alteracao-voluntario/` | Listar Alterações de Voluntários |
| Voluntario | POST | `/listar/indicacao/` | Listar indicações |
| Voluntario | GET | `/listar/situacao-adesao-voluntario/:codigo_voluntario` | Listar situação adesão |
| Voluntario | GET | `/listar/voluntario/:situacao/:pagina` | Listar |
| Voluntario | GET | `/listar/classificacao-voluntario/:situacao` | Listar Classificação |
| Voluntario | POST | `/listar/placas-por-voluntario/` | Listar placas |
| MGF | POST | `/mgf-lancamento/alterar` | Alterar Lançamento |
| MGF | GET | `/mgf-conta-pagar/buscar/:codigo_ou_nota` | Buscar Conta Pagar |
| MGF | GET | `/mgf-conta-receber/buscar/:codigo_ou_nota` | Buscar Conta Receber |
| MGF | POST | `/buscar/cliente/:CodigoOuCpf` | Buscar Cliente |
| MGF | GET | `/mgf-saldo-caixa/buscar/:codigo_caixa` | Buscar Saldo Caixa |
| MGF | GET | `/mgf-saldo-conta/buscar/:codigo_conta` | Buscar Saldo Conta |
| MGF | POST | `/mgf-lancamento/cadastrar` | Cadastrar Lançamento |
| MGF | GET | `/mgf-lancamento/excluir/:codigo_lancamento` | Excluir Lançamento |
| MGF | GET | `/mgf-descricao/listar/:situacao` | Listar Descrição |
| MGF | GET | `/mgf-suboperacao/listar/:situacao` | Listar Sub-operação |
| MGF | POST | `/listar/cliente` | Listar Cliente |
| MGF | GET | `/listar/conta/:situacao` | Listar conta bancária |
| MGF | POST | `/mgf-lancamento/listar` | Listar Lançamento |
| MGF | GET | `/mgf-caixa/listar/:situacao` | (sem título na doc) |
| MGF | GET | `/mgf-operacao/listar` | Listar Operações MGF |

---

## 9\. Referência por módulo

### Módulo: Autenticacao

#### POST /usuario/autenticar — Autenticar Usuário

Método essencial para utilização dos demais endpoints da APIv2. Retorna um token autenticado, que permite acesso as demais requisições. Atenção: O token que é gerado por este endpoint não expira, portanto não é necessário fazer uma nova autenticação antes de cada requisição aos demais métodos. Params:

- `usuario` (String, req): Usuário ATIVO do sistema SGA  
- `senha` (String, req): Senha de acesso do sistema SGA Resp:  
- `mensagem` (String, req): OK  
- `token_usuario` (String, req): Token de acesso após autenticação. Este token deverá ser enviado nas demais requisições ReqEx: {usuario:s,senha:s} RespEx: \[200\] {mensagem:"OK",token\_usuario:s}

### Módulo: Associado

#### POST /alterar/associado — Alterar

Params:

- `codigo_associado` (Number, req): Código do associado a ser alterado. Opcional caso esteja enviando o CPF do associado  
- `nome` (String, opt): Nome do associado.  
- `cpf` (String, opt): CPF ou CNPJ válido do associado. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números. Opcional caso esteja enviando o codigo\_associado. Para alterar o CPF do associado é preciso enviar o código do associado também.  
- `rg` (String, opt): Registro geral do associado.  
- `data_nascimento` (String, opt): Data de nascimento do associado. Mascara: 99/99/9999.  
- `telefone` (String, opt): Número de telefone do associado. \[MASC\_TEL\].  
- `celular` (String, opt): Número de celular do associado. \[MASC\_TEL\].  
- `telefone_celular_aux` (String, opt): Número de celular auxiliar do associado. \[MASC\_TEL\]  
- `email` (String, opt): e-Mail do associado.  
- `logradouro` (String, opt): Logradouro residêncial do associado.  
- `numero` (String, opt): Número residêncial do associado.  
- `complemento` (String, opt): Complemento residêncial do associado.  
- `bairro` (String, opt): Bairro residêncial do associado.  
- `cidade` (String, opt): Cidade residêncial do associado.  
- `estado` (String, opt): Estado residêncial do associado. \[ESTADO\].  
- `cep` (String, opt): Cep residêncial do associado. \[MASC\_CEP\].  
- `codigo_profissao` (Number, opt): Código profissão.  
- `codigo_regional` (Number, opt): Código regional.  
- `codigo_cooperativa` (Number, opt): Código da cooperativa.  
- `codigo_conta` (Number, opt): Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional.  
- `dia_vencimento` (Number, opt): Dia do mês no qual o boleto irá vencer.  
- `codigo_externo` (Number, opt): Código externo do associado.  
- `sexo` (String, opt): Sexo do associado.  
- `boleto_fisico` (String, opt): Boleto físico. Mascara: Y ou N  
- `receber_whatsapp` (String, opt): Receber whatsapp. Mascara: Y ou N  
- `data_vencimento_habilitacao` (String, opt): Data de Vencimento da habilitação do associado. Mascara: 99/99/9999  
- `data_primeira_habilitacao` (String, opt): Data de emissão da primeira habilitação do associado. Mascara: 99/99/9999  
- `categoria_cnh` (String, opt): Categoria da CNH do associado.  
- `codigo_como_conheceu` (Number, opt): Código da mídia pela qual o associado conheceu a associação.  
- `cartao` (Array, opt): Array contendo os atributos do cartão do associado. Contém os atributos: codigo\_cartao(código do cartão do associado), hash(hash do cartão), numero\_final\_cartao(últimos 3 dígitos do cartão)  
- `codigo_tipo_cobranca_recorrente` (Number, opt): Código do tipo de cobrança recorrente. Lista de tipo cobranca recorrente {aqui}. Resp:  
- `mensagem` (String, req): Mensagem de retorno  
- `codigo_associado` (String, req): Código do associado inserido na base de dados ReqEx: keys\~ nome,codigo\_associado,data\_nascimento,telefone,celular,email,logradouro,numero,complemento,bairro,cidade,estado,cep,boleto\_fisico,codigo\_regional,codigo\_cooperativa,data\_vencimento\_habilitacao,data\_primeira\_habilitacao,categoria\_cnh,mes\_referente,valor\_fixo,codigo\_como\_conheceu,cartao,hash,numero\_final\_cartao,codigo\_cartao RespEx: \[207\] {mensagem:"OK",codigo\_associado:n}

#### GET /associado/alterar-situacao-para/:codigo\_situacao/:codigo\_associado — Alterar situação

Altera a Situação do associado de acordo com o código do associado Path: :codigo\_situacao :codigo\_associado Params:

- `codigo_situacao` (Number, req): Define qual a nova Situação do associado  
- `codigo_associado` (Number, req): Código do associado o qual se deseja mudar a situação RespEx: \[200\] {mensagem:s,codigo\_associado:n}

#### POST /associado/alterar-senha — Alterar a senha

Reseta a senha do associado para o CPF Params:

- `codigo_associado` (Number, opt): Codigo do associado que irá resetar a senha.  
- `codigo_benficiario` (Number, opt): Codigo do beneficiario que irá resetar a senha.  
- `enviar_email` (string, opt): Envia e-mail automatico para o associado sobre a troca de senha. RespEx: {mensagem:"OK",retorno:s,E-mail:s}

#### GET /associado/buscar-por-cpf-senha/:cpf/:senha — Buscar Por CPF-CNPJ e Senha

Busca associado pelo CPF/CNPJ e pela senha Path: :cpf :senha RespEx: \[200\] {codigo\_associado:s,nome:s,cpf:s,telefone\_fixo:s,celular:s,logradouro:s,numero:s,complemento:"COMPLEMENTO",bairro:"OURO PRETO",cidade:"BELO HORIZONTE",estado:"MG",cep:s,email:s,veiculos:\[{codigo\_veiculo:n,placa:s,chassi:s,valor\_fixo:n,codigo\_situacao:s,valor\_fipe:n,descricao\_situacao:"ATIVO",descricao\_modelo:"MODELO VEICULO",codigo\_modelo:s,codigo\_veiculo\_indicador:n,placa\_veiculo\_indicador:s,codigo\_associado\_indicador:n,cpf\_associado\_indicador:n,nome\_associado\_indicador:s}\]}

#### GET /associado/buscar/:cpfOuCodigo/:buscar\_por — Buscar

Busca associado pelo CPF ou pelo código Path: :cpfOuCodigo :buscar\_por Params:

- `cpfOuCodigo` (String, req): CPF ou código do associado a ser pesquisado  
- `buscar_por` (String, req): Define se o parâmetro cpfOuCodigo é o CPF ou o código do associado RespEx: \[200\] {codigo\_associado:s,codigo\_associado\_beneficiario:s,nome:s,sexo:"M",data\_nascimento:"yyyy-mm-dd",nome\_mae:"MAE",nome\_pai:"PAI",rg:s,orgao\_expedidor\_rg:"SSPMG",data\_expedicao\_rg:"yyy-mm-dd",cnh:s,categoria\_cnh:"A",data\_vencimento\_habilitacao:"yyyy-mm-dd",cpf:s,telefone\_fixo:s,telefone\_celular:s,telefone\_celular\_aux:s,telefone\_comercial:s,email:s,email\_auxiliar:s,cep:s,logradouro:s,numero:s,complemento:"COMERCIAL",bairro:"OURO PRETO",cidade:"BELO HORIZONTE",estado:"MG",codigo\_regional:s,codigo\_cooperativa:s,codigo\_externo:s,codigo\_situacao:s,codigo\_voluntario:s,codigo\_estado\_civil:s,descricao\_situacao:"ATIVO",spcSerasa:s,dia\_vencimento:s,codigo\_tipo\_cobranca\_recorrente:s,descricao\_tipo\_cobranca\_recorrente:s,pontos:n,data\_cadastro:"yyyy-mm-dd",codigo\_classificacao:s,data\_contrato:"yyyy-mm-dd",filhos:n,codigo\_profissao:s, opcoes\_notificacao:{email:"Y/N",sms:"Y/N",whatsapp:"Y/N"},veiculos:\[{codigo\_veiculo:s,placa:s,chassi:s,valor\_fixo:n,codigo\_situacao:s,valor\_fipe:n,situacao:"SITUACAO",descricao\_modelo:"MODELO",codigo\_modelo:s,codigo\_veiculo\_indicador:n,placa\_veiculo\_indicador:n,codigo\_associado\_indicador:n,cpf\_associado\_indicador:n,nome\_associado\_indicador:n}\],beneficiario:\[{codigo\_associado\_beneficiario:s,dia\_vencimento:s,codigo\_tipo\_cobranca\_recorrente:s,descricao\_tipo\_cobranca\_recorrente:"BOLETO",codigo\_cooperativa:s,codigo\_voluntario:s,pontos:n,descricao\_situacao:"ATIVO",codigo\_situacao:s}\]}

#### GET /associado/buscar-por-permissao/:cpfOuCodigo/:buscar\_por — Buscar por permissao

Busca associado pelo CPF ou pelo código validando as permissões em regional e cooperativa do usuário Path: :cpfOuCodigo :buscar\_por Params:

- `cpfOuCodigo` (String, req): CPF ou código do associado a ser pesquisado  
- `buscar_por` (String, req): Define se o parâmetro cpfOuCodigo é o CPF ou o código do associado RespEx: \[200\] mesma estrutura de "Buscar" (campos principais do associado \+ veiculos:\[{codigo\_veiculo,placa,chassi,valor\_fixo}\])

#### GET /buscar/situacao-associado/:cpfOuCnpj — Buscar Situação Associado

Busca a situação de um determinado associado pelo cpf ou cnpj. Path: :cpfOuCnpj RespEx: \[200\] {codigo\_associado:s,codigo\_situacao:s,descricao:"ATIVO"}

#### POST /associado/cadastrar — Cadastrar

Params:

- `nome` (String, req): Nome do associado.  
- `cpf` (String, req): CPF ou CNPJ válido do associado. Marcara: 999.999.999-99, 99.999.999/9999-99 ou somente números  
- `rg` (String, req): Registro geral do associado  
- `data_nascimento` (String, req): Data de nascimento do associado. Mascara: dd/mm/yyyy  
- `logradouro` (String, req): Logradouro residêncial do associado  
- `numero` (String, req): Número residêncial do associado  
- `bairro` (String, req): Bairro residêncial do associado  
- `cidade` (String, req): Cidade residêncial do associado  
- `estado` (String, req): Estado residêncial do associado. \[ESTADO\]  
- `cep` (String, req): Cep residêncial do associado. \[MASC\_CEP\]  
- `codigo_conta` (Number, req): Código do banco. Obrigatório caso tenha mais de uma conta bancária cadastrada para a regional  
- `sexo` (String, req): Sexo do associado. Valores aceitos M ou F.  
- `telefone` (String, opt): Número de telefone do associado. \[MASC\_TEL\]  
- `mes_referente` (String, opt): Mês referente  
- `complemento` (String, opt): Complemento residêncial do associado  
- `orgao_expedidor_rg` (String, opt): Órgão expedidor do RG.  
- `data_expedicao_rg` (String, opt): Data da expedição do RG. Mascara: dd/mm/yyyy  
- `telefone_comercial` (String, opt): Telefone comercial do associado.  
- `celular` (String, opt): Número de celular do associado. \[MASC\_TEL\]  
- `telefone_celular_aux` (String, opt): Número de celular auxiliar do associado. \[MASC\_TEL\]  
- `email` (String, opt): e-Mail do associado.  
- `email_auxiliar` (String, opt): e-mail auxiliar do associado.  
- `codigo_profissao` (Number, opt): Código profissão.  
- `codigo_regional` (Number, opt): Código regional.  
- `codigo_cooperativa` (Number, opt): Código da cooperativa.  
- `dia_vencimento` (Number, opt): Dia do mês no qual o boleto irá vencer.  
- `codigo_externo` (Number, opt): Código externo do associado.  
- `data_vencimento_habilitacao` (String, opt): Data de Vencimento da habilitação do associado. Mascara: dd/mm/yyyy  
- `data_primeira_habilitacao` (String, opt): Data de emissão da primeira habilitação do associado. Mascara: dd/mm/yyyy  
- `categoria_cnh` (String, opt): Categoria da CNH do associado.  
- `numero_cnh` (String, opt): Número da CNH do associado.  
- `data_contrato` (String, opt): Data do contrato do associado.  
- `valor_fixo` (Number, opt): Valor fixo mensal  
- `receber_whatsapp` (String, opt): Receber whatsapp. Mascara: Y ou N  
- `codigo_voluntario` (Number, opt): Código do voluntário responsável pela adesão.  
- `qtde_parcela_carne` (Number, opt): Quantidade de parcelas do carnê.  
- `codigo_como_conheceu` (Number, opt): Código da mídia pela qual o associado conheceu a associação.  
- `observacao` (String, opt): Observação do associado.  
- `beneficios` (Array, opt): Array contendo os códigos dos benefícios a serem vinculados ao associado.  
- `cartao` (Array, opt): Array contendo os dados do cartão de crédito do associado. Resp:  
- `mensagem` (String, req): Mensagem de retorno  
- `codigo_associado` (String, req): Código do associado inserido na base de dados ReqEx: keys\~ nome,cpf,rg,data\_nascimento,telefone,celular,email,logradouro,numero,complemento,bairro,cidade,estado,cep,codigo\_profissao,codigo\_regional,codigo\_cooperativa,codigo\_conta,dia\_vencimento,codigo\_externo,sexo,data\_vencimento\_habilitacao,data\_primeira\_habilitacao,categoria\_cnh,numero\_cnh,data\_contrato,valor\_fixo,mes\_referente,qtde\_parcela\_carne,codigo\_como\_conheceu,beneficios\[{codigo\_beneficio}\],cartao{numero\_final\_cartao,codigo\_bandeira\_cartao,hash,validade} RespEx: \[200\] {mensagem:"OK",codigo\_associado:n,beneficios:\[{codigo\_beneficio:s,situacao:s}\]}

#### GET /associado/gerar-url-cadastro-cartao/:codigo\_associado/:cpf — Gerar URL Cadastro Cartão

Gera URL que é utilizada para realizar o cadastramento de cartão de crédito para cobranças recorrentes Path: :codigo\_associado :cpf RespEx: \[200\] {codigo\_associado:n,nome:s,url\_cadastro\_cartao:s}

#### POST /listar/alteracao-associados/ — Listar Alterações de Associados

Lista as alterações de associados em um intervalo de até 7 dias Params:

- `data_inicial` (String, req): \[DT\_INI\]  
- `data_final` (String, req): \[DT\_FIM\]  
- `ultima_alteracao` (String, req): Define se será exibida apenas a última alteração de cada associado Formato "Y" ou "N". Opcional  
- `campos` (Array, req): Array contendo o nome dos campos do associado que devem ser retornados  
- `valor_posterior` (Array, req): Array contendo o VALOR dos campos do associado que devem ser retornados. O endpoint ira buscar as alterações de associado que foram alterados para o valor informado neste campo. RespEx: \[200\] \[{codigo\_associado,cpf\_associado,nome\_associado,nome\_campo\_tabela,valor\_anterior,valor\_posterior,data\_alteracao,codigo\_usuario\_alteracao,nome\_usuario\_alteracao}\]

#### GET /associado/aniversariante — Listar Aniversariante Dia

Lista todos os associados/beneficiários aniversariantes do dia RespEx: \[200\] \[{codigo\_associado,codigo\_beneficiario,data\_nascimento,nome,telefone,telefone\_celular,email}\]

#### POST /listar/associado — Listar

Lista os associados de acordo com a situação especificada Params:

- `codigo_situacao` (Number, req): Define qual a situação dos associados a serem listados. O codigo\_situacao é obrigatório  
- `codigo_regional` (Array, opt): Array de códigos de regionais para listar os associados  
- `data_cadastro` (String, opt): Data de cadastro inicial do associado Mascara: d/m/a  
- `data_cadastro_final` (String, opt): Data de cadastro final do associado Mascara: d/m/a  
- `data_contrato` (String, opt): Data de contrato inicial do associado Mascara: d/m/a  
- `data_contrato_final` (String, opt): Data de contrato final do associado Mascara: d/m/a  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]  
- `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_OFFSET\] RespEx: \[200\] {mensagem:"OK",total\_associados:s,mostrando:n,numero\_paginas:n,pagina\_corrente:n,associados:\[{codigo\_associado:s,codigo\_situacao:s,nome:s,sexo:"M",tipo\_pessoa:s,data\_nascimento:s,rg\_associado:s,orgao\_expedidor\_rg:"MG",data\_expedicao\_rg:s,cnh:s,categoria\_cnh:"B",data\_vencimento\_habilitacao:s,cpf:s,codigo\_classificacao:s,ddd:s,telefone:s,ddd\_celular:s,telefone\_celular:s,ddd\_celular\_aux:s,telefone\_celular\_aux:s,ddd\_comercial:s,telefone\_comercial:s,email:s,email\_auxiliar:s,cep:s,logradouro:s,numero:s,complemento:s,bairro:s,cidade:s,estado:"MG",data\_cadastro\_associado:s,data\_contrato\_associado:s,hora\_contrato\_associado:s,radio:s,radio2:s,dia\_vencimento:s,filhos:n,codigo\_profissao:s,codigo\_regional:s,codigo\_cooperativa:s,pontos:s,codigo\_voluntario:n}\]}

#### GET /associado/cartao/listar/:codigoOuCpf — Buscar Cartões associado

Lista os cartões de crédito de um determinado associado pelo CPF ou código do associado Path: :codigoOuCpf RespEx: \[200\] \[{codigo\_cartao,numero\_final\_cartao,validade:"mm/yyyy",situacao:"A",veiculos\_vinculados:\[\],beneficiarios\_vinculados:\[\]}\]

#### GET /listar/classificacao-associado/:situacao — Listar Classificação

Lista as classificações disponíveis de acordo com a situação desejada (ativo, inativo ou todos). A situação é obrigatória Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] \[{codigo:n,descricao:s,situacao:"ATIVO"}\]

#### GET /listar/estadocivil/:situacao — Listar Estados Civis

Lista os estado civis disponíveis de acordo com a situação desejada (Ativo, Inativo ou Todos). A situação é obrigatória Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] {codigo\_estadocivil:s,descricao\_estadocivil:s}

#### GET /midia/listar/:situacao — Listar Mídia

Lista as mídias (como conheceu) cadastradas no sistema Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] {codigo\_midia:s,descricao:s,situacao:"ATIVO"}

#### GET /listar/parentesco/:situacao — Listar Parentescos

Lista os parentescos disponíveis de acordo com a situação desejada. A situação é obrigatória Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] {codigo\_parentesco:n,descricao\_parentesco:s}

#### GET /listar/profissao/:situacao — Listar Profissões

Lista as profissões disponíveis de acordo com a situação desejada. A situação é obrigatória Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] {codigo\_profissao:n,descricao\_profissao:s}

#### GET /associado/novos-contratos/listar — Listar a quantidade de contratos

Lista a quantidade de contrato realizados no dia atual RespEx: {quantidade\_contratos:s,codigo\_associados:s("99,999")}

#### GET /listar/situacao/:situacao — Listar Situação

Lista as situações cadastradas no sistema (Ativo, Pendente, Excluído, etc). Usadas para ASSOCIADO, VEICULO e BENEFICIÁRIO Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] {codigo\_situacao:n,descricao\_situacao:"ATIVO",situacao:"ATIVO",cor\_fonte:s,cor\_linha:s}

#### GET /listar/situacaomotivo/:situacao — Listar Situação Motivo

Lista as situações motivo cadastradas no sistema. Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] {codigo,descricao,situacao,objeto}

#### GET /listar/vencimento/:situacao — Listar Vencimentos

Lista os vencimentos disponíveis de acordo com a situação desejada. A situação é obrigatória Path: :situacao Params:

- `situacao` (String, req): \[SITUACAO\] RespEx: \[200\] {codigo\_vencimento:n,dia\_vencimento:n,situacao:"ATIVO"}

#### GET /listar/associado/contatos/:cpfOuCodigo — Lista Contatos

Lista os contatos do associado Path: :cpfOuCodigo RespEx: \[200\] \[{telefone,telefone\_comercial,telefone\_celular,telefone\_celular\_aux,telefone\_radio,telefone\_radio\_aux,telefone\_fax,radio,radio2,email,email\_auxiliar}\]

#### GET /listar/associado/endereco/:cpfOuCodigo — Lista Endereco

Lista o endereco do associado Path: :cpfOuCodigo RespEx: \[200\] \[{logradouro,numero,complemento,bairro,cidade,estado,cep,latitude\_cidade,longitude\_cidade}\]

#### POST /listar-por-permissao/associado — Listar por permissão

Lista os associados de acordo com a situação especificada validando as permissões em regional e cooperativa do usuário Params: (mesmos de POST /listar/associado)

- `codigo_situacao` (Number, req)  
- `codigo_regional` (Array, opt)  
- `data_cadastro`, `data_cadastro_final`, `data_contrato`, `data_contrato_final` (String, opt): Mascara d/m/a  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]  
- `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_OFFSET\] RespEx: \[200\] mesma estrutura de POST /listar/associado (sem dia\_vencimento/filhos/codigo\_profissao/... no fim)

#### GET /associado-ativo-inativo/listar — Quant. Associado Ativo/Inativo

Retorna a quantidade de associados ativos e inativos no sistema RespEx: {mensagem:"OK",associados\_ativos:s,associados\_inativos:s}

#### POST /campos-opcionais/listar — Lista os Campos opcionais

Lista os Campos opcionais cadastrados Params:

- `objeto` (string, req): Objeto cujos campos opcionais serão listados. Valores permitidos: "ASSOCIADO", "BENEFICIARIO", "VEICULO" RespEx: \[{descricao:s,tipo\_campo:"select"\|"text",valores:\["SIM","NAO"\]}\]

#### POST /campos-opcionais/vincular — Vincula Campos opcionais

Vincula o campo opcional ao associado informado Params:

- `objeto` (string, req): "ASSOCIADO", "BENEFICIARIO" ou "VEICULO"  
- `codigo_objeto` (Number, req): Código do objeto informado: código do associado, do beneficiário ou do veículo conforme `objeto`.  
- `campos` (array, req): Contém `descricao` (campo opcional a vincular) e `valor` (conteúdo). Se houver mais de uma resposta permitida, `valor` pode ser array de strings ou objetos. RespEx: {sucesso:\["Valor X inserido para o campo Y."\]}

### Módulo: Atendimento

#### POST /alterar/historico-atendimento-associado — Alterar Hist. Associado

Params:

- `codigo_historico_atendimento` (Number, req): Código do atendimento a ser alterado. Opcional caso esteja enviando o cpf  
- `codigo_status_atendimento` (Number, opt): Código do status no qual se encontra o atendimento  
- `codigo_tipo_atendimento` (Number, opt): Código do tipo do atendimento  
- `codigo_departamento` (Number, opt): Código do departamento do atendimento  
- `titulo` (String, opt): Título do atendimento  
- `descricao` (String, opt): Descrição do atendimento  
- `codigo_terceiro` (Number, opt): Código do terceiro atendido.  
- `placa` (String, opt): Placa do veículo do atendido.  
- `valor_atendimento` (String, opt): Valor de atendimento.  
- `data_atendimento` (String, opt): Data do atendimento. Se omitido, usa a data do dia do cadastro.  
- `codigo_fornecedor` (String, opt): Código do fornecedor. Resp: `mensagem`, `codigo_historico_atendimento` (String) RespEx: \[200\] {mensagem:"OK",codigo\_historico\_atendimento:s}

#### GET /buscar/historico-atendimento-associado/:cpf — Busca Hist. Associado

Busca todos os atendimentos de um determinado associado RespEx: \[200\] {codigo\_associado,nome\_associado,rg\_associado,cpf\_associado,telefone\_fixo,telefone\_celular,telefone\_celular\_aux,telefone\_comercial,e-mail,descricao\_situacao,historico\_atendimento:\[{codigo\_atendimento,descricao\_status\_atendimento,codigo\_tipo\_atendimento,codigo\_departamento,codigo\_veiculo,placa,titulo,descricao,data\_cadastro,hora\_cadastro,descricao\_tipo\_atendimento,descricao\_departamento,codigo\_usuario,nome\_usuario,cpf\_usuario,valor\_atendimento}\]}

#### POST /historico-atendimento-associado/foto/cadastrar — Cadastrar foto/documento

Adiciona fotos/documentos ao atendimento. Pode ser enviada como URL ou arquivo binário. Limite de 50 fotos por requisição. Formatos aceitos: .png, .jpeg, .jpg, .pdf Params:

- `codigo_atedimento` (Number, req): Código do atendimento ao qual a foto/documento deve ser vinculada. (ATENÇÃO: a doc grafa `codigo_atedimento` no parâmetro, mas o exemplo usa `codigo_atendimento`)  
- `foto` (Array, req): Array com índices: nome\_arquivo, link, binario. Se `link` (URL) for informado, `binario` não é enviado.  
- `foto.nome_arquivo` (req): Nome como o arquivo será salvo.  
- `foto.link` (opt): URL da imagem.  
- `foto.binario` (opt): Arquivo binário da imagem. ReqEx: {codigo\_atendimento:n,foto:\[{nome\_arquivo:s,link:s}\]} RespEx: \[200\] \[{nome\_arquivo:s,situacao:s}\]

#### POST /cadastrar/historico-atendimento-associado — Cadastrar Hist. Associado

Params:

- `codigo_associado` (Number, req): Código do associado atendido. Opcional caso esteja enviando o cpf  
- `cpf` (String, opt): CPF do associado atendido. Opcional caso esteja mandando o codigo\_associado  
- `codigo_status_atendimento` (Number, req): Código do status do atendimento  
- `codigo_tipo_atendimento` (Number, req): Código do tipo do atendimento  
- `codigo_departamento` (Number, req): Código do departamento do atendimento  
- `titulo` (String, req): Título do atendimento  
- `descricao` (String, req): Descrição do atendimento  
- `codigo_terceiro` (Number, opt): Código do terceiro atendido.  
- `placa` (String, opt): Placa do veículo do atendido.  
- `valor_atendimento` (String, opt): Valor de atendimento.  
- `data_atendimento` (String, opt): Data do atendimento. Se omitido, usa a data do dia.  
- `codigo_fornecedor` (String, opt): Código do fornecedor. Resp: `mensagem`, `codigo_historico_atendimento` RespEx: \[200\] {mensagem:"OK",codigo\_historico\_atendimento:s}

#### DELETE /historico-atendimento/:codigo\_historico\_atendimento — Excluir Histórico Atendimento Associado

Exclusão de Histórico de Atendimento (ÚNICO endpoint DELETE da API) Params:

- `codigo_historico_atendimento` (Inteiro, req): Código Histórico Atendimento RespEx: \[200\] {mensagem}

#### POST /listar/alteracao-historico-atendimento/ — Listar Alterações de Histórico Atendimento

Lista as alterações de Histórico Atendimento em um intervalo de até 7 dias Params:

- `data_inicial` (String, req): \[DT\_INI\]  
- `data_final` (String, req): \[DT\_FIM\]  
- `ultima_alteracao` (String, opt): Exibe apenas a última alteração de cada histórico. "Y" ou "N".  
- `quantidade_por_pagina` (String, opt): \[QTD\_PAG\] Limite do endpoint: 5000  
- `inicio_paginacao` (String, opt): \[INICIO\_PAG\_PAGINA\] (a descrição original é cópia errada da de `ultima_alteracao`)  
- `campos` (Array, req): Nomes dos campos do histórico atendimento a retornar RespEx: \[200\] \[{codigo\_alteracao,codigo\_historico\_atendimento,titulo,operacao,nome\_campo\_tabela,valor\_anterior,valor\_posterior,data\_alteracao:"yyyy-mm-dd",hora\_alteracao,codigo\_usuario\_alteracao,nome\_usuario\_alteracao}\]

#### POST /listar/historico-atendimento-associado — Listar atendimento Associado

Lista o Histórico Atendimento do associado. Limite de 5000 atendimentos por requisição. Params:

- `codigo_tipo_atendimento` (Number, opt)  
- `codigo_status_atendimento` (Number, opt)  
- `codigo_departamento` (Number, opt)  
- `data_cadastro_inicial` (string, opt)  
- `data_cadastro_final` (string, opt)  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]  
- `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_PAGINA\] RespEx: \[200\] \[{codigo\_atendimento,codigo\_status\_atendimento,codigo\_tipo\_atendimento,codigo\_departamento,codigo\_veiculo,codigo\_associado,codigo\_usuario,placa,nome\_associado,nome\_usuario,titulo,descricao,data\_cadastro,hora\_cadastro,valor\_atendimento}\]

#### GET /listar/departamento/:situacao — Listar departamento

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_departamento,descricao}

#### GET /listar/status-atendimento/:situacao — Listar status

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_statusatendimento,descricao}

#### GET /listar/tipo-atendimento/:situacao — Listar tipo

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipoatendimento,descricao}

### Módulo: Beneficiario

#### POST /alterar/beneficiario — Alterar

Params:

- `codigo_beneficiario` (Number, req): Código do beneficiário a ser alterado. Opcional caso esteja enviando o CPF  
- `cpf` (String, req): CPF/CNPJ válido do beneficiário. Opcional caso envie o código. Para alterar o CPF é preciso enviar o código do beneficiário  
- `nome`, `rg` (String, opt)  
- `data_nascimento` (Date, opt): dd/mm/yyyy  
- `codigo_parentesco` (Number, opt)  
- `telefone`, `celular` (String, opt): \[MASC\_TEL\]  
- `email`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade` (String, opt)  
- `estado` (String, opt): \[ESTADO\]  
- `cep` (String, opt): \[MASC\_CEP\]  
- `codigo_profissao`, `codigo_cooperativa`, `codigo_conta`, `dia_vencimento`, `codigo_associado`, `codigo_externo` (Number, opt)  
- `sexo`, `categoria_cnh` (String, opt)  
- `codigo_tipo_cobranca_recorrente` (Number, opt) Resp: `codigo` (Number: 200, 203, 401 etc), `mensagem`, `codigo_beneficiario` RespEx: \[200\] {codigo:s,mensagem:"OK",codigo\_beneficiario:n}

#### GET /alterar/beneficiario-para-associado/:codigo\_ou\_cpf — Alterar para associado

Transforma um beneficiário em associado, mantendo todos os dados já cadastrados Params: `codigo_ou_cpf` (String, req) RespEx: \[200\] {mensagem:"OK",codigo\_associado}

#### POST /beneficiario/cadastrar — Cadastrar

Params:

- REQ: `nome`, `cpf`, `rg`, `data_nascimento` (Date, dd/mm/yyyy), `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` \[ESTADO\], `cep` \[MASC\_CEP\], `codigo_conta` (Number; obrigatório se há mais de uma conta bancária na regional), `codigo_associado` (Number; associado ao qual o beneficiário se vincula)  
- OPT: `telefone` \[MASC\_TEL\], `codigo_parentesco` (Number), `celular` \[MASC\_TEL\], `email`, `codigo_profissao`, `codigo_cooperativa`, `dia_vencimento`, `codigo_externo` (Number), `sexo`, `categoria_cnh`, `qtde_parcela_carne` (Number), `valor_fixo` (Number), `gerar_cobranca` ("Y"/"N"), `beneficios` (Array de códigos), `ddd_radio`, `telefone_radio`, `ddd_radio_aux`, `telefone_radio_aux`, `valor_adesao` (String) Resp: `codigo` (200, 203, 401...), `mensagem`, `codigo_beneficiario` ReqEx: {nome,cpf,rg,data\_nascimento,codigo\_parentesco,telefone,celular,email,logradouro,numero,complemento,bairro,cidade,estado,cep,codigo\_profissao,codigo\_cooperativa,codigo\_conta,dia\_vencimento,codigo\_associado,codigo\_externo,sexo:"M",categoria\_cnh:"A",qtde\_parcela\_carne,valor\_fixo,gerar\_cobranca:"Y",beneficios:\[{codigo\_beneficio}\]} RespEx: \[200\] {codigo,mensagem:"OK",codigo\_beneficiario:n,beneficos:\[{codigo\_beneficio,situacao}\]}  (sic: "beneficos")

#### GET /listar/vencimento/:situacao — Listar vencimento

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_vencimento,dia\_vencimento,situacao}

#### GET /listar/beneficio-beneficiario/:codigo\_beneficiario — Listar Benefícios Vinculados

Params: `codigo_beneficiario` (Number, req) RespEx: \[200\] {codigo\_beneficiario,nome,beneficios:\[{codigo\_beneficio,descricao}\]}

#### POST /listar/beneficiario — Listar

Lista os beneficiários de acordo com a situação especificada Params:

- `codigo_situacao` (String, req)  
- `codigo_voluntario` (String, opt)  
- `codigo_associado` (String, opt)  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]  
- `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_OFFSET\] RespEx: \[200\] {mensagem,total\_beneficiario,mostrando,numero\_paginas,pagina\_corrente,benficiarios:\[{codigo\_beneficiario,codigo\_associado,nome,rg\_beneficiario,data\_expedicao\_rg,orgao\_expedidor\_rg,cpf,cpf\_associado,data\_nascimento,sexo,nome\_mae,cnh,categoria\_cnh,logradouro,numero,complemento,bairro,cidade,estado,cep,telefone,ddd,telefone\_celular,ddd\_celular,telefone\_celular\_aux,ddd\_celular\_aux,telefone\_comercial,ddd\_comercial,email,email\_auxiliar,data\_cadastro\_beneficiario,data\_contrato\_beneficiario,hora\_contrato\_beneficiario,codigo\_situacao,descricao\_situacao,radio,radio2}\]}  (sic: chave "benficiarios")

#### GET /listar/conta/:situacao — Listar contas bancárias

Lista as contas às quais o usuário tem permissão de acesso Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_conta,codigo\_agencia,codigo\_banco,descricao\_banco,situacao}

#### GET /listar/estadocivil/:situacao — Listar Estado Civil

(idêntico a Associado)

#### GET /listar/parentesco/:situacao — Listar parentesco

(idêntico a Associado)

#### GET /listar/profissao/:situacao — Listar profissao

(idêntico a Associado)

#### GET /listar/situacao/:situacao — Listar situacao

(idêntico a Associado)

#### POST /beneficiario/listar-observacao — Listar Observações

Lista as observações do beneficiário, com filtro por data ou código do beneficiário. Params:

- `codigo_beneficiario` (Number, opt): Obrigatório caso não filtre por data\_cadastro.  
- `data_cadastro_inicial` (String, opt): DD/MM/YYYY. Obrigatório se não filtrar por codigo\_beneficiario.  
- `data_cadastro_final` (String, opt): DD/MM/YYYY. Obrigatório se não filtrar por codigo\_beneficiario.  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]  
- `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_OFFSET\] RespEx: \[200\] {quantidade\_registros,quantidade\_paginas,observacoes:\[{codigo\_beneficiario,data\_cadastro,hora\_cadastro,usuario\_cadastro,observacao}\]}

#### GET /beneficiario/buscar/:codigo\_ou\_cpf — Buscar

Busca beneficiário pelo CPF ou pelo código Params: `codigo_ou_cpf` (String, req) RespEx: \[200\] {total,mostrando,numero\_paginas,pagina\_corrente,benficiarios:\[{codigo\_beneficiario,codigo\_associado,nome,rg\_beneficiario,data\_expedicao\_rg\_beneficiario:"yyyy/mm/dd",orgao\_expedidor\_rg,cpf,cpf\_associado,data\_nascimento\_beneficiario:"yyyy/mm/dd",sexo,nome\_mae,nome\_pai,cnh,categoria\_cnh,logradouro,numero,complemento,bairro,cidade,estado,cep,telefone,ddd,telefone\_celular,ddd\_celular,telefone\_celular\_aux,ddd\_celular\_aux,telefone\_comercial,ddd\_comercial,email,pontos,valor\_fixo,codigo\_voluntario,email\_auxiliar,data\_cadastro\_beneficiario,data\_contrato\_beneficiario,hora\_contrato\_beneficiario,codigo\_situacao,descricao\_situacao,radio,radio2,participacao:n,valor\_adesao:n}\]}

### Módulo: Beneficio

#### POST /alterar/beneficio — Alterar

Altera informações de um benefício específico NOTA: sem header documentado (usar o padrão) Params:

- `codigo_beneficio` (Number, req)  
- `codigo_classificacao_beneficio` (Number, opt): categoria à qual o benefício deve pertencer  
- `idade_beneficiario_inicial` (Number, opt): idade mínima do beneficiário  
- `idade_beneficiario_final` (Number, opt): idade máxima do beneficiário  
- `descricao` (String, opt) RespEx: \[200\] {mensagem:"OK",codigo\_beneficio:n}

#### GET /listar/beneficio-por-situacao/:situacao — Listar

Lista benefícios de acordo com a situação Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_beneficio,decricao\_beneficio,valor\_beneficio,idade\_beneficiario\_inicial:n,idade\_beneficiario\_final:n,padrao:"N",id\_classificacaobeneficio:n,classificacao\_beneficio}  (sic: "decricao\_beneficio")

#### GET /listar/classificacao-beneficio/:situacao — Listar Classificação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_classificacaobeneficio,descricao,situacao}\]

#### POST /beneficiario/vincular-beneficio — Vincular

Vincula uma lista de benefícios ao beneficiário NOTA: sem header documentado (usar o padrão) Params:

- `codigo_beneficiario` (Number, req)  
- `beneficios` (Array, req): códigos dos benefícios Resp: `mensagem`, `codigobeneficiario`, `beneficios_vinculados` (array), `beneficios_nao_vinculados` (array; só aparece se algum não puder ser vinculado) ReqEx: {codigo\_beneficiario,beneficios:\[s\]} RespEx: \[200\] {codigo\_beneficiario,beneficios\_vinculados:\[{codigo\_beneficio,descricao\_beneficio,codigo\_fornecedor}\],beneficios\_nao\_vinculados:\[{codigo\_beneficio,alerta}\]}

#### POST /vincular-remover/beneficio — Vincular ou remover benefício

Vincula ou exclui benefícios a um beneficiário NOTA: sem header documentado (usar o padrão) Params:

- `codigo_beneficiario` (Number, req)  
- `beneficios_adicionar` (Array, req): códigos a inserir  
- `beneficios_remover` (Array, req): códigos a remover ReqEx: {codigo\_beneficiario:n,beneficios\_adicionar:\[s\],beneficios\_remover:\[s\]} RespEx: \[200\] {codigo\_beneficio,mensagem}

### Módulo: Boleto

#### POST /alterar/vencimento-boleto — Alterar Vencimento

Altera a data de vencimento de um boleto, respeitando as permissões de manutenção de boleto do usuário. Params:

- `nosso_numero` (Number, req)  
- `nova_data_vencimento` (String, req): dd/mm/yyyy ReqEx: {nosso\_numero,nova\_data\_vencimento:"dd/mm/yyyy"} RespEx: \[200\] {mensagem,nosso\_numero,linha\_digitavel,link\_boleto,nova\_data\_vencimento,alerta}

#### POST /boleto/manutencao — Manutenção de Boleto

Realiza a manutenção de um boleto. Params:

- `codigo_boleto` (Number, req)  
- `instrucao` (String, opt): campo instrucao exibido no boleto  
- `demonstrativo` (String, opt): campo demonstrativo exibido no boleto  
- `referente` (String, opt): campo referente exibido no boleto  
- `codigo_tipo_boleto` (Number, opt): ver GET /listar/tipo-boleto/:situacao  
- `codigo_tipo_cobranca_recorrente` (Number, opt): ver GET /tipo-cobranca-recorrente/listar/:situacao ReqEx: {codigo\_boleto,codigo\_tipo\_boleto,instrucao,demonstrativo} ou {codigo\_boleto,codigo\_tipo\_cobranca\_recorrente,instrucao,demonstrativo,referente} RespEx: \[200\] {mensagem,link\_pdf}

#### GET /buscar/boleto/:nosso\_numero — Buscar

Busca boleto pelo parâmetro nosso\_numero Params: `nosso_numero` (Number, req) RespEx: \[200\] {codigo\_associado,nome\_associado,cpf\_associado,email,codigo\_situacao\_associado,descricao\_situacao\_associado,codigo\_regional\_associado,nome\_regional\_associado,codigo\_boleto,nosso\_numero,codigo\_situacao\_boleto,descricao\_situacao\_boleto,codigo\_regional\_boleto,nome\_regional\_boleto,mes\_referente,data\_emissao,data\_vencimento\_original,data\_vencimento,valor\_boleto,data\_pagamento,valor\_pagamento,data\_credito\_banco,descricao\_forma\_pagamento,descricao\_tipo\_baixa\_boleto,parcela\_paga,qtde\_parcela\_carne,descricao\_tipo\_cobranca\_recorrente,codigo\_tipo\_boleto,descricao\_tipo\_boleto,codigo\_conta,codigo\_banco,nome\_banco,agencia\_bancaria,conta\_bancaria,linha\_digitavel,link\_boleto,pix:{qrcode,copia\_cola},veiculos:\[{codigo\_veiculo,placa,chassi,valor\_fixo,codigo\_situacao\_veiculo,descricao\_situacao\_veiculo,codigo\_tipo\_veiculo,descricao\_tipo\_veiculo,codigo\_modelo,descricao\_modelo,valor\_fipe,codigo\_vencimento\_veiculo,dia\_vencimento\_veiculo,codigo\_tipo\_envio\_boleto,descricao\_tipo\_envio\_boleto,codigo\_cooperativa\_veiculo,nome\_cooperativa\_veiculo}\]}

#### GET /listar/situacao-boleto/:situacao — Listar Situação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_situacaoboleto,descricao,pago:"SIM"}

#### POST /boleto/cadastrar — Cadastrar

Params:

- `codigo_associado` (Number, req)  
- `codigo_regional` (Number, req)  
- `codigo_conta` (Number, req): obrigatório se há mais de uma conta bancária na regional  
- `codigo_situacao` (Number, req): situação do boleto  
- `mes_referente` (String, req)  
- `link_boleto` (Bool, req): retorna o link do boleto  
- `array_parcela` (Array, req): itens {valor, vencimento}. Para gerar carnê, adicione mais posições.  
- `array_parcela.valor` (String, req), `array_parcela.vencimento` (String, req)  
- `referencia` (Array, req): itens {modulo, codigo\_modulo, descricao, codigo\_produto, valor}  
- `referencia.modulo` (String, req): "beneficiário", "veiculo" ou "cliente"  
- `referencia.codigo_modulo` (String, req): código do beneficiário, veículo ou cliente conforme o módulo  
- `referencia.descricao` (String, req)  
- `referencia.codigo_produto` (String, req): omitir índice se não houver produtos  
- `referencia.valor` (String, req)  
- `email` (String, opt)  
- `numero_banco` (Number, opt)  
- `data_emissao` (String, opt)  
- `dados_baixa` (Array, opt): {data\_pagamento (req se dados\_baixa; "dd/mm/yyyy"), data\_credito\_banco, valor\_pagamento (omitido \= total do boleto), codigo\_forma\_pagamento}  
- `considerar_boleto_fechamento` (String, opt, default N)  
- `codigo_tipo_boleto` (Number, opt)  
- `codigo_tipo_cobranca_recorrente` (Number, opt) Resp: `mensagem`, `nosso_numero` ReqEx: {codigo\_associado,codigo\_tipo\_boleto,codigo\_regional,codigo\_conta,codigo\_situacao,mes\_referente,link\_boleto:true,numero\_banco,data\_emissao:"dd/mm/yyyy",considerar\_boleto\_fechamento:"N",dados\_baixa:{data\_pagamento},array\_parcela:\[{valor,vencimento}\],referencia:\[{modulo,codigo\_modulo,descricao,codigo\_produto,valor}\]} RespEx: \[200\] {mensagem:"OK",dados\_boleto\_inserido:\[{nosso\_numero,linha\_digitavel,link\_boleto}\]}

#### POST /boleto/listar-alteracao — Listar Alterações de Boleto

Lista o histórico de alteração dos boletos. Params:

- `data_inicial` (String, req): \[DT\_INI\]  
- `data_final` (String, req): \[DT\_FIM\]  
- `campos` (Array, req): nomes dos campos do boleto a verificar se foram alterados  
- `ultima_alteracao` (String, opt): "Y"/"N" (só a última alteração de cada boleto)  
- `inicio_paginacao` (String, opt): \[INICIO\_PAG\_PAGINA\]  
- `quantidade_por_pagina` (String, opt): \[QTD\_PAG\] ReqEx: {data\_inicial:"dd/mm/yyyy",data\_final:"dd/mm/yyyy",ultima\_alteracao:"Y",campos:\[s\]} RespEx: \[200\] {total,numero\_paginas,mostrando,pagina\_corrente,resultado:\[{codigo\_alteracao,nosso\_numero,nome\_campo\_tabela,valor\_anterior,valor\_posterior,data\_alteracao,observacao,codigo\_usuario\_alteracao,nome\_usuario\_alteracao}\]}

#### POST /listar/boleto-associado/periodo — Listar por período

Lista boletos em um intervalo. Obrigatório enviar ao menos um par de data inicial/final. Intervalo máximo: 31 dias. Params (todos opt; datas dd/mm/yyyy):

- `data_vencimento_inicial`/`data_vencimento_final`, `data_vencimento_original_inicial`/`_final`, `data_pagamento_inicial`/`_final`, `data_emissao_inicial`/`_final`  
- `codigo_situacao_boleto` (Number), `codigo_banco` (Number), `mes_referente` (String, mm/yyyy), `placa` (String)  
- `codigo_regional` (Array), `codigo_voluntario` (Array)  
- `link_boleto` (bool): retorna o link do boleto  
- `codigo_tipo_boleto` (Number): ver GET /listar/tipo-boleto/:situacao  
- `quantidade_por_pagina` (Number): \[QTD\_PAG\]  
- `inicio_paginacao` (Number): \[INICIO\_PAG\_PAGINA\] ReqEx: {data\_emissao\_inicial,data\_emissao\_final} \| {codigo\_banco,data\_pagamento\_inicial,data\_pagamento\_final} \| {codigo\_situacao\_boleto,data\_vencimento\_inicial,data\_vencimento\_final} RespEx: \[200\] {mostrando,numero\_paginas,total\_registros,pagina\_corrente,boletos:\[{nosso\_numero,linha\_digitavel,valor\_boleto,valor\_pagamento,codigo\_tipo\_boleto,tipo\_boleto,codigo\_associado,nome\_associado,cpf,telefone\_fixo,celular,telefone\_comercial,email,email\_auxiliar,data\_inicio\_contrato\_associado,data\_fim\_contrato\_associado,data\_emissao,data\_vencimento,data\_vencimento\_original,data\_pagamento,codigo\_situacao\_boleto,situacao\_boleto,codigo\_banco,mes\_referente,codigo\_mgfformapagamento,veiculos:\[{codigo\_veiculo,codigo\_tipo\_veiculo,codigo\_regional,codigo\_voluntario,placa,chassi,renavam,codigo\_fipe,modelo,ano\_modelo,marca,valor\_protegido,valor\_fipe,valor\_adesao,data\_inicio\_contrato\_veiculo,data\_fim\_contrato\_veiculo,codigo\_tipo\_envio\_boleto,descricao\_tipo\_envio\_boleto,situacao\_veiculo,total\_taxas\_produtos,total\_taxas,taxas:\[{codigo\_classificacaoproduto,descricao\_taxa,valor\_taxa}\]}\]}\]}

#### POST /listar/boleto/periodo — Listar Boleto Associado Beneficiario

Lista boletos de associados ou beneficiários. OBRIGATÓRIO informar ao menos um de: codigo\_beneficiario, codigo\_associado, cpf\_beneficiario, cpf\_associado, chassi, codigo\_veiculo, placa. Params (todos opt):

- `codigo_associado`, `cpf_associado`, `cpf_cliente`, `codigo_beneficiario`, `cpf_beneficiario`, `placa`, `codigo_veiculo`, `chassi` (a doc tipa vários como Number, mas placa/chassi/cpf são strings na prática)  
- `codigo_situacao_boleto` (Number)  
- Filtros de data (String): `data_emissao_inicial/final`, `data_vencimento_inicial/final`, `data_vencimento_original_inicial/final`, `data_credito_banco_inicial/final`, `data_pagamento_inicial/final`  
- `quantidade_por_pagina` (Number): \[QTD\_PAG\]  
- `inicio_paginacao` (Number): \[INICIO\_PAG\_OFFSET\] ReqEx: {codigo\_beneficiario,data\_vencimento\_original\_inicial,data\_vencimento\_original\_final,quantidade\_por\_pagina,inicio\_paginacao} \| {codigo\_associado,codigo\_situacao\_boleto,data\_pagamento\_inicial,data\_pagamento\_final} \| {cpf\_associado,data\_vencimento\_inicial,data\_vencimento\_final} RespEx: \[200\] \[{nosso\_numero,modulo,data\_emissao,data\_vencimento\_original,data\_vencimento,valor\_boleto,valor\_pagamento,data\_pagamento,parcela\_paga,qtde\_parcela\_carne,codigo\_tipo\_boleto,linha\_digitavel,codigo\_situacao\_boleto,situacao\_boleto,tipo\_boleto,link\_boleto,codigo\_associado,cpf,email,email\_auxiliar,nome\_associado,data\_inicio\_contrato\_associado,data\_fim\_contrato\_associado,telefone,celular,pix:{qrcode,"STRING DO PIX COPIA E COLA"},beneficiario:{codigo\_beneficiario,nome,data\_contrato,sexo,situacao},total\_taxas,taxas:\[{descricao\_taxa,valor\_taxa}\],total\_beneficios,beneficios:\[{descricao\_beneficio,valor\_beneficio}\]}\]

#### POST /listar/boleto-associado-veiculo — Listar por associado/veículo

Lista boletos de um associado ou veículo. Obrigatório: código OU cpf do associado, OU código OU placa do veículo, e ao menos um par de data inicial/final. Intervalo máximo: 90 dias. Params:

- `codigo_associado` (Number), `codigo_veiculo` (Number), `cpf_associado` (String), `placa` (String): a doc marca todos como req, mas na prática basta UM identificador (ver descrição)  
- `codigo_situacao_boleto` (Number, opt)  
- Datas (opt): `data_vencimento_inicial/final`, `data_vencimento_original_inicial/final`, `data_pagamento_inicial`, `data_pagamento_finalww` (sic, typo na doc; provável `data_pagamento_final`), `data_emissao_inicial/final`  
- `link_boleto` (bool, opt) ReqEx: {placa,data\_vencimento\_original\_inicial,data\_vencimento\_original\_final} \| {cpf\_associado,data\_emissao\_inicial,data\_emissao\_final} \| {codigo\_associado,data\_pagamento\_inicial,data\_pagamento\_final} \| {codigo\_veiculo,codigo\_situacao\_boleto,data\_vencimento\_inicial,data\_vencimento\_final} RespEx: \[200\] \[{nosso\_numero,linha\_digitavel,codigo\_tipo\_boleto,tipo\_boleto,valor\_boleto,valor\_multa,valor\_mora,valor\_boleto\_multa\_mora,quantidade\_dias\_vencidos,codigo\_associado,nome\_associado,cpf,telefone\_fixo,celular,telefone\_comercial,email,email\_auxiliar,data\_inicio\_contrato\_associado,data\_fim\_contrato\_associado,data\_emissao,data\_vencimento,data\_vencimento\_original,data\_pagamento,codigo\_situacao\_boleto,situacao\_boleto,codigo\_mgfformapagamento,pix:{qrcode,copia\_cola},veiculos:\[{codigo\_veiculo,codigo\_tipo\_veiculo,codigo\_regional,placa,chassi,renavam,codigo\_fipe,modelo,ano\_modelo,marca,valor\_protegido,valor\_fipe,valor\_adesao,data\_inicio\_contrato\_veiculo,data\_fim\_contrato\_veiculo,situacao\_veiculo,total\_taxas\_produtos,total\_taxas,taxas:\[{descricao\_taxa,valor\_taxa}\]}\]}\]

#### GET /listar/conta/:situacao — Listar Contas Bancárias

Lista as contas às quais o usuário tem permissão de acesso Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_conta,codigo\_agencia,codigo\_banco,considerado\_inadimplencia:"Y/N",hinova\_bank:"SIM",situacao}

#### GET /listar/tipo-boleto/:situacao — Listar tipo

Lista os tipos de boletos cadastrados na base Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipo\_boleto,descricao:"FECHAMENTO",boleto\_adesao}

#### GET /tipo-envio-boleto/listar/:situacao — Listar tipo do envio do boleto

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipoenvioboleto,descricao,situacao}

#### GET /listar/forma-pagamento/:situacao — Listar Forma Pag.

Lista as formas de pagamento cadastradas no sistema. Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_mgfformapagamento,descricao:"BOLETO",situacao}

#### GET /tipo-cobranca-recorrente/listar/:situacao — Listar Tipo Cobr. Recorrente

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipocobrancarecorrente,descricao,situacao}

#### POST /processa-pdf/boleto — Lista boleto por nosso numero

Params:

- `nosso_numero` (array, req): array com os nosso\_numero de cada boleto ReqEx: {nosso\_numero:\[n\]} RespEx: \[200\] \[{nome\_associado,cpf\_associado,nome\_regional\_boleto,nosso\_numero,codigo,mes\_referente,data\_vencimento,data\_emissao,linha\_digitavel,valor\_boleto,codigo\_situacao\_boleto,descricao\_situacao\_boleto,codigo\_banco,codigo\_conta,agencia\_bancaria,conta\_bancaria,nome\_banco,descricao\_tipo\_cobranca\_recorrente,pix:{qrcode,copia\_cola},linha\_digitavel\_atualizada,linha\_digitavel\_atual,link\_boleto,veiculos:\[{placa,modelo,cooperativa}\],id}\]

### Módulo: Cooperativa

#### GET /cooperativa/buscar/:codigo\_cooperativa — Buscar

Busca a cooperativa pelo código, respeitando as permissões de cooperativa do usuário. Params: `codigo_cooperativa` (String, req) RespEx: \[200\] {codigo\_cooperativa,nome,cpf,contato,telefone,email,logradouro,numero,complemento,bairro,cidade,estado,cep,formato\_pagamento:"R\$"\|"%",valor\_pagamento,formato\_pagamento\_residual,valor\_pagamento\_residual,situacao}

#### POST /cooperativa/cadastrar — Cadastrar

Params:

- REQ: `nome`, `cpf` (CPF/CNPJ válido), `email`, `telefone` \[MASC\_TEL\]  
- OPT: `contato`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` \[ESTADO\], `cep` \[MASC\_CEP\] Resp: `mensagem`, `codigo_cooperativa` RespEx: \[200\] {mensagem:"OK",codigo\_cooperativa:n}

#### GET /listar/cooperativa/:situacao — Listar

Lista as cooperativas de acordo com a situação e a permissão do usuário (Ativo, Inativo ou Todos; obrigatória) Params: `situacao` \[SITUACAO\] RespEx: \[200\] mesmos campos de "Buscar"

### Módulo: Cota

#### GET /cota/buscar/:codigo\_cota — Buscar

Busca a cota pelo código, respeitando as permissões do usuário. Params: `codigo_cota` (Number, req) RespEx: \[200\] {codigo\_cota,descricao\_cota,cota,valor\_cota,valor\_fipe\_inicial,valor\_fipe\_final,valor\_adesao,participacao\_minima,formato\_cobranca:"%",porcentagem\_fipe,situacao}

#### GET /listar/cota/:codigo\_regional/:codigo\_cooperativa/:codigo\_tipo\_veiculo/:valor\_fipe/:cilindrada — Listar

Lista cotas conforme regional, cooperativa, tipo de veículo, valor Fipe ou cilindrada Params:

- `codigo_regional` (Number, req), `codigo_cooperativa` (Number, req), `codigo_tipo_veiculo` (Number, req)  
- `valor_fipe` (String, req): valor protegido, decimal com vírgula (ex.: 100,00). Enviar 0 se o veículo for baseado em cilindrada.  
- `cilindrada` (String, req): enviar 0 se o veículo for baseado em valor fipe RespEx: \[200\] {mensagem:"OK",cota:\[{codigo\_cota,cota:n,descricao\_cota,valor\_cota,valor\_fipe\_inicial,valor\_fipe\_final,valor\_adesao,participacao\_minima,porcentagem\_fipe,formato\_cobranca,descricao\_tipo\_veiculo,regionais:\[{codigo\_regional,nome\_regional}\]}\]}

### Módulo: Evento

#### GET /evento-sem-alteracao/listar/:quantidade\_dias/:codigo\_situacao — Listar Eventos Sem Alteração

Lista eventos que estão há X dias sem alteração na situação Params: `quantidade_dias` (String, req), `codigo_situacao` (String, req) RespEx: {mensagem:"OK",quantidade\_evento\_fora\_prazo:n,eventos\_fora\_prazo:\[{codigo\_evento,protocolo\_evento,data\_cadastro}\]}

#### POST /listar/alteracao-eventos — Listar Histórico Alteração

Histórico de alteração do evento Params:

- `data_inicial` (String, req): \[DT\_INI\]  
- `data_final` (req): \[DT\_FIM\]  
- `inicio_paginacao` (opt): \[INICIO\_PAG\_PAGINA\]  
- `quantidade_por_pagina` (opt): Se omitido, 100 registros por página.  
- `campos` (Array, req): nomes dos campos do evento a retornar RespEx: {paginacao:{total,numero\_paginas,mostrando,pagina\_corrente},resultado:\[{protocolo\_evento,codigo,codigo\_evento,nome\_campo\_tabela,valor\_anterior,valor\_posterior,codigo\_usuario\_alteracao,nome\_usuario\_alteracao,data\_alteracao}\]}

#### POST /evento-aberto/listar — Listar Eventos Abertos

Quantidade de eventos abertos em um período Params: `data_inicial` (req) \[DT\_INI\], `data_final` (req) \[DT\_FIM\] RespEx: {mensagem:"OK",eventos\_abertos}

#### POST /evento-finalizado/listar — Listar Eventos Finalizados

Quantidade de eventos finalizados em um período Params: `data_inicial` (req) \[DT\_INI\], `data_final` (req) \[DT\_FIM\] RespEx: {mensagem:"OK",eventos\_finalizados}

#### GET /listar/classificacao-evento/:situacao — Listar Classificação

Params: `situacao` \[SITUACAO\] RespEx: \[{codigo:n,descricao:"CONDUTOR",situacao:"A"}\]

#### POST /listar/evento — Listar

Retorna array de eventos conforme filtros. O objeto `condutor` só vem se houver condutor cadastrado no evento. Params:

- `data_cadastro` (String, req): se informada sozinha, retorna eventos cadastrados no dia  
- `protocolo` (String, req): busca por protocolo; anula o filtro de data\_cadastro (a doc marca ambos como req, mas são alternativos)  
- `data_cadastro_final` (String, opt): intervalo máximo de 30 dias  
- `evento_situacao` (Array, opt): filtra por situações  
- `evento_motivo` (Array, opt): filtra por motivos  
- `inicio_paginacao` (opt): \[INICIO\_PAG\_PAGINA\]  
- `quantidade_por_pagina` (opt): padrão 100 RespEx: \[200\] \[{codigo,codigo\_evento,codigo\_classificacao,codigo\_veiculo,codigo\_associado,valor\_reparo,participacao,passivel\_ressarcimento,evento\_tipo:"ASSOCIADO",motivo,envolvimento:"CAUSADOR",situacao\_evento:"ABERTO",data\_evento,hora\_evento,data\_comunicado\_evento,data\_cadastro,hora\_cadastro,logradouro,numero,bairro,cidade,estado,cep,complemento,numero\_bo,solicitou\_carro\_reserva:"SIM",descricao\_evento\_area,evento\_relacionado,protocolo,associado:{codigo,nome,cpf,logradouro,numero,bairro,cidade,estado,cep,sexo,data\_nascimento,cnh,data\_vencimento\_habilitacao,rg,email,email\_auxiliar,telefone,telefone\_celular,telefone\_comercial},veiculo:{codigo,placa,data\_contrato,chassi,ano\_fabricacao,ano\_modelo,valor\_fipe,renavam,quantidade\_portas,numero\_motor,tipo,modelo,cor,situacao,marca,categoria,classificacao,combustivel},regional:{codigo,descricao},cooperativa:{codigo,descricao},voluntario:{codigo,descricao},condutor:{nome,cpf,logradouro,numero,bairro,cidade,estado,cep,telefone}}\] RespEx: \[406\] {mensagem,error:\[s\]}

#### GET /listar/evento-veiculo/:placa\_ou\_codigo — Listar por veículo

Params: `placa_ou_codigo` (String, req) RespEx: \[200\] {token\_fornecedor,eventos:\[{codigo\_evento,protocolo,codigo\_associado,cpf\_associado,nome\_associado,codigo\_veiculo,placa,data\_evento,hora\_evento,data\_cadastro\_evento,hora\_cadastro\_evento,envolvimento\_terceiros:"N",valor\_reparo:n,codigo\_situacao\_evento,descricao\_evento\_area,situacao\_evento,codigo\_motivo,descricao\_motivo}\]}

#### GET /listar/motivo-evento/:situacao — Listar Motivos

Params: `situacao` \[SITUACAO\] RespEx: \[{codigo:n,descricao,situacao:"A"}\]

#### GET /situacao-evento/listar/:situacao — Listar Situações Evento

Params: `situacao` \[SITUACAO\] RespEx: \[{codigo\_eventosituacao,descricao:"ABERTO",situacao:"ATIVO"}\]

#### GET /listar/situacao-evento/:situacao — Listar Situações

Params: `situacao` \[SITUACAO\] RespEx: \[{codigo:n,descricao:"ABERTO",situacao:"A"}\]

#### GET /veiculo-reparo-oficina/listar — Veículos por Oficina/Fornecedor

Quantidade de veículos por oficina/fornecedor RespEx: \[{codigo\_fornecedor\_oficina:n,quantidade\_veiculos}\]

### Módulo: Fornecedor

#### GET /acionamento-fornecedor/buscar/:buscar\_por/:filtro — Buscar Acionamento Fornecedor

Params: `buscar_por` (String, req): parâmetro de consulta; `filtro` (String, req): valor pesquisado RespEx: \[200\] \[{codigo,codigo\_veiculo,codigo\_associado,codigo\_fornecedor,protocolo,produto,servico,motivo,situacao,data\_acionamento:"yyyy-mm-dd",hora\_acionamento,data\_conclusao\_acionamento,hora\_conclusao\_acionamento,data\_ocorrencia,hora\_ocorrencia}\]

#### GET /fornecedor/buscar/:cpf\_cnpj — Buscar

Params: `cpf_cnpj` (String, req) RespEx: \[200\] {mensagem:"OK",codigo\_fornecedor,nome,nome\_fantasia,cpf\_cnpj,telefone,email,situacao:"A"}

#### POST /fornecedor/cadastrar — Cadastrar

Cadastra um fornecedor. Params:

- REQ: `cpf` (CPF/CNPJ válido), `nome`, `telefone` \[MASC\_TEL\]  
- OPT: `nome_fantasia`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` \[ESTADO\], `cep` \[MASC\_CEP\], `email` Resp: `mensagem`, `codigo_fornecedor` RespEx: \[200\] {mensagem:"OK",codigo\_fornecedor:n}

#### GET /listar/acionamento-fornecedor/:inicio\_paginacao/:quantidade\_por\_pagina — Listar Acionamento Fornecedor

Params (no PATH): `quantidade_por_pagina` (Number, req) \[QTD\_PAG\]; `inicio_paginacao` (Number, req) \[INICIO\_PAG\_PAGINA\] RespEx: \[200\] \[{codigo,codigo\_veiculo,codigo\_associado,codigo\_fornecedor,protocolo,produto,servico,motivo,situacao,data\_acionamento:"yyyy-mm-dd",hora\_acionamento,data\_conclusao\_acionamento,hora\_conclusao\_acionamento,data\_ocorrencia,hora\_ocorrencia}\]

#### GET /listar/fornecedor/:situacao — Listar

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_fornecedor,nome,nome\_fantasia,cpf\_cnpj,telefone,email,situacao} RespEx: \[204\] (sem conteúdo)

### Módulo: Indicacao\_Externa

#### POST /indicacao-externa/buscar — Buscar

Busca uma indicação externa por código, CPF ou nome. Params (todos opt; enviar um deles):

- `nome` (String), `cpf` (String), `codigo_indicacaoexterna` (Number) ReqEx: {nome:"Hinova"} \| {cpf:"..."} \| {codigo\_indicacaoexterna:"999"} RespEx: \[200\] \[{codigo\_indicacaoexterna,nome,cpf,telefone,email,observacao,situacao}\]

#### POST /indicacao-externa/cadastrar — Cadastrar Indicação Externa

Params: REQ `nome`; OPT `cpf`, `ddd_telefone`, `telefone` (String), `codigo_associado_indicador` (Number), `codigo_veiculo_indicador` (Number) ReqEx: {nome,cpf,ddd\_telefone,telefone,codigo\_associado\_indicador:999,codigo\_veiculo\_indicador:99} RespEx: \[200\] {mensagem:"OK",codigo\_indicacaoexterna}

#### GET /indicacao-externa/listar/:situacao — Listar Indicação Ext.

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_indicacaoexterna,nome,cpf,codigo\_associado\_indicador,codigo\_veiculo\_indicador,situacao}

### Módulo: Produto

#### GET /produto/buscar/:codigo\_produto — Buscar

Busca o produto pelo código, respeitando as permissões do usuário. Params: `codigo_produto` (Number, req) RespEx: \[200\] {codigo\_produto,descricao,descricao\_boleto,codigo\_fornecedor,nome\_fornecedor,codigo\_classificacaoproduto,situacao}

#### POST /veiculo/incluir/produto-adicional — Cadastrar Prod. Adicional

Cadastra um produto adicional a um veículo Params (todos req na doc, exceto onde indicado):

- `codigo_veiculo` (String)  
- `descricao` (String)  
- `valor` (Number)  
- `formato` (String): "R\$" ou "%"  
- `codigo_classificacao` (String): "Opcional" segundo a descrição  
- `mes_referente` (String): mês inicial da cobrança "mm/yyyy"  
- `mes_referente_final` (String): mês final da cobrança "mm/yyyy" RespEx: \[200\] {mensagem:"OK",codigo\_produto\_adicional}

#### GET /listar/produto/:codigo\_regional/:codigo\_cooperativa/:codigo\_tipo\_veiculo/:valor\_fipe/:cilindrada — Listar

Lista produtos filtrando por regional, cooperativa, tipo veículo, valor Fipe ou cilindrada, respeitando permissões do usuário Params (todos req): `codigo_regional` (Number), `codigo_cooperativa` (Number), `codigo_tipo_veiculo` (Number), `valor_fipe` (String, decimal com vírgula; 0 se baseado em cilindrada), `cilindrada` (String; 0 se baseado em fipe) RespEx: \[200\] {codigo\_produto,decricao\_produto,descricao\_produto\_boleto,valor\_produto,valor\_fipe\_inicial:n,valor\_fipe\_final:n,padrao:"N",compulsorio:"N",formato\_cobranca,base\_cobranca:"FIPE",codigo\_tipo\_veiculo,descricao\_tipo\_veiculo,regionais:\[{codigo\_regional,nome\_regional}\]}  (sic: "decricao\_produto")

#### GET /listar/produto-por-situacao/:situacao — Listar Por Situação

Lista todos os produtos na situação enviada, respeitando permissões. NÃO usa os filtros regional/cooperativa/tipo veículo/fipe/cilindrada (esses são de /listar/produto). Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_produto,descricao\_produto,codigo\_fornecedor,codigo\_classificacaoproduto,descricao\_produto\_boleto,tipo\_veiculo,descricao\_tipo\_veiculo,valor\_produto,valor\_fipe\_inicial:n,valor\_fipe\_final:n,padrao:"Y",formato\_cobranca,situacao,cooperativas:\[{codigo\_cooperativa,nome}\],regionais:\[{codigo\_regional,nome}\]}

#### GET /listar/produto-por-situacao/:situacao/:pg/:limit — Listar Por Situação Paginado

Igual ao anterior, com paginação. Params: `situacao` (req) \[SITUACAO\]; `pg` (Number, opt) \[INICIO\_PAG\_PAGINA\]; `limit` (Number, opt) \[QTD\_PAG\] RespEx: \[200\] mesma estrutura de "Listar Por Situação"

#### GET /listar/classificacao-produto/:situacao — Listar Classificação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_classificacaoproduto,descricao}

#### GET /listar/grupo-produto/:situacao — Listar grupo

Lista os grupos de produto conforme `situacao` Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_grupo,descricao,pre\_contratado:"Y",respeitar\_cooperativa\_regional:"Y",situacao}

#### GET /grupoproduto/listar/:situacao — Listar Grupo Produto

Lista os grupos de produtos (com seus produtos) conforme a situação Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_grupo:n,produtos:\[{codigo\_produto:n,descricao\_produto,valor}\]}

#### POST /veiculo/listar-produto-adicional — Listar Prod. Adicional

Lista os produtos adicionais vinculados a um veículo Params (todos req): `codigo_veiculo` (Number), `data_cadastro_inicial` ("dd/mm/yyyy"), `data_cadastro_final` ("dd/mm/yyyy") RespEx: \[200\] {mensagem:"OK",codigo\_veiculo,produtos\_adicionais:\[{codigo\_produto\_adicional,codigo\_classificacaoproduto,descricao,valor:n,formato:"R",base\_cobranca,mes\_referente:"mm/yyyy",mes\_referente\_final:"mm/yyyy",situacao}\]}

#### GET /produto-vinculado-veiculo/listar/:codigoOuPlaca — Listar Produtos Veículo

Lista todos os produtos de um veículo Params: `codigoOuPlaca` (Number, req; aceita código ou placa) RespEx: \[200\] {codigo\_veiculo,valor\_fixo:n,valor\_total\_produtos\_RS:n,"valor\_total\_produtos\_%":n,codigo\_cota,valor\_fipe:n,valor\_total\_produtos\_ativo\_reais:n,valor\_total\_produtos\_ativo\_porcento:n,produtos:\[{codigo\_produto,descricao,descricao\_boleto,codigo\_classificacao\_produto,formato\_cobranca,valor,situacao}\],produtos\_adicionais:\[{codigo\_produto\_adicional,descricao,valor:n,codigo\_classificacao\_produto,formato,base\_cobranca,mes\_referente:"yyyy-mm",mes\_referente\_final:"yyyy-mm",situacao:"A"}\]}

#### POST /veiculo/vincular-remover/produto — Vincular ou remover produto

Vincula ou exclui produtos de um veículo NOTA: sem header documentado (usar o padrão) Params (todos req): `codigo_veiculo` (Number), `produtos_adicionar` (Array de códigos), `produtos_remover` (Array de códigos) ReqEx: {codigo\_veiculo:n,produtos\_adicionar:\[s\],produtos\_remover:\[s\]} RespEx: \[200\] {codigo\_produto,mensagem}

### Módulo: Proprietario

#### POST /proprietario/alterar — Alterar

Params: REQ `codigo` (String); OPT `nome`, `cpf` (CPF/CNPJ), `cnh`, `rg`, `telefone`, `telefone_celular`, `telefone_comercial` \[MASC\_TEL\], `data_nascimento` (Date dd/mm/yyyy), `idade`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` \[ESTADO\], `cep` \[MASC\_CEP\] Resp: `mensagem`, `codigo_proprietario` ReqEx: {nome,cpf,cnh,rg,categoria\_cnh:"A",data\_nascimento:"01/01/1990",logradouro,numero,complemento,bairro,cidade,estado,cep,telefone,telefone\_comercial,telefone\_celular,idade} RespEx: \[200\] {codigo,nome,cpf,cnh,rg,categoria\_cnh,data\_nascimento:"yyyy-mm-dd",logradouro,numero,complemento,bairro,cidade,estado,cep,telefone,telefone\_comercial,telefone\_celular,idade,situacao:"A",data\_cadastro:"yyyy-mm-dd"}

#### GET /proprietario/buscar/:codigoOuCpf — Buscar

Params: `codigoOuCpf` (String, req) RespEx: \[200\] mesma estrutura do retorno de "Alterar"

#### POST /proprietario/cadastrar — Cadastrar

Params (TODOS req na doc): `nome`, `cpf`, `cnh`, `rg`, `telefone`, `telefone_celular`, `telefone_comercial` \[MASC\_TEL\], `data_nascimento` (Date dd/mm/yyyy), `idade`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` \[ESTADO\], `cep` \[MASC\_CEP\] Resp: `mensagem`, `codigo_proprietario` RespEx: \[200\] mesma estrutura do retorno de "Alterar"

#### GET /listar/proprietario/:inicio\_paginacao/:quantidade\_por\_pagina — Listar

Params (no PATH): `quantidade_por_pagina` (Number, opt) \[QTD\_PAG\]; `inicio_paginacao` (Number, opt) \[INICIO\_PAG\_PAGINA\] RespEx: \[200\] mesma estrutura do retorno de "Alterar"

### Módulo: Regional

#### POST /regional/cadastrar/ — Cadastrar

Params:

- REQ: `nome`, `nome_fantasia`, `cnpj` (CNPJ válido; 99.999.999/9999-99 ou só números), `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` \[ESTADO\], `cep` \[MASC\_CEP\], `telefone` \[MASC\_TEL\], `email`  
- OPT: `website` Resp: `mensagem`, `codigo_regional` RespEx: \[200\] {mensagem:"OK",codigo\_regional:n}

#### GET /listar/regional/:situacao — Listar

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_regional:n,descricao\_regional,situacao}

### Módulo: Termo

#### POST /termo/emitir — Emitir

Emite um termo. Params:

- `codigo_termo` (Number, req), `codigo_associado` (Number, req)  
- `codigo_beneficiario` (Number, opt): obrigatório se for termo de beneficiário  
- `codigo_veiculo` (Number, opt): obrigatório se for termo de veículo  
- `codigo_evento` (Number, opt): obrigatório se for termo de evento  
- `ferramenta` (String, opt): obrigatório somente se GET /termo/listar retornar `ferramenta`\="NOVOTERMO" RespEx: {codigo\_emissao,link\_pdf}

#### GET /termo/listar — Listar

Lista todos os termos do SGA. RespEx: \[{codigo,nome,tipo,permitir\_aceite\_digital:"Y/N",situacao:"ATIVO/INATIVO",ferramenta:"NOVOTERMO"\|"TERMO"}\]

#### POST /termo/novo-aceite-digital/ — Aceite Digital

Faz o aceite digital de um termo. Params:

- `codigo_emissao` (Number, req): obtido ao emitir o termo  
- `aceito` (Boolean, req): aceito ou negado  
- `ip` (String, req): IP do usuário que aceita o termo  
- `ferramenta` (String, opt): obrigatório somente se termo/listar retornar "NOVOTERMO" RespEx: {mensagem,sucesso}

### Módulo: Veiculo

#### POST /alterar/veiculo — Alterar

Params (único obrigatório: `codigo_veiculo`; demais opt):

- `codigo_veiculo` (Number, req)  
- Vínculos: `codigo_associado`, `codigo_cooperativa` (selecionado conforme permissão do usuário), `codigo_voluntario` (selecionado conforme a cooperativa)  
- Identificação: `ano_fabricacao`, `ano_modelo` (Number, máscara 9999), `placa` (String; ZERO KM pode omitir/vazio), `chassi`, `renavam`, `numero_motor` (String), `kilometragem` (Number), `cilindrada` (Number; motocicleta), `quantidade_portas`, `cambio` (String: A=automático, M=manual, 0=não informado), `codigo_fipe` (String; localiza MARCA/MODELO; máscaras 999999-9, 999999.9, 9999999), `codigo_modelo`  
- Cobrança/cota: `codigo_cota` (Number; selecionada por valor fipe, tipo, regional e cooperativa), `codigo_conta` (Number; doc diz "cota bancária"), `dia_vencimento`, `codigo_tipo_envio_boleto`, `codigo_tipo_cobranca_recorrente`, `valor_fipe` (Number, 999999.99), `valor_fipe_protegido` (Number, 999999.99), `porcentagem_fipe_protegido`, `valor_adesao` (String, 999999.99), `valor_repasse` (String), `forma_pagamento_repasse` ("R\$" ou "%"), `gerar_cobranca_taxa_adm` ("Y"/"N"), `gerar_cobranca_rateio` ("Y"/"N"), `codigo_forma_pagamento_protecao`, `codigo_grupo_produto`  
- Classificação: `codigo_alienacao`, `codigo_combustivel`, `codigo_cor`, `codigo_tipo_veiculo`, `codigo_categoria_veiculo`, `codigo_classificacao`, `codigo_tipo_carga`, `codigo_tipo_adesao`, `codigo_tipo_carroceria`, `quantidade_passageiros`  
- Endereço de correspondência: `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep`. Se QUALQUER campo do endereço (exceto complemento) for enviado, os demais tornam-se obrigatórios.  
- Outros: `codigo_indicacao_externa`, `numero_nota` (Number), `data_emissao_nota`, `data_contrato`, `codigo_veiculo_indicador` (o veículo indicador ganha 1 ponto), `observacao`, `transferir_agregados` (Array de códigos de agregados; usar em troca de titularidade, junto com novo `codigo_associado`) Resp: `mensagem`, `codigo_veiculo` RespEx: \[200\] {mensagem,codigo\_veiculo:n}

#### POST /veiculo/alterar-situacao-para — Alterar situação com Motivo

Altera a situação do veículo e vincula uma situação-motivo Params: `codigo_situacao` (String, req), `codigo_veiculo` (string, req), `codigo_situacaomotivo` (string, opt), `observacao` (string, opt; obrigatória se a situação-motivo exigir) RespEx: \[200\] {mensagem,codigo\_veiculo:n}

#### GET /veiculo/alterar-situacao-para/:codigo\_situacao/:codigo\_veiculo — Alterar situação

Altera a situação do veículo Params: `codigo_situacao` (String, req), `codigo_veiculo` (string, req) RespEx: \[200\] {mensagem,codigo\_veiculo:n}

#### GET /veiculo/buscar/:placaOuChassi/:buscar\_por — Buscar

Dados do veículo pela placa ou chassi. Params: `placaOuChassi` (String, req); `buscar_por` (String, opt): especifica o campo da busca RespEx: \[200\] \[{codigo\_veiculo,codigo\_depreciacao,placa,chassi,codigo\_fipe,valor\_fipe,valor\_fixo,valor\_adesao,participacao,codigo\_classificacao,codigo\_tipo\_envio\_boleto,descricao\_tipo\_envio\_boleto,forma\_pagamento\_protecao,ano\_fabricacao,ano\_modelo,renavam,codigo\_cota,cota,codigo\_regional,codigo\_cooperativa,codigo\_associado,codigo\_tipo\_veiculo,codigo\_categoria,tipo,categoria,codigo\_marca,marca,codigo\_modelo,modelo,codigo\_combustivel,codigo\_cor,nome,rg,cpf,telefone,ddd,telefone\_celular,ddd\_celular,telefone\_celular\_aux,ddd\_celular\_aux,telefone\_comercial,ddd\_comercial,email,logradouro,numero,complemento,bairro,cidade,estado,cep,codigo\_situacao,data\_cadastro:"yyyy-mm-dd",hora\_cadastro,data\_contrato,data\_reativacao,descricao\_situacao,codigo\_voluntario,nome\_voluntario,cpf\_voluntario,codigo\_veiculo\_vinculado}\]

#### GET /veiculo/buscar-por-permissao/:placaOuChassi/:buscar\_por — Buscar por permissão

Igual a "Buscar", validando permissões de regional e cooperativa do usuário. Params: `placaOuChassi` (String, req); `buscar_por` (String, opt) RespEx: \[200\] mesma estrutura de "Buscar"

#### POST /buscar/rateio-medio — Buscar rateio

Calcula o rateio médio para veículos de uma cota, baseado em valor fipe, tipo de veículo e regional. Params: `valor_fipe` (Number, req), `codigo_regional` (Number, req), `codigo_tipo_veiculo` (Number, req), `quantidade_meses_media` (Number, opt; padrão: últimos 3 meses) Resp: `mensagem`, `valor_rateio_medio` ReqEx: {valor\_fipe,codigo\_regional:n,codigo\_tipo\_veiculo,quantidade\_meses\_media} RespEx: \[200\] {mensagem:"OK",valor\_rateio\_medio}

#### GET /buscar/situacao-financeira-veiculo/:codigo\_ou\_placa — Buscar situação Financeira

Busca a situação financeira do veículo Params: `codigo_ou_placa` (String, req) RespEx: \[200\] {cpf,nome,codigo\_veiculo,placa,chassi,codigo\_modelo,descricao\_modelo,participa\_fechamento:"SIM",codigo\_situacao\_veiculo,descricao\_situacao\_veiculo,situacao\_financeira:"ADIMPLENTE"}

#### POST /veiculo/cadastrar — Cadastrar

Params:

- REQ: `codigo_associado` (Number), `ano_fabricacao` (Number, 9999), `ano_modelo` (Number, 9999), `codigo_tipo_veiculo` (Number), `kilometragem` (Number), `chassi` (String), `numero_motor` (String), `codigo_fipe` (String; localiza MARCA/MODELO; máscaras 999999-9, 999999.9, 9999999), `codigo_voluntario` (Number), `dia_vencimento` (Number), `renavam` (String)  
- OPT identificação: `codigo_cooperativa` (selecionada conforme permissão do usuário), `codigo_externo`, `codigo_modelo`, `placa` (ZERO KM: omitir ou vazio), `cilindrada` (motocicleta), `quantidade_portas`, `cambio` (A=automático, M=manual, 0=não informado), `quantidade_passageiros`, `valor_fipe` (Number)  
- OPT cobrança/cota: `codigo_cota` (selecionada por valor fipe, tipo, regional e cooperativa), `codigo_conta` (doc diz "cota bancária"), `valor_adesao` (String), `codigo_forma_pagamento_adesao`, `codigo_depreciacao`, `valor_fipe_protegido`, `valor_fixo`, `porcentagem_fipe_protegido`, `participacao` (valor da participação), `codigo_tipo_envio_boleto`, `valor_repasse` (String), `forma_pagamento_repasse` ("R\$" ou "%"), `exibir_extrato_rateio` ("Y"/"N"), `gerar_cobranca_rateio` ("Y"/"N"), `formato_cobranca` (B ou C), `qtde_parcela` (String), `codigo_forma_pagamento_protecao`  
- OPT classificação: `codigo_alienacao`, `codigo_combustivel`, `codigo_cor`, `codigo_categoria_veiculo`, `codigo_tabela_avaliacao`, `codigo_tipo_adesao`, `codigo_tipo_carroceria`, `codigo_classificacao`, `codigo_tipo_carga`, `codigo_grupo_produto`  
- OPT endereço de correspondência: `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` \[ESTADO\], `cep` \[MASC\_CEP\]. Se qualquer campo do endereço (exceto complemento) for enviado, os demais tornam-se obrigatórios.  
- OPT outros: `numero_nota` (Number), `data_emissao_nota`, `data_contrato`, `codigo_veiculo_indicador` (veículo indicador recebe 1 ponto), `codigo_indicacao_externa`, `observacao`  
- `produtos` (Array, opt): \[{codigo\_produto}\]. Produtos compulsórios compatíveis com o perfil do veículo são vinculados automaticamente.  
- `implementos` (Array, opt): \[{codigo\_implemento, valor\_fipe, somar\_fipe:"Y"/"N"}\] Resp: `mensagem`, `codigo_veiculo` ReqEx: {codigo\_associado:9,codigo\_cooperativa:9,codigo\_voluntario:9,codigo\_fipe:"999999-9",ano\_fabricacao:"9999",ano\_modelo:"9999",placa:"AAA-1234",chassi:s,renavam:s,numero\_motor:s,kilometragem:s,codigo\_alienacao,codigo\_combustivel,codigo\_cor,codigo\_tipo\_veiculo,codigo\_tipo\_adesao,codigo\_tipo\_carga,codigo\_tipo\_carroceria,codigo\_categoria\_veiculo,codigo\_cota,codigo\_conta:0,valor\_fixo:"0.00",dia\_vencimento:10,logradouro,numero,complemento,bairro,cidade,estado,cep,numero\_nota,data\_emissao\_nota:"dd/mm/yyyy",quantidade\_portas,cambio:"M",valor\_adesao:"99,99",data\_contrato:"dd/mm/yyyy",codigo\_externo,codigo\_forma\_pagamento\_adesao,porcentagem\_fipe\_protegido:"9,99",participacao:"9,99",codigo\_tipo\_envio\_boleto,codigo\_indicacao\_externa,codigo\_tabela\_avaliacao,quantidade\_passageiros,exibir\_extrato\_rateio:"Y",gerar\_cobranca\_rateio:"Y",observacao,produtos:\[{codigo\_produto}\],implementos:\[{codigo\_implemento:"1999",valor\_fipe:"55,26",somar\_fipe:"Y"}\]} RespEx: \[200\] {mensagem:"OK",codigo\_veiculo:n,produtos:\[{codigo\_produto,situacao}\]}

#### POST /veiculo/observacao/cadastrar — Cadastrar Observação

Cria uma observação para um veículo. Params (todos req): `codigo_associado` (Integer), `codigo_veiculo` (Integer), `observacao` (String) RespEx: \[200\] {codigo\_observacao}

#### POST /veiculo/foto/cadastrar — Cadastrar foto

Adiciona fotos ao veículo, ao beneficiário ou ao evento. Enviar para UM objeto por vez. Foto como URL ou binário. Limite de 50 fotos por requisição. Formatos: .png, .jpeg, .jpg, .pdf Params:

- `codigo_veiculo` (Number, opt), `codigo_beneficiario` (Number, opt)  
- `codigo_evento` (Number, opt): se enviado, é obrigatório enviar também um `codigo_veiculo` que esteja no evento  
- `foto` (Array, req): itens {nome\_arquivo (nome salvo), codigo\_tipo (tipo da foto), binario (arquivo) OU link (URL), observacao}. Se `link` é informado, `binario` não é enviado. ReqEx (veículo+evento): {codigo\_veiculo,codigo\_evento,foto:\[{nome\_arquivo,codigo\_tipo,link,observacao}\]} ReqEx (veículo): {codigo\_veiculo,foto:\[...\]}   ReqEx (beneficiário): {codigo\_beneficiario,foto:\[...\]} RespEx: \[200\] \[{nome\_arquivo,situacao}\]

#### POST /cadastrar/agregado — Cadastrar Agregado

Cadastra um agregado vinculado a um veículo. Params:

- REQ: `codigo_veiculo_vinculado` (Number), `ano_fabricacao`, `ano_modelo`, `chassi`, `numero_motor`, `codigo_tipo_veiculo`, `codigo_cota` (selecionar via listar/cota)  
- OPT: `codigo_voluntario`, `codigo_externo`, `codigo_modelo` e `codigo_marca` (String; use se enviar codigo\_fipe), `placa`, `renavam`, `kilometragem`, `cilindrada`, `cambio`, `codigo_fipe`, `dia_vencimento`, `codigo_alienacao`, `codigo_combustivel`, `codigo_cor`, `codigo_categoria_veiculo`, endereço (`logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep`: se um é enviado, os demais são obrigatórios), `numero_nota`, `data_emissao_nota`, `data_contrato`, `valor_adesao`, `codigo_veiculo_indicador`, `codigo_forma_pagamento_adesao`, `codigo_depreciacao`, `valor_fipe_protegido`, `valor_fipe`, `codigo_tabela_avaliacao`, `codigo_classificacao`, `produtos` (Array) Resp: `mensagem`, `codigo_agregado` ReqEx: {codigo\_veiculo\_vinculado,codigo\_modelo,valor\_fipe,ano\_fabricacao,placa,chassi,codigo\_cota,codigo\_voluntario,dia\_vencimento,codigo\_tipo\_veiculo,codigo\_categoria\_veiculo,codigo\_forma\_pagamento\_adesao,codigo\_tabela\_avaliacao,produtos:\[{codigo\_produto}\]} RespEx: \[200\] {mensagem:"OK",codigo\_veiculo:n,produtos:\[{codigo\_produto,situacao}\]}

#### GET /listar/alienacao/:situacao — Listar Alienação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_alienacao:n,nome\_alienacao,ddd,telefone,ddd\_telefone\_comercial,telefone\_comercial}

#### POST /listar/alteracao-veiculos — Listar Alterações de Veículos

Lista as alterações de veículos em um intervalo de até 7 dias Params:

- `data_inicial` (String, req): \[DT\_INI\]; `data_final` (String, req): \[DT\_FIM\]  
- `campos` (Array, req): nomes dos campos do veículo a retornar  
- `valor_anterior` (Array, opt), `valor_posterior` (Array, opt), `codigo_objeto` (int, opt)  
- `ultima_alteracao` (String, opt): "Y"/"N"  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]; `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_PAGINA\] ReqEx: {data\_inicial:"dd/mm/yyyy",data\_final:"dd/mm/yyyy",ultima\_alteracao:"Y",valor\_anterior:\[n\],valor\_posterior:\[n\],campos:\[s\]} RespEx: \[200\] \[{codigo\_alteracao,codigo\_veiculo,placa,chassi,nome\_campo\_tabela,valor\_anterior,valor\_posterior,data\_alteracao,hora\_alteracao,codigo\_usuario\_alteracao,codigo\_situacaomotivo,nome\_usuario\_alteracao,observacao}\]

#### GET /listar/categoria-veiculo/:codigo\_tipo/:situacao — Listar categoria

Lista as categorias por tipo de veículo e situação (ambos obrigatórios) Params: `codigo_tipo` (String, req): só retorna categorias associadas a esse tipo; `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_categoria,descricao\_categoria,codigo\_tipo\_veiculo,situacao,valor\_adesao,participacao\_minima,porcentagem\_fipe}

#### GET /listar/classificacao-veiculo/:situacao — Listar Classificacao

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo,descricao,situacao}

#### GET /listar/combustivel/:situacao — Listar combustível

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_combustivel,descricao\_combustivel}

#### GET /listar/conta/:situacao — Listar conta bancária

Contas às quais o usuário tem acesso Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_conta:n,codigo\_agencia:n,codigo\_banco:n,descricao\_banco,situacao}

#### GET /listar/cor/:situacao — Listar cor

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_cor,descricao\_cor}

#### GET /listar/depreciacao/:situacao — Listar Depreciação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_depreciacao,descricao,porcentagem\_depreciacao:n,padrao:"Y",situacao}

#### GET /listar/situacao/:situacao — Listar situação

(idêntico a Associado)

#### GET /buscar/situacao-veiculo/:placaOuChassi — Buscar situação veículo

Params: `placaOuChassi` (String, req) RespEx: \[200\] {codigo\_veiculo,placa,chassi,codigo\_situacao}

#### GET /listar/tabela-avaliacao/:situacao — Listar Tabela de Avaliação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_tabela\_avaliacao,descricao,situacao}\]

#### GET /tipo-adesao/listar/:situacao — Listar Tipo Adesão

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipoadesao,descricao,situacao}

#### GET /tipo-carga/listar/:situacao — Listar Tipo Carga

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipocarga,descricao,situacao}

#### GET /tipo-carroceria/listar/:situacao — Listar Tipo Carroceria

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipocarroceria,descricao,situacao}

#### GET /listar/tipo-veiculo/:situacao — Listar tipo

Tipos de veículo conforme permissão do usuário e situação Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_tipo:n,descricao\_tipo,cota\_fipe\_cilindrada:"FIPE"\|"CILINDRADA",situacao}

#### POST /listar/veiculo — Listar

Lista veículos por situação. Limite de 5000 por requisição. Params:

- `codigo_situacao` (String, req)  
- `codigo_voluntario` (String, opt)  
- `codigo_situacao_associado` (String, opt): código único ou array de códigos  
- `data_contrato` \+ `data_contrato_final` (String, opt, máscara Y-m-d): enviar SEMPRE JUNTOS; filtram pela data de contrato inicial do veículo  
- `data_cadastro` \+ `data_cadastro_final` (String, opt, máscara Y-m-d): enviar SEMPRE JUNTOS  
- `codigo_associado` (String, opt)  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]; `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_OFFSET\] RespEx: \[200\] {mensagem,total\_veiculos,mostrando,numero\_paginas,pagina\_corrente,veiculos:\[{codigo\_veiculo,placa,chassi,renavam,codigo\_associado,codigo\_usuario,codigo\_tipo,codigo\_classificacao,codigo\_cota,codigo\_fipe,valor\_fipe,valor\_fipe\_protegido,valor\_fixo,pontos,data\_reativacao,data\_alteracao,codigo\_depreciacao,codigo\_tipo\_envio\_boleto,codigo\_regional,codigo\_cooperativa,codigo\_marca,codigo\_modelo,ano\_fabricacao,ano\_modelo,codigo\_combustivel,codigo\_cor,codigo\_tipo\_adesao,codigo\_grupo\_produto,codigo\_vencimento,boleto\_fisico,mes\_final\_carne,mes\_referente,valor\_adesao,codigo\_categoria,tipo,categoria,marca,modelo,nome\_associado,codigo\_situacao\_associado,rg\_associado,cpf\_associado,telefone,ddd,telefone\_celular,ddd\_celular,telefone\_celular\_aux,ddd\_celular\_aux,telefone\_comercial,ddd\_comercial,email,codigo\_situacao,usuario\_cadastro,data\_cadastro,hora\_cadastro,data\_contrato,data\_contrato\_final,codigo\_voluntario,nome\_voluntario,cpf\_voluntario,codigo\_tabela\_avaliacao}\]}

#### GET /veiculo/listar-veiculo-produto/:codigo\_situacao/:inicio\_paginacao/:quantidade\_por\_pagina — Lista prod. vinculado

Lista veículos na situação informada e os produtos vinculados a cada um Params: `codigo_situacao` (String, req); `quantidade_por_pagina` (Number, opt) \[QTD\_PAG\]; `inicio_paginacao` (Number, opt) \[INICIO\_PAG\_PAGINA\] RespEx: \[200\] {codigo\_veiculo,placa,chassi,renavam,codigo\_associado,codigo\_tipo,codigo\_categoria,descricao\_tipo,descricao\_categoria,descricao\_cota,valor\_fipe:n,valor\_fixo:n,km:n,numero\_motor,descricao\_combustivel,descricao\_cor,ano\_modelo:n,ano\_fabricacao:n,descricao\_marca,descricao\_modelo,nome,rg,cpf,telefone,ddd,telefone\_celular,ddd\_celular,telefone\_celular\_aux,ddd\_celular\_aux,telefone\_comercial,ddd\_comercial,email,data\_cadastro\_veiculo,data\_contrato\_veiculo,hora\_cadastro\_veiculo,produtos\_vinculados:\[{codigo\_produto,codigo\_veiculo,valor\_produto,descricao\_produto,descricao\_boleto}\]}

#### GET /listar/forma-pagamento/:situacao — Listar Forma Pag.

(idêntico a Boleto)

#### GET /implemento-vinculado/listar/:codigoOuPlaca — Listar Implementos Vinculados

Params: `codigoOuPlaca` (String, req) RespEx: \[200\] {codigo\_veiculo:n,codigo\_implemento:n,valor\_fipe\_implemento,porcentagem:n,somar\_fipe:"N",codigo\_usuario:n,data\_cadastro,hora\_cadastro}

#### GET /listar/implemento/:situacao — Listar Implementos

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_implemento,descricao,situacao}

#### GET /listar/marca/:situacao — Listar marca

Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_marca,descricao,situacao}

#### POST /veiculo/listar-observacao — Listar Observações

Lista observações do veículo, com filtro por data OU código do veículo. Limite: 1000 por requisição. Params:

- `codigo_veiculo` (Number, opt): obrigatório se não filtrar por data  
- `data_cadastro_inicial` (String, opt): DD/MM/YYYY; obrigatório se não filtrar por codigo\_veiculo  
- `data_cadastro_final` (String, opt): DD/MM/YYYY; idem  
- `quantidade_por_pagina` (Number, opt): \[QTD\_PAG\]; `inicio_paginacao` (Number, opt): \[INICIO\_PAG\_OFFSET\] RespEx: \[200\] {quantidade\_registros,quantidade\_paginas:n,observacoes:\[{codigo\_veiculo,data\_cadastro,hora\_cadastro,usuario\_cadastro,observacao}\]}

#### POST /listar-por-permissao/veiculo — Listar por permissao

Igual a POST /listar/veiculo, validando permissões de regional e cooperativa do usuário. Limite: 5000 por requisição. Params: mesmos de POST /listar/veiculo, exceto `codigo_situacao_associado` e `codigo_associado` (não documentados aqui) RespEx: \[200\] mesma estrutura de POST /listar/veiculo

#### GET /veiculo-ativo-inativo/listar — Quant. veiculo Ativo/Inativo

RespEx: {mensagem:"OK",veiculos\_ativos,veiculos\_inativos}

#### POST /veiculo/produto/remover — Remover produto

Remove uma lista de produtos do veículo. Produtos que o veículo não possui são ignorados. Params: `codigo_veiculo` (Number, req), `lista_codigo_produto` (Array, req) Resp: `mensagem`, `codigo_veiculo` ReqEx: {codigo\_veiculo:n,lista\_codigo\_produto:\[s\]} RespEx: \[200\] {mensagem:"OK",codigo\_veiculo:n}

#### GET /produto-adicional/remover/:codigo\_veiculo/:codigo\_produto\_adicional — Remover Prod. Adicional

Remove um produto adicional de um veículo Params: `codigo_veiculo` (String, req), `codigo_produto_adicional` (String, req) RespEx: \[207\] {mensagem,codigo\_produto\_adicional:n}

#### POST /vincular/implemento — Vincular implemento

Params: `codigo_veiculo` (Number, req), `codigo_implemento` (Number, req), `valor_fipe` (Number, opt), `porcentagem` (Number, opt), `somar_fipe` (String, opt; "Y"/"N": somar ao valor FIPE do veículo) ReqEx: {codigo\_veiculo,codigo\_implemento,valor\_fipe,somar\_fipe:"N",porcentagem} RespEx: \[200\] {mensagem:"OK",codigo\_veiculo:n,codigo\_implemento:n}

#### POST /veiculo/vincular/produto — Vincular produto

Vincula uma lista de produtos ao veículo Params: `codigo_veiculo` (Number, req), `lista_codigo_produto` (Array, req) ReqEx: {codigo\_veiculo,lista\_codigo\_produto:\[s\]} RespEx: \[200\] {mensagem:"OK",codigo\_veiculo:n}

#### POST /modelo/listar — Listar Modelos

Lista modelos cadastrados no SGA. Limite: 200 modelos por requisição. Params: `situacao` (String, req: "ativo", "inativo" ou "todos"), `quantidade_por_pagina` (Number, opt) \[QTD\_PAG\], `inicio_paginacao` (Number, opt) \[INICIO\_PAG\_OFFSET\] ReqEx: {situacao,inicio\_paginacao:n,quantidade\_por\_pagina:n} RespEx: \[200\] {codigo\_modelo,descricao\_modelo,codigo\_marca,descricao\_marca,codigo\_tipo\_veiculo,descricao\_tipo\_veiculo,situacao}

### Módulo: Vistoria

#### POST /cadastrar/vistoria — Cadastrar vistoria

Cadastra uma vistoria vinculada a um associado Params:

- REQ: `codigo_associado` (Number), `codigo_tipo_vistoria` (Number), `data_vistoria` (String, dd/mm/yyyy)  
- OPT: `codigo_vistoriador`, `codigo_veiculo`, `codigo_estado_pneu`, `valor_vistoria` (Number), `observacao`, `longitude`, `latitude` (String), `data_recebimento_vistoria` ReqEx: {codigo\_associado,codigo\_vistoriador,codigo\_veiculo,codigo\_tipo\_vistoria,codigo\_estado\_pneu,data\_vistoria:"dd/mm/yyyy",observacao,latitude,longitude,valor\_vistoria} RespEx: \[200\] {mensagem:"OK",codigo\_vistoria}

#### GET /listar/estado-pneu/:situacao — Listar estado pneu

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_estadopneu,descricao:"NOVO",situacao}\]

#### GET /listar/marca-pneu/:situacao — Listar marca pneu

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo,descricao,situacao}\]

#### GET /listar/medida-pneu/:situacao — Listar medida pneu

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo,descricao,situacao}\]

#### GET /listar/tipo-foto/:situacao — Listar tipo foto

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_tipofoto,descricao,situacao}\]

#### GET /listar/tipo-local/:situacao — Listar tipo local

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo,descricao,logradouro,numero,complemento,bairro,cidade,estado,cep,situacao}\]

#### GET /listar/tipo-vistoria/:situacao — Listar Tipo Vistoria

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_tipo\_vistoria,descricao}\]

#### POST /listar/vistoria — Listar vistoria

Params: `data_vistoria_inicial` (String, req), `data_vistoria_final` (String, req), `codigo_veiculo`, `codigo_associado`, `codigo_vistoriador` (Number, opt), `quantidade_por_pagina` \[QTD\_PAG\], `inicio_paginacao` \[INICIO\_PAG\_PAGINA\] RespEx: \[200\] {total,numero\_paginas,mostrando,pagina\_corrente,retorno:\[{codigo\_vistoria,codigo\_associado,codigo\_veiculo,codigo\_veiculo\_provisorio,codigo\_tipo\_vistoria,codigo\_tipo\_local,nome\_usuario,codigo\_imagem\_vistoria,codigo\_marca\_pneu,codigo\_medida\_pneu,codigo\_estado\_pneu,valor\_vistoria,latitude,longitude,observacao,data\_vistoria,data\_recebimento\_vistoria,codigo\_vistoriador,nome\_vistoriador,data\_ocorrencia,hora\_ocorrencia,item\_vistoria:\[{item,tipo\_avaria}\]}\]}

#### GET /listar/vistoriador/:situacao — Listar Vistoriador

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_vistoriador,nome,cpf,celular,email,situacao}\]

### Módulo: Voluntario

#### GET /buscar/voluntario/:cpdOuCodigo — Buscar

Busca voluntário pelo CPF ou código, respeitando as permissões de cooperativa do usuário. (Path na URL: `:cpdOuCodigo`; nome do param na doc: `cpfOuCodigo`) Params: `cpfOuCodigo` (String, req) RespEx: \[200\] {codigo\_voluntario,nome,cpf,telefone,celular,email,logradouro,numero,complemento,bairro,cidade,estado,data\_cadastro,situacao,formato\_pagamento,valor\_pagamento,formato\_pagamento\_residual,valor\_pagamento\_residual,cooperativas:\[{codigo\_cooperativa,nome\_cooperativa}\]}

#### POST /voluntario/cadastrar — Cadastrar

Cadastra um voluntário. ATENÇÃO: se o CPF já existir na base, o voluntário existente é ALTERADO com os dados enviados. Nesse caso as cooperativas NÃO são alteradas (usar /voluntario/cadastrar-cooperativa/ e /voluntario/excluir-cooperativa/). Params:

- REQ: `nome` (String), `cpf` (String)  
- OPT: `formato_pagamento` ("R" ou "%"), `valor_pagamento` (Number), `telefone`, `celular`, `telefone_comercial` (máscaras "(99) 99999-9999" ou "99999999999"), `cooperativas` (Array \[{codigo\_cooperativa}\]), `codigo_classificacao` (Number), `logradouro`, `numero` (Number), `complemento`, `bairro`, `cidade`, `estado`, `cep`, `email`, `obs`, `radio`, `radio_auxiliar`, `codigo_voluntario_vinculado` (voluntário de indicação) ReqEx: {codigo\_classificacao,nome,cpf,celular,telefone\_comercial,formato\_pagamento:"R",valor\_pagamento,logradouro,numero,complemento,bairro,cidade,estado,cep,email,obs,cooperativas:\[{codigo\_cooperativa}\]} RespEx: \[200\] {mensagem:"OK",codigo\_voluntario}

#### POST /voluntario/cadastrar-cooperativa/ — Vincular à cooperativa

Params: `codigo_voluntario` (Number, req), `array_cooperativas` (Array, req) \[{codigo\_cooperativa}\] RespEx: \[200\] {mensagem:"OK",codigo\_voluntario}

#### POST /voluntario/excluir-cooperativa/ — Remover de cooperativa

Params: `codigo_voluntario` (Number, req), `array_cooperativas` (Array, req) \[{codigo\_cooperativa}\] RespEx: \[200\] {mensagem:"OK",codigo\_voluntario}

#### POST /listar/alteracao-voluntario/ — Listar Alterações de Voluntários

Alterações de voluntários em intervalo de até 7 dias Params: `data_inicial` (req) \[DT\_INI\], `data_final` (req) \[DT\_FIM\], `ultima_alteracao` (String, "Y"/"N"), `campos` (Array, req) RespEx: \[200\] \[{codigo\_alteracao,codigo\_voluntario,nome\_voluntario,operacao,nome\_campo\_tabela,valor\_anterior,valor\_posterior,data\_alteracao,codigo\_usuario\_alteracao,nome\_usuario\_alteracao}\]

#### POST /listar/indicacao/ — Listar indicações

Lista indicações vinculadas a um voluntário, filtrável por data de inclusão Params: `codigo_voluntario` (Number, req), `data_indicacao_inicial` (opt), `data_indicacao_final` (opt; obrigatória se a inicial for enviada) RespEx: \[200\] {mensagem:"OK",codigo\_voluntario:n,indicacoes:\[{codigo\_indicacao,codigo\_veiculo\_indicador,codigo\_veiculo\_indicado}\]}

#### GET /listar/situacao-adesao-voluntario/:codigo\_voluntario — Listar situação adesão

Params: `codigo_voluntario` (String, req) RespEx: \[200\] {codigo\_voluntario,nome\_voluntario,cpf\_voluntario,quantidade\_adesoes,adesoes:\[{codigo\_veiculo,codigo\_situacao,descricao\_situacao\_veiculo,data\_adesao,codigo\_associado,cpf\_associado}\]}

#### GET /listar/voluntario/:situacao/:pagina — Listar

Voluntários vinculados a cooperativas nas quais o usuário tem permissão. Em `cooperativas`, cada item traz código e nome da cooperativa. Params: `pagina` (Number, opt; padrão 0; 5000 registros por página; começa em 0), `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_voluntario,nome,cpf,cep,codigo\_classificacao,telefone,celular,telefone\_comercial,email,logradouro,numero,complemento,bairro,cidade,estado,situacao,formato\_pagamento,valor\_pagamento,formato\_pagamento\_residual,valor\_pagamento\_residual,obs,cooperativas:\[{codigo\_cooperativa,nome\_cooperativa}\]}

#### GET /listar/classificacao-voluntario/:situacao — Listar Classificação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_classificacaovoluntario,descricao,situacao}\]

#### POST /listar/placas-por-voluntario/ — Listar placas

Lista placas vinculadas a um voluntário, filtrável por data e participação no fechamento Params:

- `codigo_voluntario` (Number, req)  
- `participa_fechamento` (String, req na doc): "Y" ou "N"; se omitido retorna ambos  
- `tipo_retorno` (String, req): "sintetico" (só a quantidade) ou "analitico" (lista por veículo)  
- `data_cadastro_inicial` / `data_cadastro_final` (opt; final obrigatória se inicial enviada)  
- `data_contrato_inicial` / `data_contrato_final` (opt; final obrigatória se inicial enviada) ReqEx: {codigo\_voluntario,data\_pesquisa\_inicial:"dd/mm/yyyy",data\_pesquisa\_final:"dd/mm/yyyy",participa\_fechamento:"Y",tipo\_retorno} (o exemplo usa `data_pesquisa_*`, divergente dos nomes documentados) RespEx sintético: \[200\] {mensagem:"OK",codigo\_voluntario:n,quantidade\_veiculos} RespEx analítico: \[200\] {codigo\_veiculo,placa,chassi,codigo\_situacao,descricao\_situacao,codigo\_associado,cpf\_associado}

### Módulo: MGF

(módulo financeiro/contas a pagar e receber)

#### POST /mgf-lancamento/alterar — Alterar Lançamento

Params:

- `codigo_lancamento` (Number, req)  
- `codigo_evento`, `codigo_associado`, `codigo_veiculo` (Number, opt): se o código do associado ou do veículo for enviado, `codigo_evento` é obrigatório  
- `codigo_fornecedor` (Number, opt; descrição da doc diz "sub-operação")  
- `numero_nota_fiscal` (String, opt), `controle_interno` (String, opt)  
- `alterar_parcelas` (Array, opt): itens {parcela (qual parcela), codigo\_situacao\_parcela, valor\_parcela ("99,99"), valor\_pagamento ("99,99"), data\_vencimento ("dd/mm/yyyy"), data\_pagamento ("dd/mm/yyyy"), codigo\_caixa\_local, codigo\_banco, juros, multa} RespEx: \[207\] {mensagem,codigo\_lancamento}

#### GET /mgf-conta-pagar/buscar/:codigo\_ou\_nota — Buscar Conta Pagar

Busca conta a pagar pelo número da nota ou código do lançamento Params: `codigo_ou_nota` (String, req) RespEx: \[200\] \[{codigo\_conta,numero\_nota\_fiscal,data\_nota\_fiscal,valor\_nota,codigo\_fornecedor,nome\_fornecedor,cpf\_fornecedor,codigo\_evento,codigo\_voluntario,codigo\_operacao,codigo\_suboperacao,data\_ocorrencia,hora\_ocorrencia,codigo\_regional,codigo\_cooperativa,codigo\_departamento,codigo\_veiculo,parcelas:\[{codigo\_parcela,data\_pagamento,data\_vencimento,codigo\_situacao\_parcela,situacao\_parcela:"PAGA",codigo\_forma\_pagamento,forma\_pagamento,descricao\_extrato,codigo\_banco,codigo\_caixa\_local,caixa\_local,numero\_documento,desconto,juros,multa}\]}\]

#### GET /mgf-conta-receber/buscar/:codigo\_ou\_nota — Buscar Conta Receber

Busca conta a receber pelo número da nota ou código do lançamento Params: `codigo_ou_nota` (String, req) RespEx: \[200\] mesma estrutura de "Buscar Conta Pagar", trocando fornecedor por cliente (`codigo_cliente`, `nome_cliente`, `cpf_cliente`)

#### POST /buscar/cliente/:CodigoOuCpf — Buscar Cliente

Busca um cliente cadastrado no SGA por CPF ou código. (Método POST com parâmetro no path, conforme a doc.) RespEx: {codigo,codigo\_externo,codigo\_situacao,codigo\_regional,codigo\_cooperativa,nome,cpf,logradouro,numero,complemento,bairro,cidade,estado,cep,telefone,telefone\_comercial,email,email\_auxiliar,receber\_sms:"N",receber\_email:"N",contato,observacao,data\_cadastro,hora\_cadastro}

#### GET /mgf-saldo-caixa/buscar/:codigo\_caixa — Buscar Saldo Caixa

Params: `codigo_caixa` (String, req) RespEx: \[200\] {mensagem:"OK",codigo\_caixa\_local,caixa\_local,saldo\_caixa,data\_referencia:"yyyy-mm-dd"}

#### GET /mgf-saldo-conta/buscar/:codigo\_conta — Buscar Saldo Conta

Params: `codigo_conta` (String, req) RespEx: \[200\] {mensagem:"OK",codigo\_conta,conta,saldo\_conta,data\_referencia:"yyyy-mm-dd"}

#### POST /mgf-lancamento/cadastrar — Cadastrar Lançamento

Params:

- REQ: `data_nota_fiscal` (dd/mm/yyyy), `valor_nota_fiscal` (Number), `codigo_operacao` (Number), `codigo_suboperacao` (Number), `parcelas` (Array)  
- OPT: `codigo_descricao`, `numero_nota_fiscal` (Number), `codigo_banco` e `codigo_caixa_local` (enviar UM dos dois), `codigo_evento`  
- `parcelas`: itens {codigo\_situacao\_parcela, valor\_parcela ("99,99"), data\_vencimento ("dd/mm/yyyy"), data\_pagamento ("dd/mm/yyyy"; enviar quando a parcela for cadastrada na situação PAGA)} RespEx: \[200\] {mensagem:"OK",codigo\_lancamento}

#### GET /mgf-lancamento/excluir/:codigo\_lancamento — Excluir Lançamento

Exclui um lançamento do MGF. (ATENÇÃO: operação destrutiva exposta como GET) Params: `codigo_lancamento` (Number, req) RespEx: \[207\] {mensagem,codigo\_lancamento}

#### GET /mgf-descricao/listar/:situacao — Listar Descrição

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_descricao,codigo\_suboperacao,descricao,situacao}\]

#### GET /mgf-suboperacao/listar/:situacao — Listar Sub-operação

Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_mgfsuboperacao,descricao,situacao}\]

#### POST /listar/cliente — Listar Cliente

Lista clientes cadastrados no SGA por situação. Params: `codigo_situacao` (String, req), `quantidade_por_pagina` (Number, opt) \[QTD\_PAG\], `inicio_paginacao` (Number, opt) \[INICIO\_PAG\_PAGINA\] RespEx: \[200\] {total,numero\_paginas,mostrando,pagina\_corrente,clientes:\[{codigo,codigo\_externo,codigo\_situacao,codigo\_regional,codigo\_cooperativa,nome,cpf,logradouro,numero,complemento,bairro,cidade,estado,cep,telefone,telefone\_comercial,email,email\_auxiliar,receber\_sms,receber\_email,contato,observacao,data\_cadastro,hora\_cadastro}\]}

#### GET /listar/conta/:situacao — Listar conta bancária

Contas bancárias conforme permissões do usuário. Params: `situacao` \[SITUACAO\] RespEx: \[200\] {codigo\_conta,codigo\_agencia,codigo\_banco,descricao\_banco,apelido,hinova\_bank:"SIM",situacao}

#### POST /mgf-lancamento/listar — Listar Lançamento

Lista lançamentos do MGF. Limite: 1000 registros por página. Params: `data_vencimento_inicial` (String, req, dd/mm/yyyy), `data_vencimento_final` (String, req, dd/mm/yyyy), `codigo_operacao` (Number, opt), `quantidade_por_pagina` (Number, opt) \[QTD\_PAG\], `inicio_paginacao` (Number, opt) \[INICIO\_PAG\_PAGINA\] RespEx: \[200\] {mensagem:"OK",retorno:\[{codigo\_lancamento,data\_cadastro,nota\_fiscal,valor\_base,quantidade\_parcela,data\_emissao\_nota\_fiscal,controle\_interno,codigo\_voluntario,codigo\_veiculo,codigo\_associado,codigo\_cooperativa,codigo\_departamento,codigo\_regional,codigo\_usuario\_funcionario,codigo\_terceiro,observacao,protocolo\_evento,parcelas:\[{suboperacao,descricao,operacao,situacao,cliente,fornecedor,agencia,dv\_agencia,conta,dv\_conta,codigo\_banco\_fornecedor,data\_vencimento,parcela,data\_pagamento,codigo\_banco,valor\_parcela,valor\_pago,multa,juros,desconto,codigo\_caixa\_local,documento,numero\_documento,numero\_documento\_pagamento,codigo\_contabil,historico\_contabil,centrocusto,codigo\_centrocusto,observacao,caixa}\]}\]}

#### GET /mgf-caixa/listar/:situacao — (sem título na doc)

Lista os caixas conforme a situação Params: `situacao` \[SITUACAO\] RespEx: \[200\] \[{codigo\_mgfcaixalocal,descricao,situacao}\]

#### GET /mgf-operacao/listar — Listar Operações MGF

RespEx: \[200\] \[{codigo\_operacao,descricao:"ENTRADA"}\]