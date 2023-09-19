npm run build && \
cp ./package.json ./dist/package.json && \
cp ./package-lock.json ./dist/package-lock.json && \
cd ./dist && \
npm --quiet ci --omit=dev --no-bin-links && \
rm -rf ./bot/__tests__ ./package-lock.json ./bot/scripts && \
cd .. && \
rm -f dist.zip && \
zip -rq9 dist.zip ./dist && \
cd ./send-email && \
npm --quiet ci --omit=dev && \
cd .. && \
rm -f email.zip && \
zip -rq9 email.zip ./send-email