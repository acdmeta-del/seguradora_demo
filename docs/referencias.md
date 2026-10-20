# Referências e identidade: site de demonstração (Integra Proteção Veicular)

> Documento de contexto para uso no Claude Code. Reúne (1) a identidade visual a ser seguida, extraída das artes do cliente, e (2) a análise de sites de referência do setor automotivo no Brasil.

## Modo demonstração (decisão do projeto)

Este site é uma **demo**, então tudo é feito de forma **genérica e fácil de personalizar depois**:

- **Marca, cores e fontes como variáveis** (CSS custom properties / tokens), para trocar em um só lugar.
- **Textos, telefones, e-mail, endereço, CNPJ, planos e depoimentos como placeholders** claramente identificáveis (ex.: `[WHATSAPP]`, `[EMPRESA]`).
- **Imagens de exemplo** (carro de perfil, escudo, guincho) isoladas em uma pasta `assets/`, fáceis de substituir.
- **Conteúdo em um arquivo único** (ex.: `content.json` ou objeto no topo do código), separado do layout.
- Os valores da identidade da Integra (seção 1) são usados como **padrão inicial**, não como dado final.

---

## Como este documento foi feito

- Sites de referência analisados pelo **texto** das páginas (20/10/2026). Não houve acesso visual a eles, então **cores, tipografia e estilo de imagem dos sites de referência são inferências**.
- A identidade do cliente (seção 1) vem de **5 artes enviadas pelo cliente** e foi lida visualmente. Os hexadecimais foram amostrados dos pixels das imagens e são aproximados.
- Sites de referência incluídos: Porto Seguro, Azul Seguros, Allianz e Zurich. Os demais não puderam ser lidos e foram removidos do documento.

---

## 1. Identidade visual a seguir: Integra Proteção Veicular

### Marca
- **Nome:** Integra, com assinatura **"Proteção veicular"**.
- **Logo:** wordmark em minúsculas arredondadas, com **"Inte" em cinza-escuro e "gra" em verde**. À esquerda, um símbolo de **linhas curvas em leque (cinza e verde)** que lembra movimento e proteção. A assinatura "Proteção veicular" fica logo abaixo, em cinza.
- Versão em círculo (avatar): logo sobre um disco branco com relevo suave, em fundo verde.

### Paleta

| Papel | Cor | Hex (aprox.) | Uso |
|---|---|---|---|
| **Fundo principal** | Branco | `#FFFFFF` | Background das páginas e seções, conforme orientação do cliente |
| Cor de marca | Verde-limão | `#98C61D` | CTAs, destaques, ícones, faixas de seção, selos |
| Texto e logo | Cinza-escuro | `#606060` | Títulos, texto corrido, parte "Inte" do logo |
| Apoio | Cinza-claro | `#E8E8E8` | Divisórias, cards, campos de formulário |
| Detalhe | Verde mais escuro | `#80C820` / `#78C018` | Estados de hover, variações de faixas |

**Regra de uso:** **branco domina** (fundo). O verde entra como cor de ação e destaque, não como fundo de página inteira (nas artes de redes sociais o fundo é verde, mas no site o cliente pediu branco). O cinza cuida de texto e hierarquia.

**Pontos de atenção de contraste (acessibilidade):**
- Texto branco sobre `#98C61D` tem contraste baixo. Em botões verdes, preferir **texto cinza-escuro/preto** ou escurecer o verde (por exemplo `#5E8A00`) para texto branco passar em AA.
- Texto verde sobre branco também é fraco para corpo de texto. Usar verde só em títulos grandes, ícones e elementos gráficos.

