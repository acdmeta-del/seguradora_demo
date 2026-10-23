/*
 * CONTEÚDO DO SITE (fonte única de textos).
 * PERSONALIZAR: troque aqui textos, contatos, planos e depoimentos.
 * Tudo entre [COLCHETES] ou com 0000 é placeholder da demonstração.
 * Linguagem: "proteção veicular" e "associado". Não usar termos de seguradora.
 */
window.SITE_CONTENT = {
  empresa: {
    nome: "Integra",
    assinatura: "Proteção veicular",
    razaoSocial: "[RAZÃO SOCIAL DA EMPRESA]",
    cnpj: "00.000.000/0000-00",
    endereco: "Rua [Exemplo], 000, [Bairro], [Cidade/UF], CEP 00000-000",
    horario: "Segunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.",
    avisoLegal: "[Aviso legal e registros aplicáveis ao modelo da empresa, a validar com o cliente.]"
  },

  // PERSONALIZAR: contatos. O link do WhatsApp usa ddi + os dígitos de "whatsapp".
  contatos: {
    whatsapp: "(00) 00000-0000",
    ddi: "55",
    sede: "(00) 00000-0000",
    suporte24h: "(00) 00000-0000",
    email: "contato@exemplo.com.br",
    mensagemPadrao: "Olá! Quero fazer uma cotação grátis da proteção veicular."
  },

  redes: [
    { nome: "Instagram", url: "#" },
    { nome: "Facebook", url: "#" },
    { nome: "YouTube", url: "#" }
  ],

  nav: [
    { rotulo: "Serviços", ancora: "#servicos" },
    { rotulo: "Como funciona", ancora: "#como-funciona" },
    { rotulo: "Planos", ancora: "#planos" },
    { rotulo: "Depoimentos", ancora: "#depoimentos" },
    { rotulo: "Dúvidas", ancora: "#duvidas" },
    { rotulo: "Contato", ancora: "#contato" }
  ],

  // Topo no estilo "banner + cartão sobreposto + painel verde"
  hero: {
    display: "Proteção veicular.",          // texto grande no banner
    selo: "Cotação totalmente grátis",
    titulo: "Não deixe seu carro desprotegido!",
    subtitulo: "Proteja seu carro com a gente e fique mais tranquilo. Guincho à disposição, pane elétrica, mecânica, colisão e muito mais, com suporte 24h. O valor é calculado de acordo com o veículo e o perfil.",
    linhaPrefixo: "Integra",               // linhas de planos: "Integra Básico", "Integra Completo"...
    linhaLink: "Saiba mais",
    dica: "Dica: fale com a gente pelo WhatsApp para pedir ajuda, tirar dúvidas e muito mais!",
    // acao: "#ancora", "tel:sede" / "tel:suporte24h" (usa contatos), "wa:mensagem" (abre o WhatsApp)
    //       ou "dialog:id" (abre o pop-up <dialog id="id"> do index.html)
    atalhos: [
      { icone: "cotacao", rotulo: "Cotação grátis", acao: "#cotacao" },
      { icone: "suporte-24h", rotulo: "Suporte 24h", acao: "tel:suporte24h" },
      { icone: "guincho", rotulo: "Acionar guincho", acao: "wa:Olá! Preciso acionar o guincho." },
      { icone: "boleto", rotulo: "2ª via de boleto", acao: "dialog:boleto" }
    ],
    formTitulo: "Faça sua cotação grátis em menos de um minuto.",
    formNota: "Você recebe o retorno pelo WhatsApp.",
    campos: {
      nome: "Seu nome",
      whatsapp: "Seu WhatsApp",
      veiculo: "Placa ou modelo do veículo"
    },
    botao: "Faça sua cotação grátis"
  },

  servicos: {
    titulo: "Serviços para você rodar tranquilo",
    subtitulo: "O que a proteção da Integra cobre no dia a dia. Coberturas exatas dependem do plano escolhido.",
    itens: [
      { icone: "guincho", titulo: "Guincho", texto: "Reboque do veículo até a oficina ou local combinado, conforme o plano." },
      { icone: "pane-eletrica", titulo: "Pane elétrica", texto: "Atendimento para bateria descarregada e falhas elétricas." },
      { icone: "pane-mecanica", titulo: "Pane mecânica", texto: "Socorro quando o carro para por problema mecânico." },
      { icone: "colisao", titulo: "Colisão", texto: "Apoio para reparar o veículo em caso de batida." },
      { icone: "suporte-24h", titulo: "Suporte 24h", texto: "Equipe disponível todos os dias, a qualquer hora." }
    ]
  },

  passos: {
    titulo: "Como funciona",
    itens: [
      { titulo: "Peça sua cotação", texto: "Preencha nome, WhatsApp e placa ou modelo. Leva menos de um minuto." },
      { titulo: "Receba a proposta", texto: "Nossa equipe calcula o valor de acordo com o veículo e o seu perfil." },
      { titulo: "Escolha o plano", texto: "Compare os benefícios e fique com o que faz sentido para você." },
      { titulo: "Rode protegido", texto: "Pronto, você é associado Integra, com suporte 24h." }
    ]
  },

  // Planos de exemplo. Sem preço, por decisão do projeto.
  planos: {
    titulo: "Planos para cada necessidade",
    subtitulo: "O valor de cada plano depende do veículo e do perfil. Peça sua cotação grátis.",
    nota: "Planos e benefícios ilustrativos para a demonstração.",
    botao: "Quero cotar este plano",
    itens: [
      {
        nome: "Básico",
        descricao: "O essencial para o dia a dia.",
        destaque: false,
        beneficios: ["Guincho [até 000 km]", "Pane elétrica", "Pane mecânica", "Suporte 24h"]
      },
      {
        nome: "Completo",
        descricao: "Mais tranquilidade para quem roda bastante.",
        destaque: true,
        selo: "Mais procurado",
        beneficios: ["Tudo do Básico", "Colisão", "Guincho [até 000 km]", "Chaveiro e troca de pneu"]
      },
      {
        nome: "Premium",
        descricao: "A proteção mais ampla da Integra.",
        destaque: false,
        beneficios: ["Tudo do Completo", "Guincho [ilimitado]", "Carro reserva [00 dias]", "Proteção para vidros"]
      }
    ]
  },

  depoimentos: {
    titulo: "Quem é associado conta",
    nota: "Depoimentos de exemplo, apenas para a demonstração.",
    // PERSONALIZAR: trocar "iniciais" por foto real (campo "foto") quando houver.
    itens: [
      { nome: "[Nome do associado]", iniciais: "A1", cidade: "[Cidade/UF]", texto: "O guincho chegou rápido e o atendimento pelo WhatsApp foi muito atencioso." },
      { nome: "[Nome da associada]", iniciais: "A2", cidade: "[Cidade/UF]", texto: "Fiz a cotação em poucos minutos e entendi tudo sem letra miúda." },
      { nome: "[Nome do associado]", iniciais: "A3", cidade: "[Cidade/UF]", texto: "Tive uma pane à noite e o suporte 24h resolveu. Recomendo." }
    ]
  },

  // FAQ genérico: validar as respostas com a empresa antes de publicar.
  faq: {
    titulo: "Perguntas frequentes",
    itens: [
      { p: "O que é proteção veicular?", r: "É um modelo em que os associados se unem para proteger seus veículos. Quando alguém precisa, a associação ajuda com assistência e reparos, conforme o plano." },
      { p: "Quanto custa?", r: "O valor depende do veículo e do perfil de quem dirige. Por isso a cotação é individual e totalmente grátis." },
      { p: "Como eu aciono o guincho?", r: "É só chamar o suporte 24h pelo WhatsApp ou telefone, informar onde você está e o que aconteceu." },
      { p: "Preciso fazer vistoria?", r: "Sim, normalmente o veículo passa por uma vistoria simples antes de começar a proteção. A equipe explica como fazer." },
      { p: "Posso cancelar quando quiser?", r: "[Resposta a confirmar com a empresa, conforme as regras da associação.]" }
    ]
  },

  glossario: {
    titulo: "Glossário em linguagem simples",
    itens: [
      { termo: "Associado", def: "Quem contrata a proteção e passa a fazer parte da associação." },
      { termo: "Cota de participação", def: "Parte do custo do reparo que fica por conta do associado, quando prevista no plano." },
      { termo: "Vistoria", def: "Verificação rápida do estado do veículo antes de iniciar a proteção." },
      { termo: "Assistência 24h", def: "Serviços como guincho, chaveiro e socorro mecânico, a qualquer hora." }
    ]
  },

  contato: {
    titulo: "Fale conosco agora mesmo!",
    subtitulo: "Tire dúvidas e peça sua cotação grátis pelo WhatsApp.",
    botao: "Chamar no WhatsApp"
  },

  // Pop-up "2ª via de boleto" (consulta ao SGA pelo intermediário em server/)
  boleto: {
    titulo: "2ª via de boleto",
    texto: "Informe a placa do veículo e o CPF do titular. Se os dados estiverem corretos, enviamos a 2ª via para o WhatsApp cadastrado.",
    campos: { placa: "Placa do veículo", cpf: "CPF do titular" },
    botao: "Enviar 2ª via",
    enviando: "Consultando...",
    aviso: "Usamos placa e CPF apenas para localizar seu boleto. Nada fica salvo neste site.",
    erros: {
      placa: "Informe uma placa válida (ex.: ABC1D23).",
      cpf: "Informe um CPF válido.",
      humano: "Confirme que você não é um robô e tente de novo.",
      limite: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
      geral: "Não foi possível consultar agora. Tente de novo ou fale com a gente pelo WhatsApp."
    },
    sucesso: "Pronto! Se os dados estiverem corretos e houver boleto em aberto, a 2ª via chega no WhatsApp cadastrado em instantes.",
    // PERSONALIZAR: URL do intermediário no Easypanel, ex.: "https://boleto-integra.xxxx.easypanel.host/api/boleto".
    // Vazio = modo demonstração (resposta simulada no navegador, sem consulta real).
    endpoint: "https://integra-demo.enwglb.easypanel.host/api/boleto",
    // PERSONALIZAR: chave de SITE do Cloudflare Turnstile (pública). A chave SECRETA vai só no servidor.
    // Para testes locais, "1x00000000000000000000AA" é a chave de teste da Cloudflare (sempre aprova).
    turnstileSiteKey: "0x4AAAAAAFhTd0XP4HxrEGCP"
  },

  privacidade: {
    titulo: "Política de privacidade",
    texto: [
      "[Texto da política de privacidade a ser fornecido pela empresa, em conformidade com a LGPD (Lei 13.709/2018).]",
      "Os dados do formulário de cotação (nome, WhatsApp e veículo) não são armazenados por este site. Eles são enviados apenas na mensagem que você mesmo envia pelo WhatsApp.",
      "Na 2ª via de boleto, placa e CPF são usados só para localizar o boleto no sistema da associação e enviá-lo ao WhatsApp cadastrado. A verificação anti-robô usa o Cloudflare Turnstile.",
      "Encarregado de dados: [nome], [e-mail do encarregado]."
    ]
  }
};
