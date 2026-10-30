# SÓ A API (legado). Para site + vistoria + API num app só, use o Dockerfile da raiz (Build path "/").
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
# "npm ls" faz o build FALHAR se faltar dependência (o npm às vezes sai com sucesso mesmo com erro de rede)
RUN npm ci --omit=dev && npm ls --omit=dev --all > /dev/null && npm cache clean --force
COPY . .
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server.js"]