### Elementos gráficos recorrentes (das artes)
- **Escudo branco com contorno** sobre fundo verde, atrás do veículo: símbolo de proteção. Bom para ícone, marca d'água e selo.
- **Carro recortado, sem fundo**, em destaque, com leve sombra. Veículos populares e modernos: sedã preto, hatch prata, hatch azul.
- **Guincho ilustrado**, com mascote 3D simpático (motorista de desenho animado). Mostra serviço, não só produto.
- **Cartão branco arredondado** com logo e contatos, no rodapé das artes. Vale como componente de contato.
- **Faixas e blocos arredondados**, cantos suaves, sem ornamentos.
- Tipografia das artes: **sans-serif geométrica, arredondada, em negrito** nos títulos, com palavra-chave destacada (por exemplo "desprotegido!", "guincho"). Sugestão de fontes web próximas: *Nunito*, *Poppins* ou *Quicksand* (Google Fonts). A fonte exata do logo parece ser uma geométrica arredondada tipo *Raleway/Quicksand*. Confirmar com o cliente.

### Tom de voz e mensagens (das artes)
- Direto, próximo, no imperativo e com urgência leve: **"Não deixe seu carro desprotegido!"**, **"Proteja seu carro com a gente e fique mais tranquilo!"**.
- Benefícios concretos: **guincho à disposição**, cobertura para **pane elétrica, mecânica, colisão "e muito mais"**, **cotação totalmente grátis**, **suporte 24h**.
- Fechamento padrão: **"Fale conosco agora mesmo!"** com WhatsApp. O canal principal de conversão do cliente é o **WhatsApp**.
- Trata quem contrata como **"associado"**, não "segurado".

### Contatos (placeholders para a demo)
Usar valores fictícios genéricos e centralizar em um só lugar para trocar depois:
- WhatsApp principal: `(00) 00000-0000`
- Sede: `(00) 00000-0000`
- Suporte 24h: `(00) 00000-0000`
- E-mail: `contato@exemplo.com.br`
- (Os números e dados reais do cliente aparecem nas artes e entram na etapa de personalização.)

### Observação importante sobre linguagem e regulação
A Integra usa **"proteção veicular" e "associado"**, o que sugere associação/cooperativa de proteção mútua e **não seguradora**. Os sites de referência abaixo são de **seguradoras**, que têm regras próprias (registro SUSEP, "apólice", "segurado"). **Não copiar** esses termos nem selos para o site da Integra. Validar com o cliente (e, se necessário, com assessoria jurídica) quais termos, avisos e registros devem aparecer. Este documento não é parecer jurídico.

---

## 2. Sites de referência analisados

### 2.1 Porto Seguro
**URL:** https://www.portoseguro.com.br/

**Estrutura da home (ordem):** barra utilitária (blog, sinistro, "Encontre um Corretor") → cabeçalho com "Área do cliente" → faixa promocional → hero (seguro de vida) → carrossel de banners → abas por categoria (veículo, casa, finanças...) → grade de produtos → seção do app com QR code → serviços com preço → cartão → vídeo institucional → atalhos "Como podemos cuidar de você?" (sinistro, fatura, WhatsApp) → blog → rodapé com CNPJs, Procon e cookies.

**Identidade visual (inferida):** azul como cor de marca; fotos de pessoas em situações cotidianas e mockups de celular; tom lifestyle e humano.

**CTAs:** "Cote agora", "Contratar", "Simular agora", "Aviso de sinistro". Rótulos inconsistentes entre si.

**Fluxo de cotação:** entrada pela **placa do veículo**, direcionando para a loja online. Etapas seguintes não visíveis.

**Confiança:** CNPJs de cada empresa, Ouvidoria/Procon/canal de denúncia, prêmio de mercado citado, assistência 24h. Sem depoimentos ou notas de clientes.

**Tom de voz:** acolhedor, "você", coloquial, foco emocional em proteção e família, bastante promocional.

**Contato:** WhatsApp com mensagem pré-preenchida, chat, "Encontre um Corretor", Ouvidoria.

**Aproveitar:** cotação por placa; atalhos de pós-venda (sinistro, 2ª via); app como hub.
**Evitar:** excesso de banners e ofertas competindo; rótulos de CTA diferentes para a mesma ação; condições de desconto escondidas.

---

### 2.2 Azul Seguros
**URL:** https://www.azulseguros.com.br/

