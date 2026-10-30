/*
 * Vistoria (TESTE, Fase 1): configuração local dos ângulos, limites e camadas.
 * Nada aqui vem da API: a lista de tipos de foto do SGA (GET /listar/tipo-foto) só
 * entra na Fase 2, preenchendo codigoTipoSgaPendente de cada ângulo.
 * PERSONALIZAR: ângulos, instruções e limites iniciais. No ?dev=1, os limites podem
 * ser ajustados ao vivo e exportados em JSON para colar aqui.
 */
window.VISTORIA_CONFIG = {
  versao: 1,

  // Fotos e relatório ficam só neste aparelho (IndexedDB) e expiram sozinhos
  armazenamento: { banco: "vistoria-teste", expiraHoras: 4 },

  // Camadas de validação (ligáveis no painel dev)
  camadas: {
    qualidade: true,   // resolução, nitidez, exposição, orientação
    duplicada: true,   // hash perceptual entre fotos (só avisa)
    mesmoVeiculo: true, // cor, tipo, distância e tempo entre as fotos: outro veículo? (só avisa)
    continuidade: true, // acompanha o veículo pela câmera entre uma foto e outra (só avisa)
    espelho: true,     // laterais e diagonais: pega o mesmo lado fotografado duas vezes (só avisa)
    silhueta: true,    // guia visual sobre a câmera
    inclinacao: true,  // celular reto (DeviceOrientationEvent)
    deteccao: true,    // veículo detectado e bem enquadrado (COCO-SSD local)
    angulo: true       // estimativa de frente/traseira x lateral x diagonal (heurística)
  },

  // Câmera: ImageCapture.takePhoto() (resolução cheia) quando existir; senão, quadro do vídeo
  camera: { largura: 1920, altura: 1080, usarTakePhoto: true, qualidadeJpeg: 0.9 },

  // Tamanho da imagem usada nas medições (a nitidez depende dele: não mude sem recalibrar)
  analise: { ladoMaior: 640 },

  limites: {
    resolucaoMaior: 1280,    // px, lado maior
    resolucaoMenor: 720,     // px, lado menor
    nitidez: 60,             // variância do Laplaciano (imagem de 640 px; iPhone nítido: 2.000–8.000)
    nitidezCentro: 90,       // região central (odômetro, chassi)
    lumMin: 60,              // luminância média (0–255)
    lumMax: 200,
    estouradosMax: 0.08,     // fração de pixels > 245
    escurosMax: 0.25,        // fração de pixels < 15
    contraluzRazao: 0.6,     // centro / bordas abaixo disso = contraluz
    duplicadaDist: 6,        // dHash: distância até aqui = "parece a mesma foto" (aviso)
    parecidaDist: 10,        // até aqui = "muito parecida" (aviso)
    espelhoMargem: 4,        // lado repetido: direto melhor que espelhado por esta margem (aviso)
    rollMax: 8,              // graus: horizonte inclinado
    pitchMax: 35,            // graus: celular apontado para cima/baixo (carro: 6–13°; moto, mais baixa: 19–29°)
    deteccaoScore: 0.5,      // confiança mínima do detector
    larguraMin: 0.5,         // largura da caixa do veículo / largura do quadro (1º teste: 0,57–0,87)
    larguraMax: 0.9,
    centroMax: 0.15,         // distância do centro da caixa ao centro do quadro
    margemBorda: 0.02,       // caixa encostada na borda = veículo cortado
    // Localização e horário (obrigatórios): sem posição recente, a foto não é tirada
    geoIdadeMaxS: 120,       // posição do GPS com no máximo N segundos
    geoPrecisaoMaxM: 100,    // precisão pior que isso: só avisa
    // Mesmo veículo em todas as fotos (só avisam)
    corSemelhancaMin: 0.6,   // 1º teste: mesmo carro 0,71–0,99; cinza-escuro ~0,49; vermelho/azul ~0,28 (prata x branco não separa)
    distanciaMaxM: 150,      // foto longe das outras
    intervaloMaxMin: 45,     // foto muito depois da primeira
    // Continuidade entre as fotos (só avisa): o detector acompanha o veículo pelo vídeo
    continuidadeIntervaloMs: 500, // uma olhada a cada N ms
    continuidadeMinS: 2,          // trajeto mais curto que isso: sem opinião
    continuidadeLacunaMaxS: 6,    // veículo fora da câmera por mais que isso: aviso
    continuidadeIouMin: 0.05,     // sobreposição mínima entre olhadas seguidas
    continuidadeSaltoCentro: 0.4, // ...e o centro andou mais que isso (fração do quadro) = salto
    continuidadeSaltoJanelaS: 1.5, // só conta salto entre olhadas com até N s de diferença
    continuidadeConfirmar: 3,     // veículo em outro ponto precisa se firmar por N olhadas (ignora vultos ao fundo)
    continuidadeAparenciaMin: 20  // dHash do recorte: diferença acima disso = outra aparência (0–64)
  },

  // Sliders do painel dev: [chave, rótulo, mínimo, máximo, passo]
  ajustes: [
    ["resolucaoMaior", "Resolução: lado maior (px)", 640, 4000, 40],
    ["resolucaoMenor", "Resolução: lado menor (px)", 360, 3000, 20],
    ["nitidez", "Nitidez mínima", 5, 400, 5],
    ["nitidezCentro", "Nitidez do centro (odômetro/chassi)", 5, 600, 5],
    ["lumMin", "Luminância mínima", 0, 150, 1],
    ["lumMax", "Luminância máxima", 100, 255, 1],
    ["estouradosMax", "Pixels estourados (máx.)", 0, 0.5, 0.01],
    ["escurosMax", "Pixels escuros (máx.)", 0, 0.8, 0.01],
    ["contraluzRazao", "Contraluz: centro/bordas (mín.)", 0.2, 1, 0.05],
    ["duplicadaDist", "Duplicada: distância dHash", 0, 20, 1],
    ["parecidaDist", "Parecida: distância dHash", 0, 24, 1],
    ["espelhoMargem", "Lado repetido: margem", 0, 16, 1],
    ["rollMax", "Inclinação do horizonte (°)", 1, 30, 1],
    ["pitchMax", "Celular para cima/baixo (°)", 1, 45, 1],
    ["deteccaoScore", "Detector: confiança mínima", 0.1, 0.95, 0.05],
    ["larguraMin", "Veículo: largura mínima", 0.2, 0.9, 0.01],
    ["larguraMax", "Veículo: largura máxima", 0.5, 1, 0.01],
    ["centroMax", "Veículo: distância do centro", 0.02, 0.5, 0.01],
    ["margemBorda", "Veículo: margem da borda", 0, 0.1, 0.005],
    ["geoIdadeMaxS", "GPS: idade máxima da posição (s)", 10, 600, 10],
    ["geoPrecisaoMaxM", "GPS: precisão para aviso (m)", 10, 500, 10],
    ["corSemelhancaMin", "Mesmo veículo: semelhança de cor mínima", 0.2, 0.95, 0.05],
    ["distanciaMaxM", "Mesmo veículo: distância máxima (m)", 20, 2000, 10],
    ["intervaloMaxMin", "Mesmo veículo: intervalo máximo (min)", 5, 240, 5],
    ["continuidadeLacunaMaxS", "Continuidade: tempo máximo fora da câmera (s)", 1, 60, 1],
    ["continuidadeIouMin", "Continuidade: sobreposição mínima", 0, 0.5, 0.01],
    ["continuidadeSaltoCentro", "Continuidade: salto do centro", 0.1, 0.9, 0.05],
    ["continuidadeAparenciaMin", "Continuidade: diferença de aparência no salto", 0, 64, 1]
  ],

  // Carimbo no rodapé de cada foto. PERSONALIZAR: logo da Integra em versão clara (fundo transparente)
  carimbo: {
    logo: "assets/logo-claro.svg",
    fuso: "America/Sao_Paulo",       // horário de Brasília
    rotuloFuso: "Horário de Brasília",
    alturaRelativa: 0.045            // altura da faixa / lado maior da foto
  },

  // Detector local (js/vendor + assets/modelos): nenhuma imagem sai do aparelho
  deteccao: {
    // Todas as classes de veículo do COCO: cada tipo diz quais espera (o resto vira aviso)
    classes: ["car", "truck", "bus", "motorcycle"],
    base: "lite_mobilenet_v2",
    modelUrl: "assets/modelos/coco-ssd-lite/model.json"
  },

  /*
   * Tipos de veículo. Cada um tem a lista de ângulos, os pares espelhados, as classes do
   * detector que espera e as faixas da heurística de ângulo (proporção largura/altura da caixa).
   *   faixasAngulo: [{ ate, grupo, alta: [de, ate], media: [de, ate] }]. Fora de alta/media = baixa.
   *   Moto ainda NÃO calibrada (sem alta/media): o ângulo só avisa, nunca bloqueia.
   * Campos dos ângulos:
   *   silhueta: nome em js/vistoria-silhuetas.js · espelhar: inverte a silhueta (lado direito)
   *   externo: aplica detecção do veículo e enquadramento
   *   anguloEsperado: frente-traseira | lateral | diagonal (heurística da camada "angulo")
   *   largura: [mín, máx] do veículo no quadro (padrão: limites larguraMin/larguraMax)
   *   medida: "largura" (padrão) ou "maior" (maior lado da caixa: moto de frente/traseira)
   *   legibilidade: exige nitidez também no centro · opcional: pode ser pulado
   *   codigoTipoSgaPendente: código do tipo de foto no SGA (Fase 2)
   * OCR (possibilidade futura, não implementado): ler odômetro, chassi e placa no próprio
   * aparelho, só como conferência, nunca como critério de aprovação.
   */
  // Avarias (marcação manual): ponto numa foto + tipo + região + foto de perto
  avarias: {
    maximo: 20,
    tipos: ["Risco", "Amassado", "Trinca ou quebrado", "Ferrugem", "Peça faltando", "Outro"],
    // A foto de perto passa pelas mesmas validações de qualidade (nitidez no centro, luz, resolução),
    // pelo GPS obrigatório e pelo carimbo; não passa por detecção, ângulo nem continuidade
    close: { id: "avaria-close", nome: "Foto de perto da avaria", silhueta: "alvo", orientacao: "qualquer", externo: false, legibilidade: true,
      instrucao: "Aproxime a uns 30 cm e deixe a avaria no centro do círculo, nítida e com boa luz.", codigoTipoSgaPendente: null }
  },

  tipoPadrao: "carro",
  tipos: {
    carro: {
      nome: "Carro", artigo: "o carro",
      classes: ["car", "truck"], // picape e SUV às vezes saem como "truck"
      compararCor: true,         // cor da lataria entre as fotos (calibrado no 1º teste)
      regioesAvaria: [
        "Para-choque dianteiro", "Capô", "Grade e faróis", "Para-brisa", "Teto",
        "Para-lama dianteiro esquerdo", "Porta dianteira esquerda", "Porta traseira esquerda", "Lateral traseira esquerda", "Retrovisor esquerdo",
        "Para-lama dianteiro direito", "Porta dianteira direita", "Porta traseira direita", "Lateral traseira direita", "Retrovisor direito",
        "Tampa traseira ou porta-malas", "Vidro traseiro", "Lanternas", "Para-choque traseiro", "Rodas e pneus", "Vidros laterais", "Interior", "Outra"
      ],
      faixasAngulo: [
        { ate: 1.42, grupo: "frente-traseira", alta: [0, 1.3], media: [1.3, 1.39] },
        { ate: 1.85, grupo: "diagonal", media: [1.45, 1.75] },
        { ate: 2.1, grupo: "indefinido" },
        { ate: 99, grupo: "lateral", alta: [2.5, 99], media: [2.2, 2.5] }
      ],
      espelhos: [
        ["lateral-esquerda", "lateral-direita"],
        ["diagonal-frontal-esquerda", "diagonal-frontal-direita"],
        ["diagonal-traseira-esquerda", "diagonal-traseira-direita"]
      ],
      slots: [
    { id: "frente", nome: "Frente", silhueta: "frente", orientacao: "paisagem", externo: true, anguloEsperado: "frente-traseira",
      instrucao: "Fique de frente para o carro, a uns 3 passos. O carro inteiro e a placa devem caber no quadro.", codigoTipoSgaPendente: null },
    { id: "traseira", nome: "Traseira", silhueta: "traseira", orientacao: "paisagem", externo: true, anguloEsperado: "frente-traseira",
      instrucao: "Vá para trás do carro, a uns 3 passos. Pegue a traseira inteira e a placa.", codigoTipoSgaPendente: null },
    { id: "lateral-esquerda", nome: "Lateral esquerda", silhueta: "lateral", orientacao: "paisagem", externo: true, anguloEsperado: "lateral",
      instrucao: "Lado do motorista. Afaste-se até o carro caber inteiro, da frente à traseira.", codigoTipoSgaPendente: null },
    { id: "lateral-direita", nome: "Lateral direita", silhueta: "lateral", espelhar: true, orientacao: "paisagem", externo: true, anguloEsperado: "lateral",
      instrucao: "Lado do passageiro. Afaste-se até o carro caber inteiro, da frente à traseira.", codigoTipoSgaPendente: null },
    { id: "diagonal-frontal-esquerda", nome: "Diagonal frontal esquerda", silhueta: "diagonal-frontal", orientacao: "paisagem", externo: true, anguloEsperado: "diagonal",
      instrucao: "Fique na quina da frente, do lado do motorista. Pegue a frente e a lateral juntas.", codigoTipoSgaPendente: null },
    { id: "diagonal-frontal-direita", nome: "Diagonal frontal direita", silhueta: "diagonal-frontal", espelhar: true, orientacao: "paisagem", externo: true, anguloEsperado: "diagonal",
      instrucao: "Fique na quina da frente, do lado do passageiro. Pegue a frente e a lateral juntas.", codigoTipoSgaPendente: null },
    { id: "diagonal-traseira-esquerda", nome: "Diagonal traseira esquerda", silhueta: "diagonal-traseira", orientacao: "paisagem", externo: true, anguloEsperado: "diagonal",
      instrucao: "Fique na quina de trás, do lado do motorista. Pegue a traseira e a lateral juntas.", codigoTipoSgaPendente: null },
    { id: "diagonal-traseira-direita", nome: "Diagonal traseira direita", silhueta: "diagonal-traseira", espelhar: true, orientacao: "paisagem", externo: true, anguloEsperado: "diagonal",
      instrucao: "Fique na quina de trás, do lado do passageiro. Pegue a traseira e a lateral juntas.", codigoTipoSgaPendente: null },
    { id: "painel-odometro", nome: "Painel com odômetro", silhueta: "painel", orientacao: "qualquer", externo: false, legibilidade: true,
      instrucao: "Com o carro ligado, enquadre o painel. Os números do odômetro devem ficar no centro e legíveis.", codigoTipoSgaPendente: null },
    { id: "chassi", nome: "Chassi ou plaqueta", silhueta: "chassi", orientacao: "qualquer", externo: false, legibilidade: true, opcional: true,
      instrucao: "Se aplicável: aproxime da gravação do chassi ou da plaqueta. Os caracteres devem ficar no centro e nítidos.", codigoTipoSgaPendente: null },
    { id: "estepe-portamalas", nome: "Estepe e porta-malas", silhueta: "portamalas", orientacao: "qualquer", externo: false,
      instrucao: "Abra o porta-malas e mostre o estepe e o espaço interno.", codigoTipoSgaPendente: null }
      ]
    },

    moto: {
      nome: "Moto", artigo: "a moto",
      classes: ["motorcycle"],
      // Cor NÃO serve para moto: a caixa é quase toda fundo, pneus e peças pretas
      // (2º teste: duas motos diferentes ficaram 0,73–0,82 parecidas)
      compararCor: false,
      regioesAvaria: [
        "Farol e carenagem frontal", "Para-brisa ou bolha", "Para-lama dianteiro", "Guidão e manetes", "Retrovisores", "Painel",
        "Tanque", "Carenagem lateral esquerda", "Carenagem lateral direita", "Banco", "Escapamento", "Motor",
        "Roda e pneu dianteiro", "Roda e pneu traseiro", "Lanterna e para-lama traseiro", "Pedaleiras e descanso", "Outra"
      ],
      // Proporções medidas em 2 testes (3 motos): frente/traseira 0,41–0,53; diagonais 0,73 e 1,11;
      // laterais 1,24–1,59. Ainda poucas medidas: confiança sempre baixa (só avisa)
      faixasAngulo: [
        { ate: 0.62, grupo: "frente-traseira" },
        { ate: 1.18, grupo: "diagonal" },
        { ate: 1.22, grupo: "indefinido" },
        { ate: 99, grupo: "lateral" }
      ],
      espelhos: [["moto-lateral-esquerda", "moto-lateral-direita"]],
      slots: [
        { id: "moto-frente", nome: "Frente", silhueta: "moto-frente", orientacao: "qualquer", externo: true, anguloEsperado: "frente-traseira", medida: "maior", largura: [0.5, 0.95],
          instrucao: "Fique de frente para a moto, a uns 2 passos. Pegue do pneu ao retrovisor. Pode ser com o celular em pé.", codigoTipoSgaPendente: null },
        { id: "moto-traseira", nome: "Traseira", silhueta: "moto-traseira", orientacao: "qualquer", externo: true, anguloEsperado: "frente-traseira", medida: "maior", largura: [0.5, 0.95],
          instrucao: "Vá para trás da moto, a uns 2 passos. A placa e a lanterna devem aparecer.", codigoTipoSgaPendente: null },
        { id: "moto-lateral-esquerda", nome: "Lateral esquerda", silhueta: "moto-lateral", orientacao: "paisagem", externo: true, anguloEsperado: "lateral", medida: "maior", largura: [0.5, 0.95],
          instrucao: "Do lado esquerdo, afaste-se até a moto caber inteira, de uma roda à outra.", codigoTipoSgaPendente: null },
        { id: "moto-lateral-direita", nome: "Lateral direita", silhueta: "moto-lateral", espelhar: true, orientacao: "paisagem", externo: true, anguloEsperado: "lateral", medida: "maior", largura: [0.5, 0.95],
          instrucao: "Do lado direito (do escapamento, na maioria), afaste-se até a moto caber inteira.", codigoTipoSgaPendente: null },
        { id: "moto-diagonal-frontal-esquerda", nome: "Diagonal frontal esquerda", silhueta: "moto-diagonal-frontal", orientacao: "paisagem", externo: true, anguloEsperado: "diagonal", medida: "maior", largura: [0.5, 0.95],
          instrucao: "Na quina da frente, do lado esquerdo. Pegue a frente e a lateral juntas.", codigoTipoSgaPendente: null },
        { id: "moto-diagonal-traseira-direita", nome: "Diagonal traseira direita", silhueta: "moto-diagonal-traseira", espelhar: true, orientacao: "paisagem", externo: true, anguloEsperado: "diagonal", medida: "maior", largura: [0.5, 0.95],
          instrucao: "Na quina de trás, do lado direito. Pegue a traseira e a lateral juntas.", codigoTipoSgaPendente: null },
        { id: "moto-painel", nome: "Painel com odômetro", silhueta: "moto-painel", orientacao: "qualquer", externo: false, legibilidade: true,
          instrucao: "Com a moto ligada, enquadre o painel. A quilometragem deve ficar no centro e legível.", codigoTipoSgaPendente: null },
        { id: "moto-chassi", nome: "Chassi", silhueta: "chassi", orientacao: "qualquer", externo: false, legibilidade: true,
          instrucao: "Aproxime da gravação do chassi (no quadro, perto da coluna de direção). Os caracteres devem ficar nítidos.", codigoTipoSgaPendente: null },
        { id: "moto-motor", nome: "Número do motor", silhueta: "motor", orientacao: "qualquer", externo: false, legibilidade: true,
          instrucao: "Aproxime da gravação do número do motor, no bloco. Os caracteres devem ficar nítidos.", codigoTipoSgaPendente: null }
      ]
    }

  }
};
