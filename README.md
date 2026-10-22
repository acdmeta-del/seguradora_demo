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

## 2ª via de boleto (SGA Hinova)

O atalho "2ª via de boleto" abre um pop-up que pede **placa** e **CPF do titular**. O site **não mostra o boleto**: um intermediário (pasta `server/`) consulta o SGA Hinova e envia a 2ª via para o **WhatsApp cadastrado** do associado.

```
Site (GitHub Pages) ──placa+CPF+token anti-robô──▶ Intermediário (VPS / Easypanel) ──▶ SGA Hinova
                                                            └──▶ Z-API (WhatsApp) ──▶ celular cadastrado
```

Enquanto `boleto.endpoint` estiver vazio em `content/content.js`, o pop-up funciona em **modo demonstração** (resposta simulada, sem consulta).

### Segurança

| Risco | Proteção |
|---|---|
| Chave da Hinova/WhatsApp exposta | Ficam só nas variáveis de ambiente do Easypanel. O site (público) nunca as recebe. |
| SQL injection | Validação por lista de permissão no servidor: placa só `AAA9A99`/`AAA9999`, CPF só 11 dígitos com verificador válido. Qualquer outra coisa recebe 400 antes de chamar a Hinova. Os valores vão codificados, nunca como texto livre. A proteção final é o SGA usar consultas parametrizadas (responsabilidade da Hinova). |
| Robôs | Cloudflare Turnstile verificado no servidor + limite de 5 consultas/15 min por IP + teto global + no máximo 3 envios/dia por CPF. |
| Descobrir quem é associado | Resposta e tempo de resposta sempre iguais, existindo ou não. Só envia se o CPF for do titular da placa, e só para o número cadastrado. |
| Outros sites usando a API | CORS e conferência do `Origin`: só `ALLOWED_ORIGINS`. |
| Dados pessoais em logs | CPF, placa e telefone sempre mascarados. |

### Implantação do intermediário no Easypanel

1. **Novo App** a partir deste repositório GitHub. Build: `Dockerfile`, caminho `server/`.
2. **Environment**: copie as variáveis de `server/.env.example` e preencha (Hinova, Turnstile, Z-API). Comece com `MODO=homologacao` e seu número em `WHATSAPP_TESTE_PERMITIDOS`.
   - **Hinova**: `HINOVA_TOKEN` é o token da associação, criado no SGA em Área do cliente → APIs → Gerenciar APIs (libere as rotas de veículo, associado e boleto). Com `HINOVA_AUTH=token` (padrão), só ele é usado, como no n8n. Usuário e senha só são necessários com `HINOVA_AUTH=usuario`.
   - **Z-API** (`WHATSAPP_PROVIDER=zapi`): `ZAPI_INSTANCE` (ID da instância), `ZAPI_TOKEN` (token da instância) e `ZAPI_CLIENT_TOKEN` (token de segurança da conta, no menu Segurança do painel). Sem os três, o servidor não sobe em produção.
3. **Domains**: use o subdomínio gratuito `*.easypanel.host` (HTTPS automático) apontando para a porta `3000`.
4. **Teste a Hinova** no console do App: `npm run testar-hinova -- ABC1D23 52998224725`. Ele mostra os nomes dos campos das respostas (sem dados pessoais) para ajustar `HINOVA_PATH_*` e `HINOVA_CAMPO_*`, se preciso.
   **Teste a Z-API**: `npm run testar-whatsapp -- 11987654321` (use o seu número) envia uma mensagem de teste.
5. **Turnstile**: no painel da Cloudflare, crie um widget para `acdmeta-del.github.io`. A chave de **site** vai em `content/content.js` (`boleto.turnstileSiteKey`); a chave **secreta**, só no Easypanel (`TURNSTILE_SECRET`).
6. Cole a URL do App + `/api/boleto` em `boleto.endpoint` (`content/content.js`) e faça o commit.
7. Se a Hinova restringir por IP, peça a liberação do IP da VPS.
8. Depois de validar com seu número, mude para `MODO=producao`.

Testes do intermediário: `cd server && npm install && npm test`.
