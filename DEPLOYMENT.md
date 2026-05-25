# NutriCal - AWS Elastic Beanstalk Deployment Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Local Setup](#local-setup)
5. [AWS Configuration](#aws-configuration)
6. [Deployment](#deployment)
7. [Environment Variables](#environment-variables)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)
10. [CI/CD Integration](#cicd-integration)

---

## 📌 Overview

NutriCal is deployed as a single Node.js application on AWS Elastic Beanstalk that:
- Serves the React frontend as static assets
- Proxies all API requests to the backend (NutriCalBack)
- Handles authentication and authorization
- Manages food database, recipes, and calorie tracking

**Stack:**
- Frontend: React 18 + Vite
- Server: Express.js
- Database: PostgreSQL (RDS)
- Deployment: AWS Elastic Beanstalk
- Storage: AWS S3 (for images)

---

## 🔧 Prerequisites

### Local Development
- Node.js 18.x or higher
- npm 9.x or higher
- Git
- PostgreSQL (for local testing)

### AWS Deployment
- AWS Account with appropriate permissions
- AWS EB CLI: `pip install awsebcli`
- AWS Credentials configured: `aws configure`
- IAM role with Beanstalk permissions

### Required AWS Services
1. **Elastic Beanstalk** - Application hosting
2. **RDS PostgreSQL** - Database
3. **S3** - Image storage
4. **CloudWatch** - Logging and monitoring
5. **IAM** - Access control

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AWS Elastic Beanstalk                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Application Load Balancer                │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         EC2 Instance (Node.js + Express)            │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │    Frontend (React SPA - Static Assets)        │ │  │
│  │  ├─────────────────────────────────────────────────┤ │  │
│  │  │         Express Proxy Server                    │ │  │
│  │  │  • Serves /dist (React build)                  │ │  │
│  │  │  • Proxies /api/* requests                     │ │  │
│  │  │  • Handles CORS                                │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│            Connects to External Services:                   │
│            • RDS PostgreSQL (Backend API)                   │
│            • S3 (Image Storage)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Local Setup

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/Dantvader/NutriCalFronter.git
cd NutriCalFronter
npm install
\`\`\`

### 2. Install Frontend Dependencies
\`\`\`bash
cd frontend
npm install
cd ..
\`\`\`

### 3. Create .env File
\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your configuration:
\`\`\`
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
VITE_API_URL=http://localhost:3000/api
\`\`\`

### 4. Build Frontend
\`\`\`bash
npm run build
\`\`\`

### 5. Start Local Server
\`\`\`bash
npm start
\`\`\`

The application will be available at `http://localhost:3000`

### Development Mode with Hot Reload
\`\`\`bash
# Terminal 1: Frontend development server
cd frontend
npm run dev

# Terminal 2: Backend API (from NutriCalBack repo)
npm start

# Terminal 3: Express server (optional)
npm run dev:server
\`\`\`

---

## ☁️ AWS Configuration

### Step 1: Set Up RDS PostgreSQL

1. **Create RDS Instance:**
   - Engine: PostgreSQL 14.x
   - Instance Class: db.t3.micro (for development)
   - Storage: 20 GB gp2
   - Database name: nutridb
   - Master username: admin
   - Auto backup: 7 days

2. **Security Group:**
   - Allow inbound on port 5432 from EB security group
   - Allow inbound on port 5432 from your IP (for management)

3. **Get Connection Info:**
   - Endpoint: `your-instance.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com`
   - Port: 5432
   - Database: nutridb

### Step 2: Create S3 Bucket for Images

\`\`\`bash
aws s3 mb s3://nutrical-images-prod --region us-east-1
\`\`\`

**Bucket Policy:**
\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nutrical-images-prod/*"
    }
  ]
}
\`\`\`

### Step 3: Create IAM Role for EB

1. Go to IAM → Roles → Create Role
2. Service: EC2
3. Attach policies:
   - `AWSElasticBeanstalkWebTier`
   - `AWSElasticBeanstalkMulticontainerDocker`
   - Custom S3 policy for your bucket
   - Custom RDS policy

**Custom S3 Policy:**
\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::nutrical-images-prod",
        "arn:aws:s3:::nutrical-images-prod/*"
      ]
    }
  ]
}
\`\`\`

---

## 🚢 Deployment

### Step 1: Initialize Elastic Beanstalk

\`\`\`bash
eb init -p node.js-18 nutrical-frontend --region us-east-1
\`\`\`

This creates `.elasticbeanstalk/config.yml`

### Step 2: Create EB Environment

\`\`\`bash
eb create nutrical-prod \
  --instance-type t3.micro \
  --scale 1 \
  --envvars NODE_ENV=production,PORT=3000
\`\`\`

### Step 3: Configure Environment Variables

\`\`\`bash
eb setenv \
  NODE_ENV=production \
  PORT=3000 \
  API_URL=http://localhost:3000 \
  CORS_ORIGIN="https://nutrical.elasticbeanstalk.com" \
  VITE_API_URL=https://api-backend.elasticbeanstalk.com/api
\`\`\`

### Step 4: Deploy Application

\`\`\`bash
# Build frontend
npm run build

# Deploy to Beanstalk
eb deploy
\`\`\`

### Step 5: Monitor Deployment

\`\`\`bash
# View deployment progress
eb logs --stream

# Check environment health
eb health

# Get environment info
eb info
\`\`\`

---

## 🔐 Environment Variables

Create `.env` in the root directory:

\`\`\`bash
# Server Configuration
NODE_ENV=production
PORT=3000

# API Configuration
API_URL=https://your-backend-api.com
CORS_ORIGIN=https://nutrical.elasticbeanstalk.com

# Frontend Configuration
VITE_API_URL=/api

# Database (if needed for frontend)
DATABASE_URL=postgresql://admin:password@your-db.rds.amazonaws.com:5432/nutridb

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=nutrical-images-prod
\`\`\`

**Set in Beanstalk:**
\`\`\`bash
eb setenv KEY1=value1 KEY2=value2 KEY3=value3
\`\`\`

---

## 📊 Monitoring & Logs

### View Real-time Logs
\`\`\`bash
eb logs --stream
\`\`\`

### View Application Logs
\`\`\`bash
eb logs
\`\`\`

### SSH Into Instance
\`\`\`bash
eb ssh
\`\`\`

### Monitor in CloudWatch
1. Go to CloudWatch → Logs
2. Look for logs in `/aws/elasticbeanstalk/nutrical-prod/`

### Health Dashboard
\`\`\`bash
eb health
eb health --refresh  # Auto-refresh every 10 seconds
\`\`\`

### Check Environment Status
\`\`\`bash
eb status
eb config  # View configuration
\`\`\`

---

## ⚠️ Troubleshooting

### Deployment Fails
\`\`\`bash
# View detailed error logs
eb logs

# Check environment events
eb events --follow

# SSH and check Node process
eb ssh
ps aux | grep node
\`\`\`

### Application Not Responding
\`\`\`bash
# Check health status
eb health

# Check instance logs
eb logs --stream

# Restart application
eb abort  # Cancel deployment
eb deploy  # Re-deploy
\`\`\`

### Database Connection Issues
\`\`\`bash
# Check if RDS is accessible
eb ssh
# Inside instance:
psql -h your-db.rds.amazonaws.com -U admin -d nutridb

# Check security groups
# Make sure EB security group has access to RDS
\`\`\`

### API Proxy Issues
\`\`\`bash
# Check if backend is reachable
curl https://your-backend-api.com/health

# Verify API_URL environment variable
eb ssh
echo $API_URL
\`\`\`

### CORS Errors
1. Check `CORS_ORIGIN` environment variable
2. Ensure it matches your domain
3. Update `.ebextensions/nginx.config` if needed
4. Redeploy: `eb deploy`

---

## 🔄 CI/CD Integration with GitHub Actions

Create `.github/workflows/deploy.yml`:

\`\`\`yaml
name: Deploy to Elastic Beanstalk

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build frontend
        run: npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Install EB CLI
        run: pip install awsebcli
      
      - name: Deploy to Elastic Beanstalk
        run: |
          eb init -p node.js-18 nutrical-frontend --region us-east-1
          eb deploy nutrical-prod
\`\`\`

### Set GitHub Secrets
1. Go to Settings → Secrets and variables → Actions
2. Add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `EB_ENVIRONMENT` = nutrical-prod

---

## 📝 Common Commands

\`\`\`bash
# Initialize project
eb init

# Create environment
eb create nutrical-prod

# Deploy changes
eb deploy

# View logs
eb logs --stream

# SSH into instance
eb ssh

# Set environment variables
eb setenv KEY=VALUE

# Scale instances
eb scale 3

# Terminate environment
eb terminate nutrical-prod

# List environments
eb list

# Check health
eb health

# Open web console
eb open
\`\`\`

---

## 🔒 Security Best Practices

1. **Never commit `.env` files**
   - Use `.env.example` as template
   - Always use `.gitignore`

2. **Use AWS Secrets Manager for sensitive data**
   - Rotate keys regularly
   - Use IAM roles instead of static keys

3. **Enable HTTPS**
   - Use AWS Certificate Manager (ACM)
   - Enforce HTTPS redirect in Nginx

4. **Regular Backups**
   - RDS automatic backups: 7+ days
   - Test restore procedures regularly

5. **Update Dependencies**
   \`\`\`bash
   npm update
   npm audit
   npm audit fix
   \`\`\`

---

## 📈 Scaling Considerations

### Horizontal Scaling (More Instances)
- Auto-scaling configured in `.ebextensions/autoscaling.config`
- Scales 1-3 instances based on CPU utilization
- Load balancer distributes traffic

### Vertical Scaling (Better Instances)
- Change instance type in `.ebextensions/autoscaling.config`
- Available: t3.micro, t3.small, t3.medium, etc.

### Database Scaling
- Use RDS read replicas for read-heavy workloads
- Consider Aurora for auto-scaling

---

## ✅ Deployment Checklist

- [ ] All environment variables set in EB
- [ ] RDS database created and accessible
- [ ] S3 bucket configured
- [ ] Frontend builds successfully (`npm run build`)
- [ ] `.ebextensions/` files present
- [ ] `.gitignore` properly configured
- [ ] Security groups allow necessary traffic
- [ ] CORS_ORIGIN matches your domain
- [ ] SSL certificate configured
- [ ] Backups enabled
- [ ] Monitoring and alarms set up
- [ ] CI/CD pipeline configured

---

## 📞 Support

For issues or questions:
1. Check EB logs: `eb logs --stream`
2. Review AWS documentation: https://docs.aws.amazon.com/elasticbeanstalk/
3. Check GitHub Issues: https://github.com/Dantvader/NutriCalFronter/issues

---

**Last Updated:** May 25, 2026
**Version:** 1.0.0
