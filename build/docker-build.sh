aws ecr get-login-password --region $AWS_REGION | \
docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker buildx build --platform=linux/amd64 --provenance=false -t wiki-bot-playwright:$IMAGE_VERSION -f ./build/wiki-bot-playwright/Dockerfile . && \
docker tag wiki-bot-playwright:$IMAGE_VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wiki-bot-playwright:$IMAGE_VERSION && \
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wiki-bot-playwright:$IMAGE_VERSION
 