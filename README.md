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
| Carro (carroceria e roda separadas) | `assets/carro.svg`, `assets/roda.svg` (posição das rodas: variáveis `--wheel-*` em `styles.css`) |
| Escudos | `assets/escudo.svg`, `assets/escudo-contorno.svg`, `assets/escudo-ativo.svg` |
| Ícones dos serviços | `assets/icons/*.svg` |

Placeholders aparecem entre `[colchetes]` ou com `0000`.

## Dependências

- GSAP 3.12.5 + ScrollTrigger (cdnjs, versão fixa)
- Google Fonts (Nunito)

Sem GSAP, com JavaScript desligado ou com `prefers-reduced-motion`, a seção do carro aparece estática, com a lista de benefícios visível.
