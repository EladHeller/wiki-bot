FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS playwright-browsers

FROM node:24

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    make \
    g++ \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libgbm1 \
    libnss3 \
    libnspr4 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    wget \
    xz-utils \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm run build && \
    cp ./package.json ./dist/package.json && \
    cp ./package-lock.json ./dist/package-lock.json && \
    cd ./dist && \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm --quiet ci --omit=dev --no-bin-links && \
    rm -rf ./package-lock.json ./scripts && \
    cd ..

RUN npm install aws-lambda-ric@4.0.2

COPY --from=playwright-browsers /ms-playwright /ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright


ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]

CMD ["dist/ironSwords/index.main"]
