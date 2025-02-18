FROM mcr.microsoft.com/playwright:v1.50.1-jammy

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/local/bin/aws-lambda-rie
RUN chmod +x /usr/local/bin/aws-lambda-rie

WORKDIR /app

COPY . .

RUN npm run build && \
    cp ./package.json ./dist/package.json && \
    cp ./package-lock.json ./dist/package-lock.json && \
    cd ./dist && \
    npm --quiet ci --omit=dev --no-bin-links && \
    rm -rf ./package-lock.json ./scripts && \
    cd ..

CMD ["/usr/local/bin/aws-lambda-rie", "node", "dist/ironSwords/index"]