**Estrutura da home:** cabeçalho (Produtos, Cotação, Busca, Área restrita) → painel de acesso por perfil (Corretor, Cliente, Terceiro, Prestador) → **grade de atalhos de serviço** (Pague fácil, 2ª via, SOS, Sinistro, Encontre seu corretor, Carro extra) → 3 blocos de vantagens → blog → **FAQ** → rodapé.

**Identidade visual (inferida):** cor-tema `#012d5a` (azul-marinho). Miniaturas do blog vazias, estilo fotográfico não avaliável.

**CTAs:** "Cotação", "Encontre seu corretor", Chat, WhatsApp, "Pague fácil".

**Fluxo de cotação:** o botão leva a **domínio externo** (loja da Porto Seguro). Sem simulador na home.

**Confiança:** vínculo com a Porto Seguro, Ouvidoria, consumidor.gov.br, canal de denúncias.

**Tom de voz:** informal e próximo, apelo de preço ("cabe no bolso").

**Contato:** WhatsApp, três telefones diferentes (4004, 0300, 0800), chat.

**Diferenciais:** produtos segmentados (Auto, Auto Leve, Roubo, Táxi, assinatura); Reparo rápido, Martelinho de Ouro, Carro extra; acompanhamento de sinistro online.

**Aproveitar:** grade de atalhos de serviço; FAQ curto; segmentação de produtos por perfil de motorista.
**Evitar:** mandar o usuário cotar em outro domínio; painel de "Área restrita" em destaque para visitante comum; "preço acessível" sem nenhum valor de referência; vários telefones sem orientação de qual usar.

---

### 2.3 Allianz (página Seguro Auto)
**URL:** https://www.allianz.com.br/seguros/seu-patrimonio/carro.html

**Estrutura:** cabeçalho (Portal do Corretor/Cliente, WhatsApp) → hero com foto de motorista sorrindo e CTA "Quero uma cotação" → como funciona → atalhos para clientes (assistência 24h, vidros, sinistro, app, oficina) → **avaliações (eKomi)** → **cards de coberturas com ilustrações** → assistências → bloco para elétricos/híbridos → app (notas das lojas) → documentos → blog → **FAQ** → ajuda → rodapé.

**Identidade visual (inferida):** fotos de pessoas em cenas reais + ilustrações simples por cobertura (carro batido, alagamento, pneu); cards bem separados, títulos fortes.

**CTAs:** "Quero uma cotação", "Peça pelo WhatsApp", "Baixar o App", "Encontrar oficina".

**Fluxo de cotação:** formulário **na própria página** (âncora); depois **corretor parceiro retorna em até 1 dia útil**.

**Coberturas apresentadas:** roubo/furto, colisão, alagamentos, terceiros, vidros, pequenos reparos, Carta Verde, carro reserva (7/15/30/45 dias), opções de franquia, guincho (200 km, 500 km, ilimitado), elétricos/híbridos. **Sem preço.**

**Confiança:** avaliações eKomi, CSAT (com ressalva de pesquisa interna), nota 4,8 nas lojas de app, ouvidoria, alertas de fraude.

**Tom de voz:** acolhedor, "você", frases curtas ("Você não precisa ligar!").

**Aproveitar:** cards de cobertura com ilustração; prova social com nota e fonte; formulário na própria página; promessa de retorno com prazo.
**Evitar:** jargão sem glossário (franquia, RCF-V, Carta Verde); repetir o mesmo CTA várias vezes; FAQ com texto denso; dois WhatsApps diferentes.

---

### 2.4 Zurich (Seguro de Carro)
**URL:** https://www.zurich.com.br/seguros-para-voce/seguros-para-veiculos/automovel

**Estrutura:** menu global → hero "Seguro de Carro" → **painel "Encontre o que você precisa"** (corretor, WhatsApp, chat, acionar assistência, 2ª via) → introdução → CTAs → benefícios → destaque Pequenos Reparos Premium → diferenciais (Carta Verde, elétricos) → **coberturas e tabelas de assistência/vidros em 3 níveis** → integração com seguro de vida → FAQ → produtos relacionados → rodapé com SUSEP.

