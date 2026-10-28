# Modelo COCO-SSD (lite_mobilenet_v2)

Pesos do detector de objetos usado na página de teste da vistoria (`vistoria-teste.html`).
Ficam no próprio site para que nenhuma imagem nem pedido saia para outro servidor.

- Origem: `https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/` (o mesmo que o
  pacote `@tensorflow-models/coco-ssd@2.2.3` baixa por padrão).
- Licença: Apache 2.0 (TensorFlow Models / Google).
- Biblioteca: `js/vendor/tf-4.22.0.min.js` (`@tensorflow/tfjs@4.22.0`) e
  `js/vendor/coco-ssd-2.2.3.min.js` (`@tensorflow-models/coco-ssd@2.2.3`), ambas Apache 2.0.
- Tamanho: ~18 MB. É baixado uma vez, só quando um ângulo externo é aberto, e fica no cache do navegador.

SHA-256 dos arquivos copiados:

```
300dfae273d20b4046f46a06d735688f03675a807561e9bcb5f664eb2f3d2831 js/vendor/tf-4.22.0.min.js
8875b8c1bb57723990c9d6506226e0e51cd21b8b6943eb53201086096de52df5 js/vendor/coco-ssd-2.2.3.min.js
0e7af0f713e98521252321f7f84892c31cefccccec3ac64c84e5065b75ed5646 assets/modelos/coco-ssd-lite/group1-shard1of5
74cc6cfc2c4510c9cd81b8ad4cebf6f6a8f305119bb365ce0eb96276da38519a assets/modelos/coco-ssd-lite/group1-shard2of5
50383033f893eae136392a403e8f70ade5efd90867df5695c4ca5ac640e14f38 assets/modelos/coco-ssd-lite/group1-shard3of5
d856dc534c780068bbf6c666ce1516df2c8433d87578aa31fcdf197de7058cc2 assets/modelos/coco-ssd-lite/group1-shard4of5
3d356f1fb6dfca6af78c56db34d9326706d0196e303f9de6b04f236ca79ed309 assets/modelos/coco-ssd-lite/group1-shard5of5
3770b2528339b1e3340cb74360e1e40401816b009779aeb8d0cce3a4353ea3a9 assets/modelos/coco-ssd-lite/model.json
```
