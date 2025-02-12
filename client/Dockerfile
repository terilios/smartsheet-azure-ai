FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY client/index.html ./index.html
COPY client/src ./src
COPY client/.env* ./
COPY vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js theme.json ./
EXPOSE 5173
CMD ["npm", "run", "dev:client"]
