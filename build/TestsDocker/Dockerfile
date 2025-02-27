FROM public.ecr.aws/lambda/nodejs:22

# Copy function code
COPY . .

RUN npm ci && \
    npm run build && \
    cp ./package.json ./dist/package.json && \
    cp ./package-lock.json ./dist/package-lock.json && \
    cd ./dist && \
    npm --quiet ci --omit=dev --no-bin-links && \
    rm -rf ./package-lock.json ./scripts && \
    cd ..
  
CMD [ "dist/kineret/kineretBot.main" ]
