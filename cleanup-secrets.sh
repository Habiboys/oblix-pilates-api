#!/bin/bash

# Configuration
PROJECT_ID="billing-system-new"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Cleaning up secrets from Google Cloud Secret Manager...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}📋 Setting project to $PROJECT_ID...${NC}"
gcloud config set project $PROJECT_ID

# List of secrets to delete
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

echo -e "${YELLOW}⚠️  This will delete the following secrets:${NC}"
printf '%s\n' "${SECRETS[@]}"

read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Operation cancelled.${NC}"
    exit 1
fi

# Delete secrets
for secret in "${SECRETS[@]}"; do
    if gcloud secrets describe "$secret" >/dev/null 2>&1; then
        echo -e "${YELLOW}🗑️  Deleting secret: $secret${NC}"
        gcloud secrets delete "$secret" --quiet
    else
        echo -e "${YELLOW}ℹ️  Secret $secret does not exist, skipping...${NC}"
    fi
done

echo -e "${GREEN}✅ Cleanup completed!${NC}" 