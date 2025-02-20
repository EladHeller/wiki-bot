set -a  
source .env
docker run --platform linux/arm64 -d -v ~/.aws-lambda-rie:/aws-lambda -p 9000:8080 \
    --entrypoint /aws-lambda/aws-lambda-rie \
    -e USER_NAME=$USER_NAME \
    -e PASSWORD=$PASSWORD \
    wiki-bot-playwright \
        /usr/local/bin/npx aws-lambda-ric dist/ironSwords/index.main
set +a  