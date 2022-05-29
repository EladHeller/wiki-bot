npm run build && \
cp ./package.json ./dist/package.json  && \
cd ./dist && \
npm --quiet i --only=prod && \
rm -rf ./__tests__ ./package-lock.json && \
cd - && \
rm -f dist.zip && \
zip -rq9 dist.zip ./dist && \
cd ./send-email && \
npm --quiet i --only=prod && \
cd - && \
rm -f email.zip && \
zip -rq9 email.zip ./send-email && \
npm run update-s3 && \
echo finnish deploy!