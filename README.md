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
- Só na página de teste da vistoria: TensorFlow.js 4.22.0 e COCO-SSD 2.2.3, locais em `js/vendor/`, e o modelo em `assets/modelos/` (Apache 2.0)

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

## Vistoria: página de TESTE da captura (Fase 1, sem API)

`vistoria-teste.html` valida, só no navegador, a experiência de tirar as fotos da vistoria. Ela não aparece no menu (`noindex,nofollow`, acesso direto pela URL) e **não faz nenhuma chamada de rede com fotos ou dados**. Nada de Hinova, nada de `server/`, nada de Turnstile. As fotos ficam na memória e no IndexedDB do aparelho e **expiram sozinhas em 4 horas** (`armazenamento.expiraHoras`). "Limpar tudo" apaga na hora.

- **Endereço:** `https://acdmeta-del.github.io/seguradora_demo/vistoria-teste.html`. Para o modo desenvolvedor, acrescente `?dev=1`.
- **Celular:** abra o endereço acima. A câmera e a localização exigem HTTPS, que o GitHub Pages já fornece.
- **Computador:** `npx http-server -p 8080` (ou outro servidor estático) e `http://localhost:8080/vistoria-teste.html?dev=1`. `localhost` conta como endereço seguro. Por IP da rede (`http://192.168...`) a câmera **não** abre: use um túnel HTTPS ou o GitHub Pages.

**Tipos de veículo:** carro (11 ângulos) e moto (9: inclui número do motor), escolhidos na tela inicial. Cada tipo tem silhuetas, classes do detector e faixas de ângulo próprias (`tipos` em `js/vistoria-config.js`). A moto ainda não foi calibrada: o ângulo só avisa.

**Localização e horário obrigatórios:** sem uma posição do GPS com até 2 minutos (`geoIdadeMaxS`), o botão de foto fica desativado; com a permissão negada, a página explica como liberar no iPhone e no Android. Cada foto guarda latitude, longitude, precisão e a diferença entre o relógio do aparelho e a hora do GPS (relógio alterado aparece no relatório).

**Avarias (marcação manual):** depois do último ângulo (ou pela revisão), a pessoa declara que o veículo não tem avarias ou registra cada uma:
1. a foto em que ela aparece, com um toque no ponto exato (ou "não aparece nas fotos");
2. o tipo (risco, amassado, trinca ou quebrado, ferrugem, peça faltando, outro);
3. a região, com lista própria para carro e moto;
4. uma observação opcional;
5. uma foto de perto, na mesma câmera, com alvo no centro, validações de nitidez e luz, GPS obrigatório e carimbo.

O relatório traz a declaração e cada avaria (ponto em coordenadas de 0 a 1 da foto, sem a faixa do carimbo). O ZIP leva `avarias/NN-perto.jpg` e `avarias/NN-marcacao.jpg` (a foto de referência com o ponto circulado). Detecção automática de avarias fica para depois, plugada em `analisarFoto(imagem, slot)`.

**Carimbo:** a foto guardada ganha uma faixa embaixo com data e hora de Brasília (`DD-MM-AAAA HH:MM:SS`) e o logo da Integra em versão clara (`assets/logo-claro.svg`, **provisório** como o `assets/logo.svg`: trocar pelo oficial). A faixa fica abaixo da imagem, sem cobrir o veículo, e as medições usam a foto sem carimbo. A hora vem do relógio do aparelho: na Fase 2, conferir com a hora do servidor.

| Arquivo | Papel |
|---|---|
| `js/vistoria-config.js` | Ângulos (com `codigoTipoSgaPendente: null` para a Fase 2), limites, camadas ligáveis, faixas dos sliders |
| `js/vistoria-qualidade.js` | Funções puras: resolução, nitidez (variância do Laplaciano), exposição, contraluz, dHash, duplicada, lado repetido |
| `js/vistoria-posicao.js` | Nível do celular, detector COCO-SSD, enquadramento, estimativa de ângulo e o ponto de extensão `analisarFoto(imagem, slot)` |
| `js/vistoria.js` | Interface: câmera, fluxo, revisão, painel dev, relatório JSON/ZIP, IndexedDB com expiração |
| `js/vistoria-silhuetas.js` | Silhuetas em traço de cada ângulo: carro e moto, painel, chassi, motor, porta-malas |
| `js/vistoria-carimbo.js` | Carimbo do rodapé (data e hora de Brasília + logo) |
| `css/vistoria.css` | Visual mobile first: câmera em tela cheia com o disparador dentro da imagem (coluna à direita com a tela deitada), botões grandes, contraste para uso no sol |
| `js/vendor/tf-4.22.0.min.js`, `js/vendor/coco-ssd-2.2.3.min.js`, `assets/modelos/coco-ssd-lite/` | Detector **local** (~18 MB, baixado só no primeiro ângulo externo). Origem e SHA-256 no `LEIA-ME.md` do modelo |

**Camadas de validação** (todas ligáveis no painel dev; só as marcadas como "reprova" impedem avançar):

