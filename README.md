# Integra Proteção Veicular: site de demonstração

Site de uma página em HTML, CSS e JavaScript puros, sem build. Abra `index.html` no navegador ou rode um servidor simples:

```
python3 -m http.server 8080
```

Referência do projeto (identidade, tom de voz, scrollytelling): [`docs/referencias.md`](docs/referencias.md).

## Onde personalizar

| O quê | Arquivo |
|---|---|
| Textos, contatos, planos, depoimentos, FAQ, glossário, política de privacidade | `content/content.js` |
| Cores, fonte, raios, sombras e espaçamentos (tokens) | topo de `css/styles.css` |
| Fonte do Google Fonts | `<head>` do `index.html` e `--font-base` |
| Logo | `assets/logo.svg` |
| Carro do topo (fundo transparente, virado para a esquerda) | `assets/carro.webp` e `assets/carro.png` (reserva). Posição final em `.hero__car` (`styles.css`); duração e atraso da entrada em `CAR_INTRO` (`main.js`) |
| Marca d'água do banner | `assets/marca-dagua.webp` e `.png` (versão branca do selo `assets/selo-integra.png`); opacidade em `.hero__watermark` |
| Favicon | `assets/escudo-ativo.svg` |
| Ícones dos serviços | `assets/icons/*.svg` |

Placeholders aparecem entre `[colchetes]` ou com `0000`.

## Dependências

- GSAP 3.12.5 (cdnjs, versão fixa), com cópia local em `js/vendor/` caso o CDN não carregue
- Google Fonts (Nunito)

O carro entra pela direita assim que a página carrega, sempre, mesmo com as animações do sistema desligadas (decisão do projeto). Sem JavaScript, ele já aparece estacionado.

No desktop, o texto do topo acompanha a rolagem (sticky) até o fim do formulário ao lado; em telas com menos de 700 px de altura ele rola normalmente.

## Segurança do formulário de cotação

O formulário começa com os campos e o botão desabilitados no HTML. `initForm` só os
habilita depois de registrar o listener de `submit`, que chama `preventDefault()`
antes de ler os dados. Se JavaScript estiver desativado, `content.js`/`main.js` não
carregar ou a inicialização falhar antes desse ponto, o formulário continua
desabilitado e uma mensagem estática orienta o contato alternativo.

A CSP usa `form-action 'none'` como proteção adicional: nenhum formulário pode
enviar dados por navegação nativa, inclusive por `form.submit()`. O envio intencional
para o WhatsApp continua pelo JavaScript; `fetch` do boleto continua controlado por
`connect-src`. O fechamento da política de privacidade usa `method="dialog"` e não
faz uma requisição. Se um formulário com envio nativo for adicionado no futuro,
seu destino deve ser revisado antes de alterar essa política.

O aviso de indisponibilidade em `index.html` é estático para funcionar mesmo sem
`content.js`. Ao personalizar os contatos, atualize também esse aviso e `noscript`.

### Testes do navegador

O site continua sem build. Para rodar os testes de regressão (Node.js 18+):

```sh
npm ci
npx playwright install chromium
npm test
```

Os testes usam um servidor local e dados fictícios, sem acessar serviços externos.
Cobrem JavaScript desativado, scripts ausentes, falhas de inicialização e de submit,
envio nativo forçado, validação, máscara, clique/Enter, pop-up bloqueado e a
compatibilidade da CSP com o diálogo e com `fetch`.

## 2ª via de boleto (SGA Hinova)

> **Documentação da API:** [`docs/api/hinova-sga-api-v2.md`](docs/api/hinova-sga-api-v2.md). Toda alteração nas chamadas à Hinova deve seguir esse documento (regras para agentes em [`AGENTS.md`](AGENTS.md)).

O atalho "2ª via de boleto" abre um pop-up que pede o **CPF do titular** e, opcionalmente, a **placa**. O site **não mostra o boleto** nem nenhum dado do associado: um intermediário (pasta `server/`) consulta o SGA Hinova e envia a 2ª via para o **WhatsApp cadastrado** do associado.

- **CPF + placa**: envia o boleto em aberto mais antigo daquele veículo (a listagem usa `placa`).
- **Só CPF**: envia os boletos em aberto de todos os veículos do titular (a listagem usa `cpf_associado`), do vencimento mais antigo ao mais novo, até `HINOVA_MAX_BOLETOS_CPF` (padrão 4). No WhatsApp vai uma apresentação ("Encontramos N boletos em aberto") e, para cada boleto, o resumo com o veículo (modelo e **só o final da placa**, ex.: `placa final 3D63`) seguido do PIX sozinho. Boleto repetido (mesmo `nosso_numero`) conta uma vez.