**Identidade visual (inferida):** logo em versão azul; fotos de carros (inclusive elétricos), ilustrações vetoriais, banners largos, blocos com ícones.

**CTAs:** "Peça uma cotação", "Encontre um Corretor", WhatsApp com assistente virtual, "Acionar assistência 24h".

**Fluxo de cotação:** link para página externa. Sem formulário na página.

**Coberturas:** casco em combinações, RCF, APP, assistência **Básica/Completa/VIP**, vidros **Básico/Completo/VIP**, carro reserva, 0 km, pequenos reparos.

**Confiança:** SUSEP, oficinas com garantia de 1 ano, parcelamento sem juros. Afirma "a mais completa do mercado" sem prova. Sem depoimentos.

**Tom de voz:** consultivo, emocional (tranquilidade, proteção), promocional e repetitivo.

**Aproveitar:** **planos em três níveis (Básico/Completo/VIP)**, bom para comparar visualmente; painel de atalhos; cartão de contatos para baixar.
**Evitar:** tabelas densas no celular; afirmação sem evidência; repetição de blocos; sem preço de referência.

---

## 3. Síntese: padrões do setor (4 sites lidos)

| Padrão | Porto | Azul | Allianz | Zurich |
|---|---|---|---|---|
| Azul como cor de marca (inferido) | Sim | Sim | n/d | Sim |
| Cotação em destaque no topo | Parcial | Sim | Sim | Sim |
| Cotação na própria página | Não | Não | **Sim** | Não |
| Atalhos de pós-venda (sinistro, 2ª via, SOS) | Sim | Sim | Sim | Sim |
| WhatsApp / chat | Sim | Sim | Sim | Sim |
| FAQ | Não | Sim | Sim | Sim |
| Prova social concreta (notas, avaliações) | Não | Não | **Sim** | Não |
| Preço ou faixa de referência | Não | Não | Não | Não |

**Padrões comuns:** paleta azul; tom acolhedor em segunda pessoa; atalhos de serviço logo no topo; assistência 24h como argumento central.

**Falhas comuns (oportunidade de diferenciação):**
1. Ninguém mostra **preço ou faixa de referência** (na demo da Integra, **valores não serão exibidos por ora**: a lacuna é do setor, mas a decisão do projeto é seguir sem preços).
2. Pouca **prova social real** (só a Allianz traz avaliações).
3. **Jargão sem explicação** (franquia, RCF, Carta Verde, classe de bônus).
4. CTAs concorrendo entre si e **muitos números de contato**.
5. Cotação que **leva o usuário para outro domínio**.

**Diferenciação visual:** o setor é quase todo **azul**. O **verde-limão sobre fundo branco** da Integra é um diferencial de marca e transmite leveza, proximidade e "tudo certo" (cor de aprovação).

---

## 4. Scrollytelling: carro que entra na página com a rolagem

### Conceito
Um **carro percorre a tela da direita para a esquerda conforme o usuário rola para baixo**, e **volta da esquerda para a direita ao rolar para cima**. O movimento é **ligado à rolagem** ("scrub"): a posição do carro depende de quanto a página foi rolada, não de um tempo fixo. Parar de rolar para o carro. Isso cria a sensação de "dirigir pela página" e conecta com o guincho, o escudo de proteção e a ideia de movimento do logo.

### Comportamento esperado
| Ação do usuário | Resultado |
|---|---|
| Rola para baixo | Carro entra pela **direita** e anda para a **esquerda** |
| Rola para cima | Carro faz o caminho **inverso** (esquerda → direita) |
| Para de rolar | Carro para na posição atual |
| Rolagem rápida | Carro acompanha sem atraso perceptível (suavização leve) |

