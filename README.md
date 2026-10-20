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
| Carro do topo (fundo transparente, virado para a esquerda) | `assets/carro.webp` e `assets/carro.png` (reserva). Posição final em `.hero__car` (`styles.css`); quanto aparece antes de rolar e a distância até estacionar em `initHeroCar` (`main.js`) |
| Escudos | `assets/escudo.svg` (marca d'água do banner), `assets/escudo-ativo.svg` (favicon) |
| Ícones dos serviços | `assets/icons/*.svg` |

Placeholders aparecem entre `[colchetes]` ou com `0000`.

## Dependências

- GSAP 3.12.5 + ScrollTrigger (cdnjs, versão fixa), com cópia local em `js/vendor/` caso o CDN não carregue
- Google Fonts (Nunito)

Sem JavaScript ou com `prefers-reduced-motion` (no Windows: "Efeitos de animação" desligado), o carro já aparece estacionado, sem movimento.
