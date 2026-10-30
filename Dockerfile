# Integra no Easypanel: site + página de vistoria + API da 2ª via, num app só.
# Easypanel: Build path "/" (raiz do repositório), Dockerfile "Dockerfile". Porta 3000.
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# API (dependências primeiro, para aproveitar o cache do build)
COPY server/package.json server/package-lock.json ./
# "npm ls" faz o build FALHAR se faltar dependência (o npm às vezes sai com sucesso mesmo com erro de rede)
RUN npm ci --omit=dev && npm ls --omit=dev --all > /dev/null && npm cache clean --force
COPY server/ ./

# Site: só as páginas e pastas públicas (lista igual à de server/lib/site.js)
COPY index.html vistoria-teste.html ./public/
COPY css ./public/css
COPY js ./public/js
COPY content ./public/content
COPY assets ./public/assets
ENV SITE_DIR=/app/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server.js"]
