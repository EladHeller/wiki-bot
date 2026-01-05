npm run build && \
cp ./package.json ./dist/package.json && \
cp ./package-lock.json ./dist/package-lock.json && \
cd ./dist && \
npm un -S playwright && \ 
npm --quiet ci --omit=dev --no-bin-links && \
rm -rf ./package-lock.json ./scripts ./ironSwords && \
    cd .. && \
    rm -f dist.zip && \
    find dist -exec touch -t 202401010000 {} + && \
    zip -rq9 dist.zip $(find dist -type f | sort)