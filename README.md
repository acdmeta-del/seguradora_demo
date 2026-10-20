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