- O carro deve estar **virado para a esquerda** (sentido do movimento). As artes do cliente já usam carros de perfil olhando para a esquerda.
- **Onde usar:** de preferência em **uma seção de destaque** (por exemplo, logo abaixo do hero ou no bloco "Proteção do começo ao fim"), e não na página inteira, para não cansar nem pesar.
- **Sincronia com o conteúdo:** à medida que o carro cruza a tela, **textos e ícones de benefícios aparecem em sequência** (por exemplo: *Guincho → Pane elétrica → Pane mecânica → Colisão → Suporte 24h → Cotação grátis*). O escudo verde pode **fechar/acender ao final** do trajeto.
- **Fundo:** branco (regra da marca). Uma **linha de estrada em cinza-claro `#E8E8E8`** ou faixa verde `#98C61D` fina pode servir de "chão" para o carro.

### Estrutura sugerida da seção
1. Container alto (por exemplo, 250 a 400vh) que "segura" a rolagem.
2. Dentro, um **palco fixo (sticky)** de 100vh que fica preso na tela enquanto o container rola.
3. No palco: o carro (posicionado por `transform: translateX()`), a linha da estrada e os blocos de benefícios que aparecem conforme o progresso.
4. Progresso de rolagem (0 a 1) mapeado para a posição do carro (de `+100vw` a `-100% da largura do carro`).

### Implementação (para o Claude Code)
**Opção A, recomendada para este caso: GSAP + ScrollTrigger**
- Mais controle, compatível com todos os navegadores, bom para sincronizar texto e carro.
- `ScrollTrigger` com `pin: true`, `scrub: 0.5` (suavização) e `start: "top top"`, `end: "+=300%"`.
- Animação do carro: `x` de `100vw` para `-carWidth`, com `ease: "none"` (linear com a rolagem).
- Biblioteca via CDN ou instalação por npm (usar versão fixa).

**Opção B: CSS Scroll-driven Animations**
- `animation-timeline: view()` ou `scroll()` e `@keyframes` com `translateX`.
- Sem JavaScript, muito leve, mas **suporte ainda irregular** em alguns navegadores (Safari e Firefox em versões antigas). Usar apenas com **fallback**.

**Requisitos de qualidade (valem para qualquer opção):**
- Animar **somente `transform` e `opacity`** (rápido e sem reflow). Usar `will-change: transform` no carro.
- **`prefers-reduced-motion: reduce`:** desligar o movimento e mostrar o carro **parado, centralizado**, com os benefícios visíveis em lista.
- **Mobile:** testar rolagem por toque; palco com altura `100svh` (evita salto da barra do navegador); reduzir a distância de rolagem (por exemplo, 200vh) e o tamanho do carro.
- **Desempenho:** imagem do carro em **WebP/PNG com fundo transparente**, tamanho adequado (por exemplo, 1200 px de largura, menos de 150 KB), `loading="eager"` só se estiver na primeira dobra, com `width` e `height` definidos para **evitar mudança de layout (CLS)**.
- **Acessibilidade:** carro é decorativo (`alt=""`, `aria-hidden="true"`). O conteúdo dos benefícios deve existir **como texto real** e legível mesmo sem animação.
- **Sem sequestro de rolagem:** não bloquear nem alterar a velocidade da rolagem do usuário. O pin deve ser curto e previsível.
- **Fallback sem JavaScript:** mostrar o carro estático e a lista de benefícios.

### Ativos necessários
- **Carro recortado, de perfil, virado para a esquerda**, sem fundo. Pode ser mais de um modelo (sedã, hatch) para variar entre seções. **Usar imagens licenciadas ou fotos do próprio cliente.** Evitar reaproveitar imagens de marcas/modelos de terceiros sem licença.
- Opcional: **sombra** separada sob o carro e **rodas animadas** (rotação proporcional ao deslocamento) para reforçar o movimento. Isso exige as rodas como camadas separadas ou um SVG.
- Ícones dos benefícios (SVG) em cinza `#606060` com detalhe verde.

