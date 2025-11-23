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
    npm --quiet ci --omit=dev --no-bin-links && \
    rm -rf ./package-lock.json ./scripts && \
    cd ..

RUN npm install aws-lambda-ric

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers
RUN mkdir -p /ms-playwright-browsers
RUN npx playwright install chromium


ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]

CMD ["dist/ironSwords/index.main"]
