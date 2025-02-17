echo $AWS_ACCOUNT_ID
echo $AWS_REGION
aws ecr get-login-password --region $AWS_REGION | \
docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

npm run docker-build && \
docker tag wiki-bot-playwright $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wiki-bot-playwright:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wiki-bot-playwright:latest
