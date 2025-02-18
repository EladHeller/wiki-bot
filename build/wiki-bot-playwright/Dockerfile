FROM node:22

RUN apt-get update && apt-get install -y --no-install-recommends \
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
    # (Optional) Some fonts for better rendering
    fonts-liberation \
    # Clean up
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

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers
RUN mkdir -p /ms-playwright-browsers
RUN npx playwright install chromium

# local testing like lambda with  curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \  
#  -H 'Content-Type: application/json' \
#  -d '{ "some": "eventData" }'
# ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/local/bin/aws-lambda-rie
# RUN chmod +x /usr/local/bin/aws-lambda-rie
# CMD ["/usr/local/bin/aws-lambda-rie", "node", "dist/ironSwords/index"]

CMD ["node", "dist/ironSwords/index"]
