FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . ./
COPY .env.example ./
RUN mkdir -p data storage
ENV PORT=8787
EXPOSE 8787
# Alicia supplies .env at deploy time (mounted secret, never baked in).
CMD ["node", "index.js"]
