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
    nitidez: 60,             // variância do Laplaciano (imagem de 640 px)
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
    pitchMax: 15,            // graus: celular apontado para cima/baixo
    deteccaoScore: 0.5,      // confiança mínima do detector
    larguraMin: 0.55,        // largura da caixa do veículo / largura do quadro
    larguraMax: 0.9,
    centroMax: 0.15,         // distância do centro da caixa ao centro do quadro
    margemBorda: 0.02        // caixa encostada na borda = veículo cortado
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
    ["margemBorda", "Veículo: margem da borda", 0, 0.1, 0.005]
  ],

  // Detector local (js/vendor + assets/modelos): nenhuma imagem sai do aparelho
  deteccao: {
    classes: ["car", "truck", "motorcycle"],
    base: "lite_mobilenet_v2",
    modelUrl: "assets/modelos/coco-ssd-lite/model.json"
  },

  // Pares que devem ser o espelho um do outro (lado esquerdo x direito)
  espelhos: [
    ["lateral-esquerda", "lateral-direita"],
    ["diagonal-frontal-esquerda", "diagonal-frontal-direita"],
    ["diagonal-traseira-esquerda", "diagonal-traseira-direita"]
  ],

  /*
   * Ângulos, na ordem da captura.
   *   silhueta: frente | traseira | lateral | diagonal-frontal | diagonal-traseira | painel | chassi | portamalas
   *   espelhar: inverte a silhueta (lado direito)
   *   externo: aplica detecção do veículo e enquadramento
   *   anguloEsperado: frente-traseira | lateral | diagonal (heurística da camada "angulo")
   *   legibilidade: exige nitidez também no centro da foto
   *   opcional: pode ser pulado ("se aplicável")
   *   codigoTipoSgaPendente: código do tipo de foto no SGA (Fase 2)
   * OCR (possibilidade futura, não implementado): ler odômetro e chassi no próprio
   * aparelho com Tesseract.js, só como conferência, nunca como critério de aprovação.
   */
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
};
