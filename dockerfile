FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN apt-get update \
  && apt-get install -y curl gnupg ca-certificates \
  && curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/microsoft-prod.list \
  && apt-get update \
  && apt-get install -y azure-functions-core-tools-4 \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci
RUN npm run build

ENV FUNCTIONS_WORKER_RUNTIME=node
ENV AzureWebJobsScriptRoot=/app
ENV APP_ENV=production

EXPOSE 8080

CMD ["bash", "-lc", "func start --port ${PORT:-8080} --host 0.0.0.0"]