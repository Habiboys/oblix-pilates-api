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

echo -e "${YELLOW}🔐 Starting secure deployment to Google Cloud Run...${NC}"

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

# Set project
echo -e "${YELLOW}📋 Setting project to $PROJECT_ID...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Function to create secret if it doesn't exist
create_secret_if_not_exists() {
    local secret_name=$1
    local secret_value=$2
    
    if ! gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
        echo -e "${YELLOW}🔐 Creating secret: $secret_name${NC}"
        echo -n "$secret_value" | gcloud secrets create "$secret_name" --data-file=-
    else
        echo -e "${YELLOW}🔐 Updating secret: $secret_name${NC}"
        echo -n "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=-
    fi
}

# Check if secrets exist, if not prompt user to create them
echo -e "${YELLOW}🔐 Checking secrets in Secret Manager...${NC}"

# List of required secrets
SECRETS=(
    "db-user"
    "db-password" 
    "db-name"
    "db-host"
    "jwt-secret"
    "jwt-refresh-secret"
    "email-user"
    "email-password"
    "midtrans-server-key"
    "midtrans-client-key"
)

MISSING_SECRETS=()

for secret in "${SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" >/dev/null 2>&1; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing secrets in Secret Manager:${NC}"
    printf '%s\n' "${MISSING_SECRETS[@]}"
    echo -e "${YELLOW}💡 Please create these secrets first using:${NC}"
    echo -e "${YELLOW}   gcloud secrets create SECRET_NAME --data-file=<(echo -n 'SECRET_VALUE')${NC}"
    echo -e "${YELLOW}   Or run this script with --setup-secrets flag${NC}"
    exit 1
fi

# Build and push Docker image
echo -e "${YELLOW}🐳 Building and pushing Docker image...${NC}"
docker build -t $IMAGE_NAME .
docker push $IMAGE_NAME

# Deploy to Cloud Run with secrets
echo -e "${YELLOW}🚀 Deploying to Cloud Run with secrets...${NC}"
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
  --set-secrets DB_USER=db-user:latest,DB_PASSWORD=db-password:latest,DB_NAME=db-name:latest,DB_HOST=db-host:latest \
  --set-secrets JWT_SECRET=jwt-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest \
  --set-secrets EMAIL_USER=email-user:latest,EMAIL_PASSWORD=email-password:latest \
  --set-secrets MIDTRANS_SERVER_KEY=midtrans-server-key:latest,MIDTRANS_CLIENT_KEY=midtrans-client-key:latest \
  --set-env-vars DB_DIALECT=mysql,DB_PORT=3306,FRONTEND_URL=http://localhost:3000,MIDTRANS_IS_PRODUCTION=false

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Secure deployment completed successfully!${NC}"
    
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