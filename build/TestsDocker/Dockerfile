FROM public.ecr.aws/lambda/nodejs:22

# Copy function code
COPY ./package.json ./package-lock.json ./tsconfig.json ./tsconfig.build.json ./
COPY ./bot ./bot

RUN npm ci && \
    npm run build && \
    cp ./package.json ./dist/package.json && \
    cp ./package-lock.json ./dist/package-lock.json && \
    cd ./dist && \
    npm un -S playwright && \
    npm --quiet ci --omit=dev --no-bin-links && \
    rm -rf ./package-lock.json ./scripts ./ironSwords && \
    cd ..
  
CMD [ "dist/kineret/kineretBot.main" ]
