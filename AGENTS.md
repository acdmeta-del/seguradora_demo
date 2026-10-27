# Instruções para agentes (Claude Code, Codex e outros)

## Integração com a API SGA Hinova

**Fonte de verdade:** [`docs/api/hinova-sga-api-v2.md`](docs/api/hinova-sga-api-v2.md).

Toda e qualquer alteração nas chamadas à API da Hinova (caminhos, métodos, parâmetros,
corpo, cabeçalhos, autenticação, formatos de data e valor, paginação, limites, tratamento
de erro) **deve seguir esse documento**. Leia a seção do endpoint e as seções 0, 3, 5 e 6
antes de mudar qualquer chamada em `server/lib/hinova.js` ou `server/lib/config.js`.

- Se o documento e a resposta real da API divergirem, **a API real vence** (o próprio
  documento diz isso). Nesse caso, registre a divergência no código com um comentário e,
  se for o caso, mantenha os dois formatos aceitos (ex.: `situacao_boleto` e
  `descricao_situacao_boleto`). Use `npm run testar-hinova` na VPS para conferir.
- Leia **campos pelo nome exato**. Não use busca por nomes parecidos no fluxo real.
- **Nunca** chame endpoints de escrita (POST de cadastro/alteração, DELETE) nem os GET que
  alteram dados (seção 5.1 do documento) sem confirmação explícita do usuário.
- Nova tentativa automática só em GET de leitura com erro de rede ou 5xx (seção 6).
  POST nunca é repetido automaticamente.
- Respeite os limites da seção 3 (ex.: `POST /listar/boleto-associado-veiculo`: até 90 dias).

## Segurança e LGPD

- Nenhum token, usuário, senha ou chave em código, commits ou logs. Tudo nas variáveis de
  ambiente do Easypanel (ver `server/.env.example`).
- Respostas da Hinova têm CPF, telefone, e-mail e endereço: não logue payloads, mascare
  CPF/telefone/placa (`server/lib/validar.js`) e não crie fixtures com dados reais.
- O site (GitHub Pages) nunca mostra dados do associado. A 2ª via vai só para o WhatsApp
  cadastrado na Hinova; a resposta da API do site é sempre genérica.
- Valide tudo antes de enviar ao usuário final (`server/lib/formatar.js`): nada entra na
  mensagem sem virar texto e passar pela validação do seu tipo.

## Projeto

- Site estático sem build: `index.html`, `css/`, `js/`, `content/content.js` (textos).
- Intermediário: `server/` (Node 20 + Express), implantado no Easypanel.
- Testes: `cd server && npm test` (intermediário) e `npm test` na raiz (site, Playwright).
- Commits direto na `main` (demo), com mensagens em português.
