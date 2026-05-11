FROM node:18-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

EXPOSE 3000
CMD ["npm", "run", "start"]