### Critérios de aceite
- Rolar para baixo move o carro da direita para a esquerda, e rolar para cima inverte, sem saltos.
- Funciona em celular e desktop, com 60 fps em aparelhos intermediários.
- Com `prefers-reduced-motion`, não há movimento e o conteúdo continua claro.
- Pontuação de desempenho e acessibilidade (Lighthouse) não cai de forma relevante por causa da seção.

---

## 5. Recomendações para o site de demonstração

0. **Incluir a seção de scrollytelling do carro** (seção 4), no ponto de maior destaque após o hero.
1. **Fundo branco, verde `#98C61D` nos CTAs e destaques, cinza `#606060` no texto**, com atenção ao contraste (ver seção 1).
2. **Hero com cotação rápida** (nome, WhatsApp, placa ou modelo) e **um único CTA principal** "Faça sua cotação grátis". Botão flutuante de WhatsApp sempre visível, já que é o canal principal.
3. **Escudo + carro recortado** como elemento visual do hero, replicando as artes do cliente.
4. **Bloco de serviços** com ícones: guincho, pane elétrica, pane mecânica, colisão, suporte 24h (a Integra já comunica isso nas artes). Usar o mascote do guincho como ilustração de apoio.
5. **Planos em níveis** (ideia da Zurich), caso a Integra tenha planos, com cards empilhados no celular em vez de tabela larga.
6. **Glossário em linguagem simples** (ideia da Allianz, corrigindo o jargão), adaptado ao vocabulário de proteção veicular (associado, participação, cota).
7. **Prova social visível**: depoimentos de associados com nome e foto, nota média, nº de associados, avaliações do Google.
8. **Sem valores na página, por ora (decisão do projeto).** Em vez de preço, usar o CTA **"Faça sua cotação grátis"** e a mensagem de que o valor é calculado **de acordo com o veículo e o perfil**. A estrutura (campo ou bloco) pode ser deixada pronta e oculta para ativar depois.
9. **Atalhos de pós-venda**: acionar guincho, suporte 24h, falar com a sede, 2ª via de boleto.
10. **Contato claro**: um número principal de WhatsApp em destaque; os demais (sede, suporte 24h) no rodapé e na página de contato.
11. **Rodapé** com CNPJ, endereço, redes sociais, política de privacidade (LGPD). Registros e avisos regulatórios apropriados ao modelo da Integra, a validar com o cliente.
12. **Mobile first**; formulário curto em etapas.

## 6. Defaults da demo e personalização posterior

### Decisões padrão para a demo
- **Seção do carro (scrollytelling):** logo abaixo do hero.
- **Benefícios em sequência:** Guincho → Pane elétrica → Pane mecânica → Colisão → Suporte 24h → Cotação grátis.
- **Tecnologia do scrollytelling:** GSAP ScrollTrigger, com fallback para `prefers-reduced-motion`.
- **Carro:** imagem de perfil, fundo transparente, virado para a esquerda, em `assets/` (usar um recorte genérico/licenciado ou ilustração; sem marca identificável).
- **Cores e fonte:** tokens com os valores da seção 1 (verde `#98C61D`, cinza `#606060`, branco de fundo) e fonte Nunito ou Poppins.
- **Planos:** três níveis genéricos (Básico, Completo, Premium) com benefícios fictícios.
- **Valores:** **nenhum preço ou mensalidade é exibido** na demo. Planos mostram só benefícios. Depoimentos e números ficam claramente marcados como exemplo.
- **Linguagem:** neutra de "proteção veicular" e "associado", sem termos exclusivos de seguradora (apólice, SUSEP).

### Para personalizar depois
- [ ] Hexadecimais e fonte oficiais, logo em SVG.
- [ ] Telefones, e-mail, domínio, endereço e CNPJ reais.
- [ ] Planos, coberturas e termos reais, e enquadramento regulatório. **Decidir se e como exibir valores** (ex.: "a partir de") numa fase futura.
- [ ] Depoimentos, fotos reais da equipe e dos associados.
- [ ] Imagens licenciadas ou do cliente para o carro do scrollytelling.
- [ ] Screenshots dos sites de referência, se for fixar decisões visuais com base neles.
