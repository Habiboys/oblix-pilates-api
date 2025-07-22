# Deployment Guide - Google Cloud Run

## Prerequisites

### 1. Google Cloud SDK
```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### 2. Docker
```bash
# Install Docker
# For macOS: https://docs.docker.com/desktop/mac/install/
# For Ubuntu: https://docs.docker.com/engine/install/ubuntu/
```

### 3. MySQL Server
```bash
# Ensure you have a MySQL server running and accessible
# The application will connect to your existing MySQL server
# Make sure the server allows connections from the deployment environment
```

### 4. Required APIs
```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

## Environment Setup

### 1. Create Environment File
```bash
# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

### 2. Set Up Secrets (Recommended)
```bash
# Create secrets for sensitive data
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "your-jwt-refresh-secret" | gcloud secrets create jwt-refresh-secret --data-file=-
echo -n "your-db-host" | gcloud secrets create db-host --data-file=-
echo -n "your-db-username" | gcloud secrets create db-username --data-file=-
echo -n "your-db-password" | gcloud secrets create db-password --data-file=-
echo -n "your-midtrans-server-key" | gcloud secrets create midtrans-server-key --data-file=-
echo -n "your-midtrans-client-key" | gcloud secrets create midtrans-client-key --data-file=-
echo -n "your-email-user" | gcloud secrets create email-user --data-file=-
echo -n "your-email-password" | gcloud secrets create email-password --data-file=-
```

## Local Development

### 1. Using Docker Compose (Recommended)
```bash
# Copy environment template
cp env.example .env

# Edit environment variables (make sure DB_HOST points to your MySQL)
nano .env

# Start app service
npm run docker:compose

# View logs
docker-compose logs -f app

# Stop services
npm run docker:compose:down
```

### 2. Using Docker Only (Alternative)
```bash
# Copy environment template
cp env.example .env

# Edit environment variables (make sure DB_HOST points to your MySQL)
nano .env

# Build image
npm run docker:build

# Run container
npm run docker:run
```

## Production Deployment

### 1. Quick Deployment
```bash
# Edit deploy.sh and set your PROJECT_ID
nano deploy.sh

# Run deployment
npm run deploy
```

### 2. Manual Deployment
```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Build and push image
docker build -t gcr.io/YOUR_PROJECT_ID/oblix-pilates-api .
docker push gcr.io/YOUR_PROJECT_ID/oblix-pilates-api

# Deploy to Cloud Run
gcloud run deploy oblix-pilates-api \
  --image gcr.io/YOUR_PROJECT_ID/oblix-pilates-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300 \
  --concurrency 80
```

## Configuration

### 1. Environment Variables
```bash
# Required for production
PORT=8080
DB_HOST=your-cloud-sql-host
DB_NAME=oblix
DB_USER=your-db-username
DB_PASSWORD=your-db-password
DB_DIALECT=mysql
DB_PORT=3306
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-password
FRONTEND_URL=https://your-frontend-url
MIDTRANS_IS_PRODUCTION=true
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
```

### 2. Cloud Run Configuration
- **Memory**: 2Gi (recommended for Node.js apps)
- **CPU**: 2 (for better performance)
- **Concurrency**: 80 (optimal for Node.js)
- **Timeout**: 300s (for long-running operations)
- **Min Instances**: 0 (cost optimization)
- **Max Instances**: 10 (scalability)

### 3. Database Setup
```bash
# Ensure your MySQL server is accessible from Cloud Run
# Update your MySQL configuration to allow connections from Cloud Run IP ranges

# Create database if not exists
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS oblix;"

# Create user if not exists
mysql -u root -p -e "CREATE USER IF NOT EXISTS 'oblix-user'@'%' IDENTIFIED BY 'your-password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON oblix.* TO 'oblix-user'@'%';"
mysql -u root -p -e "FLUSH PRIVILEGES;"

# Note: Make sure your MySQL server allows connections from Cloud Run
# You may need to configure firewall rules or use Cloud SQL Proxy
```

## Monitoring & Logging

### 1. View Logs
```bash
# View Cloud Run logs
gcloud logs read "resource.type=cloud_run_revision" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"

# View specific service logs
gcloud logs read "resource.labels.service_name=oblix-pilates-api" \
  --limit=50
```

### 2. Monitor Performance
```bash
# View metrics in Cloud Console
# Go to: https://console.cloud.google.com/run
# Select your service and view metrics
```

## Troubleshooting

### 1. Common Issues

#### Container Fails to Start
```bash
# Check logs
gcloud logs read "resource.type=cloud_run_revision" \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)"
```

#### Database Connection Issues
```bash
# Verify database connection
mysql -h your-db-host -u your-db-user -p oblix

# Check firewall rules and network connectivity
# Ensure your MySQL server allows connections from Cloud Run IP ranges
# You may need to configure your MySQL server's bind-address and firewall rules
```

#### Health Check Fails
```bash
# Test health endpoint
curl https://your-service-url/health

# Check health check configuration
gcloud run services describe oblix-pilates-api \
  --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].livenessProbe)"
```

### 2. Performance Optimization

#### Memory Issues
```bash
# Increase memory
gcloud run services update oblix-pilates-api \
  --region=us-central1 \
  --memory=4Gi
```

#### Cold Start Issues
```bash
# Set min instances to 1
gcloud run services update oblix-pilates-api \
  --region=us-central1 \
  --min-instances=1
```

## Security

### 1. Secrets Management
```bash
# Use Secret Manager for sensitive data
gcloud secrets create db-password --data-file=<(echo -n "your-password")
gcloud secrets create jwt-secret --data-file=<(echo -n "your-jwt-secret")
```

### 2. Network Security
```bash
# Restrict database access
gcloud sql instances patch oblix-pilates-db \
  --authorized-networks=YOUR_CLOUD_RUN_IP_RANGE
```

### 3. IAM Permissions
```bash
# Grant minimal required permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

## Cost Optimization

### 1. Resource Optimization
- Use `min-instances=0` for cost savings
- Set appropriate `max-instances` based on traffic
- Use `cpu-throttling=true` for non-critical workloads

### 2. Monitoring Costs
```bash
# View cost breakdown
gcloud billing accounts list
gcloud billing projects describe YOUR_PROJECT_ID
```

## CI/CD Pipeline

### 1. GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud Run
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Deploy to Cloud Run
      uses: google-github-actions/deploy-cloudrun@v0
      with:
        service: oblix-pilates-api
        image: gcr.io/${{ secrets.PROJECT_ID }}/oblix-pilates-api
        region: us-central1
```

### 2. Cloud Build
```yaml
# cloudbuild.yaml
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'gcr.io/$PROJECT_ID/oblix-pilates-api', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/$PROJECT_ID/oblix-pilates-api']
- name: 'gcr.io/cloud-builders/gcloud'
  args:
  - 'run'
  - 'deploy'
  - 'oblix-pilates-api'
  - '--image'
  - 'gcr.io/$PROJECT_ID/oblix-pilates-api'
  - '--region'
  - 'us-central1'
  - '--platform'
  - 'managed'
```

## Support

For issues and questions:
1. Check Cloud Run logs
2. Review application logs
3. Test locally with Docker
4. Check environment variables
5. Verify database connectivity 