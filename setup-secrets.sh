#!/bin/bash

# Configuration
PROJECT_ID="billing-system-new"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔐 Setting up secrets in Google Cloud Secret Manager...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}📋 Setting project to $PROJECT_ID...${NC}"
gcloud config set project $PROJECT_ID

# Enable Secret Manager API
echo -e "${YELLOW}🔧 Enabling Secret Manager API...${NC}"
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

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo -e "${YELLOW}📄 Loading environment variables from .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}📄 No .env file found, please enter values manually...${NC}"
fi

# Create secrets
echo -e "${YELLOW}🔐 Creating secrets...${NC}"

# Database secrets
create_secret_if_not_exists "db-user" "${DB_USER:-oblix}"
create_secret_if_not_exists "db-password" "${DB_PASSWORD:-Oblix2025!}"
create_secret_if_not_exists "db-name" "${DB_NAME:-oblix}"
create_secret_if_not_exists "db-host" "${DB_HOST:-34.101.143.2}"

# JWT secrets
create_secret_if_not_exists "jwt-secret" "${JWT_SECRET:-sdfsd}"
create_secret_if_not_exists "jwt-refresh-secret" "${JWT_REFRESH_SECRET:-asa}"

# Email secrets
create_secret_if_not_exists "email-user" "${EMAIL_USER:-nouvalhabibie18@gmail.com}"
create_secret_if_not_exists "email-password" "${EMAIL_PASSWORD:-jaryncjtcjinrvbb}"

# Midtrans secrets
create_secret_if_not_exists "midtrans-server-key" "${MIDTRANS_SERVER_KEY:-}"
create_secret_if_not_exists "midtrans-client-key" "${MIDTRANS_CLIENT_KEY:-}"

echo -e "${GREEN}✅ All secrets have been created/updated successfully!${NC}"
echo -e "${GREEN}🔐 You can now run: ./deploy-secure.sh${NC}"

# List all secrets
echo -e "${YELLOW}📋 Available secrets:${NC}"
gcloud secrets list --format="table(name,createTime)" 