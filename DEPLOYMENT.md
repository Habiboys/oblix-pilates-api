# Deployment Guide

## Prerequisites

1. Install Google Cloud CLI (`gcloud`)
2. Install Docker
3. Authenticate with Google Cloud: `gcloud auth login`
4. Set your project: `gcloud config set project billing-system-new`

## Environment Variables Setup

### Option 1: Using .env file (Recommended)

1. Create a `.env` file in the root directory:
```bash
# Database Configuration
DB_USER=your-db-username
DB_PASSWORD=your-db-password
DB_NAME=oblix
DB_HOST=your-db-host
DB_DIALECT=mysql
DB_PORT=3306

# Application Configuration
PORT=8080

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-password

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com

# Midtrans Configuration
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_MERCHANT_ID=your-midtrans-merchant-id
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
```

### Option 2: Using System Environment Variables

Set environment variables in your shell:
```bash
export DB_USER=your-db-username
export DB_PASSWORD=your-db-password
export DB_NAME=oblix
export DB_HOST=your-db-host
export JWT_SECRET=your-super-secret-jwt-key-here
export JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
# ... set other variables as needed
```

## Deployment Options

### Option 1: Standard Deployment (using .env file)

1. Make sure your `.env` file is properly configured
2. Run the deployment script:
```bash
npm run deploy
# or
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Secure Deployment (using Google Cloud Secret Manager) - Recommended for Production

1. Setup secrets in Google Cloud Secret Manager:
```bash
npm run setup:secrets
# or
chmod +x setup-secrets.sh
./setup-secrets.sh
```

2. Deploy using secure method:
```bash
npm run deploy:secure
# or
chmod +x deploy-secure.sh
./deploy-secure.sh
```

**Note**: Secure deployment is recommended for production as it stores sensitive data in Google Cloud Secret Manager instead of environment variables.

## Available Scripts

```bash
# Standard deployment (using .env file)
npm run deploy

# Secure deployment (using Google Cloud Secret Manager)
npm run deploy:secure

# Setup secrets in Google Cloud Secret Manager
npm run setup:secrets

# Clean up secrets from Google Cloud Secret Manager
npm run cleanup:secrets
```

## Cloud Run Configuration

The deployment uses the following optimized configuration for Google Cloud Run:

- **Memory**: 1Gi (optimized for cost)
- **CPU**: 1 (sufficient for most workloads)
- **Max Instances**: 5 (respects quota limits)
- **Min Instances**: 0 (cost optimization)
- **Concurrency**: 80 (optimal for Node.js)
- **Timeout**: 300s (for long-running operations)

## Midtrans Integration

### Required Environment Variables for Midtrans

```bash
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_MERCHANT_ID=G603272561
MIDTRANS_SERVER_KEY=SB-Mid-server-J5fY9PYLPHKtqFgAieIycNpg
MIDTRANS_CLIENT_KEY=SB-Mid-client-F0crCerdomsPDiZ8
```

### Midtrans URL Configuration

Set these URLs in your Midtrans dashboard:

#### Notification URLs (Backend - Required)
```
Payment Notification URL:
https://oblix-pilates-api-439190874535.us-central1.run.app/api/order/payment/notification

Recurring Notification URL:
https://oblix-pilates-api-439190874535.us-central1.run.app/api/order/payment/recurring

Pay Account Notification URL:
https://oblix-pilates-api-439190874535.us-central1.run.app/api/order/payment/pay-account
```

#### Redirect URLs (Frontend - Recommended)
```
Finish Redirect URL:
https://your-frontend-domain.com/payment/success

Unfinish Redirect URL:
https://your-frontend-domain.com/payment/pending

Error Redirect URL:
https://your-frontend-domain.com/payment/error
```

#### Alternative: Backend Proxy URLs
If frontend is not ready, you can use backend as proxy:
```
Finish Redirect URL:
https://oblix-pilates-api-439190874535.us-central1.run.app/api/order/payment/finish

Unfinish Redirect URL:
https://oblix-pilates-api-439190874535.us-central1.run.app/api/order/payment/pending

Error Redirect URL:
https://oblix-pilates-api-439190874535.us-central1.run.app/api/order/payment/error
```

### Available Payment Endpoints

#### POST Endpoints (Notifications)
- `/api/order/payment/notification` - Payment notification from Midtrans
- `/api/order/payment/recurring` - Recurring payment notification
- `/api/order/payment/pay-account` - Pay Account status notification

#### GET Endpoints (Redirects)
- `/api/order/payment/finish` - Success payment redirect
- `/api/order/payment/error` - Error payment redirect
- `/api/order/payment/pending` - Pending payment redirect

## Security Notes

- **NEVER commit `.env` file to version control**
- The `.env` file is already in `.gitignore`
- Use strong, unique passwords and secrets
- Consider using Google Cloud Secret Manager for production deployments
- Rotate secrets regularly

## Troubleshooting

### Missing Environment Variables
If you see an error about missing environment variables, make sure:
1. Your `.env` file exists and is properly formatted
2. All required variables are set
3. No extra spaces or quotes around values

### Deployment Failed
- Check Google Cloud Console for detailed error logs
- Verify your Google Cloud project has billing enabled
- Ensure you have the necessary permissions
- Check quota limits in your region

### Quota Issues
If you encounter quota issues:
- Reduce `max-instances` in deployment scripts
- Request quota increase from Google Cloud Console
- Consider using a different region with higher capacity

### Midtrans Integration Issues
- Verify Midtrans credentials in environment variables
- Check notification URLs in Midtrans dashboard
- Ensure endpoints are accessible from internet
- Test with Midtrans sandbox environment

## Required Environment Variables

The following variables are **required** for deployment:
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password  
- `DB_NAME` - Database name
- `DB_HOST` - Database host
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - JWT refresh secret

The following variables are **required** for Midtrans:
- `MIDTRANS_MERCHANT_ID` - Midtrans merchant ID
- `MIDTRANS_SERVER_KEY` - Midtrans server key
- `MIDTRANS_CLIENT_KEY` - Midtrans client key

Optional variables (will use defaults if not set):
- `DB_DIALECT` - Database dialect (default: mysql)
- `DB_PORT` - Database port (default: 3306)
- `EMAIL_USER` - Email username
- `EMAIL_PASSWORD` - Email password
- `FRONTEND_URL` - Frontend URL (default: http://localhost:3000)
- `MIDTRANS_IS_PRODUCTION` - Midtrans production mode (default: false) 