set -a  
source .env
docker run --platform linux/arm64 -d -p 9000:8080 \
    -e USER_NAME=$USER_NAME \
    -e PASSWORD=$PASSWORD \
    tests-docker
set +a  