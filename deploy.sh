npm run build && \
cp ./package.json ./dist/package.json  && \
cd ./dist && \
npm install --only=prod && \
rm ./package-lock.json && \
cd - && \
npm run zip && \
npm run upload-lambda && \
echo finnish!