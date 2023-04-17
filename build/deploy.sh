npm run build && \
cp ./package.json ./dist/package.json  && \
cd ./dist && \
npm --quiet ci --only=prod --no-bin-links && \
rm -rf ./__tests__ ./package-lock.json && \
cd - && \
rm -f dist.zip && \
zip -rq9 dist.zip ./dist && \
cd ./send-email && \
npm --quiet ci --only=prod && \
cd - && \
rm -f email.zip && \
zip -rq9 email.zip ./send-email && \
npm run update-s3 && \
echo finnish deploy!