```
Site (GitHub Pages) ──CPF (+placa)+token anti-robô──▶ Intermediário (VPS / Easypanel) ──▶ SGA Hinova
                                                            └──▶ Z-API (WhatsApp) ──▶ celular cadastrado
```

Enquanto `boleto.endpoint` estiver vazio em `content/content.js`, o pop-up funciona em **modo demonstração** (resposta simulada, sem consulta).

### Segurança

| Risco | Proteção |
|---|---|
| Chave da Hinova/WhatsApp exposta | Ficam só nas variáveis de ambiente do Easypanel. O site (público) nunca as recebe. |
| SQL injection | Validação por lista de permissão no servidor: placa (se informada) só `AAA9A99`/`AAA9999`, CPF só 11 dígitos com verificador válido. Qualquer outra coisa recebe 400 antes de chamar a Hinova. Os valores vão codificados, nunca como texto livre. A proteção final é o SGA usar consultas parametrizadas (responsabilidade da Hinova). |
| Robôs | Cloudflare Turnstile verificado no servidor + limite de 5 consultas/15 min por IP + teto global + no máximo 3 envios/dia por CPF. |
| Descobrir quem é associado | Resposta e tempo de resposta sempre iguais, existindo ou não. Só envia se o CPF for do titular (da placa, quando informada), só boletos desse CPF, e só para o número cadastrado. A página nunca mostra CPF, placa, telefone ou boleto. |
| Outros sites usando a API | CORS e conferência do `Origin`: só `ALLOWED_ORIGINS`. |
| Dados pessoais em logs | CPF, placa e telefone sempre mascarados. |

### Implantação do intermediário no Easypanel

1. **Novo App** a partir deste repositório GitHub. Build: `Dockerfile`, caminho `server/`.
2. **Environment**: copie as variáveis de `server/.env.example` e preencha (Hinova, Turnstile, Z-API). Comece com `MODO=homologacao` e seu número em `WHATSAPP_TESTE_PERMITIDOS`.
   - **Hinova** (documentação, seção 1): `HINOVA_TOKEN_SGA` é o token gerado no SGA em Área do cliente → APIs → Gerenciar APIs. Com `HINOVA_USUARIO` e `HINOVA_SENHA` (usuário ATIVO do SGA, de preferência só para a integração), o servidor autentica em `/usuario/autenticar` e usa o `token_usuario` devolvido, que não expira. Alternativa: `HINOVA_TOKEN_USUARIO` com um `token_usuario` já obtido. `HINOVA_TOKEN` continua aceito (legado). Em Gerenciar APIs, marque os endpoints usados: `usuario/autenticar`, `veiculo/buscar`, `listar/boleto-associado-veiculo` e `buscar/boleto`.
   - **Z-API** (`WHATSAPP_PROVIDER=zapi`): `ZAPI_INSTANCE` (ID da instância), `ZAPI_TOKEN` (token da instância) e `ZAPI_CLIENT_TOKEN` (token de segurança da conta, no menu Segurança do painel). Sem os três, o servidor não sobe em produção.
3. **Domains**: use o subdomínio gratuito `*.easypanel.host` (HTTPS automático) apontando para a porta `3000`.
4. **Teste a Hinova** no console do App: `npm run testar-hinova -- ABC1D23 52998224725` (placa + CPF) ou `npm run testar-hinova -- 52998224725` (só CPF, todos os veículos). Ele mostra os nomes dos campos das respostas (sem dados pessoais) para ajustar `HINOVA_PATH_*` e `HINOVA_CAMPO_*`, se preciso.
   **Teste a Z-API**: `npm run testar-whatsapp -- 11987654321` (use o seu número) envia uma mensagem de teste.
5. **Turnstile**: no painel da Cloudflare, crie um widget para `acdmeta-del.github.io`. A chave de **site** vai em `content/content.js` (`boleto.turnstileSiteKey`); a chave **secreta**, só no Easypanel (`TURNSTILE_SECRET`).
6. Cole a URL do App + `/api/boleto` em `boleto.endpoint` (`content/content.js`) e faça o commit.
7. Se a Hinova restringir por IP, peça a liberação do IP da VPS.
8. Depois de validar com seu número, mude para `MODO=producao`.

Testes do intermediário: `cd server && npm install && npm test`.
