npm run build && \
cp ./package.json ./dist/package.json  && \
cd ./dist && \
npm install --only=prod && \
rm ./package-lock.json && \
cd - && \
rm -f dist.zip && zip -r9 dist.zip ./dist && \
cd ./send-email && \
npm i && \
cd - && \
rm -f email.zip && zip -r9 email.zip ./send-email && \
npm run upload-lambda && \
echo finnish bot!