| Camada | Efeito | O que detecta bem | Limitações |
|---|---|---|---|
| Qualidade | reprova | foto tremida ou fora de foco, muito escura ou clara, reflexo forte, resolução baixa, celular em pé nos ângulos externos | a nitidez muda com o aparelho e a textura do carro (carro liso e limpo mede menos): calibre com os sliders |
| Contraluz | reprova | sol atrás do carro (centro bem mais escuro que as bordas) | carro escuro em fundo claro também cai aqui |
| Legibilidade (odômetro, chassi) | reprova | centro desfocado | não lê os números (o OCR fica para depois, ver abaixo) |
| Mesmo veículo | **só avisa** | carro de cor diferente (mesmo carro 0,71–0,99; cor diferente ≤ 0,6), moto x carro, foto a mais de 150 m das outras, mais de 45 min depois da primeira | **não pega dois veículos parecidos no mesmo lugar** (2º teste: duas motos diferentes passaram). A cor não serve para moto (desligada); a aparência muda mais com o ângulo do que com o modelo. Identidade de verdade só conferindo placa/chassi/motor com o cadastro (Fase 2) |
| Continuidade | **só avisa** | entre uma foto e a próxima, o detector olha o vídeo 2 vezes por segundo e segue o veículo: avisa se ele saiu da câmera por mais de 6 s ou se a câmera "pulou" de repente para outro ponto com outra aparência (outro veículo?). Um veículo em outro ponto precisa se firmar por 3 olhadas (veículos ao fundo não contam) e girar o celular recomeça a trilha. O tempo olhando o resultado de uma tentativa não conta | quem anda com o celular abaixado gera aviso à toa; dois veículos encostados permitem passar de um para o outro sem salto. Gasta um pouco mais de bateria |
| Duplicada (dHash) | **só avisa** | a mesma foto repetida | fundo igual com pouca diferença pode avisar à toa |
| Lado repetido (espelho) | **só avisa** | a mesma lateral ou diagonal tirada duas vezes (compara com o par espelhado, usando o recorte do veículo quando há caixa) | depende do fundo e da iluminação dos dois lados |
| Inclinação | reprova | celular torto ou apontado para o chão/céu | no iPhone exige tocar em "Ativar nível"; sem sensor, a camada fica sem opinião |
| Detecção (COCO-SSD) | reprova | sem carro, carro pequeno, cortado na borda, fora do centro | não serve para painel, chassi e porta-malas (só ângulos externos); 1 a 3 s por foto no celular |
| Ângulo (proporção da caixa) | reprova só com confiança **alta** | frente/traseira (até 1,42) x diagonal (1,42 a 1,85) x lateral (a partir de 2,1), faixas do 1º teste real (hatch) | **não** distingue frente de traseira nem esquerda de direita; sedã, picape e SUV podem cair em outras faixas: recalibrar com mais testes |

O modo `?dev=1` mostra as métricas medidas e os limites de cada foto e a caixa do veículo. Ele também libera sliders para ajustar os limites ao vivo (a revisão mostra se cada foto "aprovaria" com os novos valores), além de "Exportar configuração ajustada", "Enviar arquivo" e "Forçar aceitar". O relatório (JSON, ou ZIP com as miniaturas) traz, por foto, o status, os motivos, os avisos, as métricas, as tentativas e os tempos de captura e de análise. Traz também um resumo de quantas vezes cada camada reprovou ou avisou. Os itens do modo dev estão marcados no código com `FASE 2: REMOVER`.

**Limitações conhecidas:**
- **Câmera:** precisa de HTTPS ou localhost.
- **Resolução da foto:** no Safari, a foto sai do quadro do vídeo (até 1920×1080). No Chrome Android, `ImageCapture.takePhoto()` dá a resolução cheia.
- **iPhone:**
  - o sensor de inclinação só funciona depois do toque em "Ativar nível do celular";
  - o iOS pode recarregar a aba em segundo plano, e é para isso que existe o IndexedDB;
  - em aba anônima, o IndexedDB pode não existir: as fotos ficam só na memória.
- **Detector:** o primeiro carregamento baixa cerca de 18 MB.
- **CSP:** a página não libera `unsafe-eval`. O TF.js tenta WebAssembly num `try` e segue sem ele (o navegador registra uma recusa `wasm-eval`, esperada).

**Possibilidades futuras (não implementadas):**
- OCR local do odômetro, do chassi e da placa com Tesseract.js, só como conferência (a placa lida na frente e na traseira resolveria "dois veículos da mesma cor"). É pesado (cerca de 10 MB) e lê mal odômetro digital.
- Avarias automáticas: um modelo de visão treinado para avarias (riscos, amassados, vidro trincado, farol quebrado), plugado em `analisarFoto(imagem, slot)`, como sinal para o analista. As fotos de perto da marcação manual servem para testá-lo.

**Fase 2 (não feita):**
- cadastro do candidato e do veículo;
- upload temporário com prazo de expiração;
- `POST /veiculo/foto/cadastrar` (mapeando `codigoTipoSgaPendente` com `GET /listar/tipo-foto`);
- `POST /cadastrar/vistoria`;
- acompanhamento do status e conferência pelo colaborador no SGA;
- rotas no `server/` com Turnstile e rate limit;
- remoção dos itens `FASE 2: REMOVER`.

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
