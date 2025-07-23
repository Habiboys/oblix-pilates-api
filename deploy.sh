#!/bin/bash

# Configuration
PROJECT_ID="billing-system-new"
REGION="us-central1"
SERVICE_NAME="oblix-pilates-api"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting deployment to Google Cloud Run...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install it first.${NC}"
    exit 1
fi

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo -e "${YELLOW}📄 Loading environment variables from .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}📄 No .env file found, using system environment variables...${NC}"
fi

# Check if required environment variables are set
REQUIRED_VARS=("DB_USER" "DB_PASSWORD" "DB_NAME" "DB_HOST" "JWT_SECRET" "JWT_REFRESH_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    printf '%s\n' "${MISSING_VARS[@]}"
    echo -e "${YELLOW}💡 Please set these variables in your .env file or system environment${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}📋 Setting project to $PROJECT_ID...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and push Docker image
echo -e "${YELLOW}🐳 Building and pushing Docker image...${NC}"
docker build -t $IMAGE_NAME .
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300 \
  --concurrency 80 \
  --set-env-vars DB_USER="$DB_USER",DB_PASSWORD="$DB_PASSWORD",DB_NAME="$DB_NAME",DB_HOST="$DB_HOST",DB_DIALECT="${DB_DIALECT:-mysql}",DB_PORT="${DB_PORT:-3306}" \
  --set-env-vars JWT_SECRET="$JWT_SECRET",JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  --set-env-vars EMAIL_USER="${EMAIL_USER:-}",EMAIL_PASSWORD="${EMAIL_PASSWORD:-}" \
  --set-env-vars FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}" \
  --set-env-vars MIDTRANS_IS_PRODUCTION="${MIDTRANS_IS_PRODUCTION:-false}",MIDTRANS_SERVER_KEY="${MIDTRANS_SERVER_KEY:-}",MIDTRANS_CLIENT_KEY="${MIDTRANS_CLIENT_KEY:-}"

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
    
    if [ -n "$SERVICE_URL" ]; then
        echo -e "${GREEN}🌐 Service URL: $SERVICE_URL${NC}"
        echo -e "${GREEN}📊 API Documentation: $SERVICE_URL/api-docs${NC}"
        echo -e "${GREEN}❤️  Health Check: $SERVICE_URL/health${NC}"

        # Test health endpoint
        echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
        sleep 10
        curl -f "$SERVICE_URL/health"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Health check passed!${NC}"
        else
            echo -e "${RED}❌ Health check failed!${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to get service URL${NC}"
    fi
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi 