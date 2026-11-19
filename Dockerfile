# ---------- EstuLanches: Imagem da Aplicação em Node.js ----------
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=8000

WORKDIR /srv/app

# Camada de dependências separada (otimização de cache do build)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copia código-fonte, interface web e testes
COPY index.html ./index.html
COPY src ./src
COPY tests ./tests

# Segurança de produção: utilizar usuário não-root nativo da imagem node
USER node

EXPOSE 8000

# Verificação de integridade nativa do container
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/health').then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/app.js"]
