# Deployment Skill

**Description**: Production deployment procedures and environment configuration for the BPS platform.

**Usage**: Use this skill when preparing for production deployment, configuring environments, or troubleshooting deployment issues.

## Capabilities

### 1. System Requirements

**Production Server**:
- **OS**: Windows Server 2019+ or Linux (Ubuntu 20.04+)
- **Python**: 3.10+
- **Node.js**: 18+ (for building frontend)
- **SQL Server**: 2019+ (or Azure SQL Database)
- **SMTP**: Bosch internal SMTP server (`smtp.bosch.com`)
- **Network**: Internal Bosch network access

**Minimum Hardware**:
- **CPU**: 4 cores
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB SSD
- **Network**: 100Mbps+

### 2. Environment Configuration

**Backend Environment Variables** (`.env` or `backend/config.py`):
```bash
# Database - SQL Server
DATABASE_SERVER=10.88.43.154
DATABASE_NAME=DCCT_BPS_Debug
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET_KEY=your_super_secret_key_min_32_bytes_random_string
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# SMTP Configuration (Bosch Internal)
SMTP_SERVER=smtp.bosch.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=bps-system@bosch.com
SMTP_PASSWORD=smtp_password
SMTP_FROM_EMAIL=noreply@bosch.com
SMTP_FROM_NAME=BPS System

# CORS Settings
ALLOWED_ORIGINS=https://bps.bosch.com,https://bps-staging.bosch.com

# Email Validation
ALLOWED_EMAIL_DOMAINS=bosch.com

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/bps/app.log
```

**Frontend Environment Variables** (`.env`):
```bash
# API Base URL
VITE_API_BASE_URL=https://bps.bosch.com/api

# Legacy Supabase (if still needed)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Environment-Specific Files**:
```
.env.development    # Local development
.env.staging        # Staging environment
.env.production     # Production environment
```

### 3. Database Setup

**Production Database Initialization**:
```sql
-- 1. Create database
CREATE DATABASE DCCT_BPS_Production;
GO

USE DCCT_BPS_Production;
GO

-- 2. Run schema script
-- Execute SQLSERVER_SCHEMA.sql

-- 3. Create application user
CREATE LOGIN bps_app_user WITH PASSWORD = 'SecurePassword123!';
CREATE USER bps_app_user FOR LOGIN bps_app_user;

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO bps_app_user;
GRANT EXECUTE ON SCHEMA::dbo TO bps_app_user;

-- 5. Verify indexes
SELECT 
    t.name AS TableName,
    i.name AS IndexName,
    i.type_desc AS IndexType
FROM sys.indexes i
JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('employees', 'competency_assessments', 'tasks')
ORDER BY t.name, i.name;

-- 6. Create backup schedule
-- Use SQL Server Agent or third-party tools
BACKUP DATABASE DCCT_BPS_Production
TO DISK = 'D:\Backups\BPS_Full.bak'
WITH FORMAT, INIT, NAME = 'Full Backup';
```

**Connection String** (Production):
```python
# backend/config.py
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Use environment variables in production
    database_server: str = os.getenv("DATABASE_SERVER", "10.88.43.154")
    database_name: str = os.getenv("DATABASE_NAME", "DCCT_BPS_Production")
    database_username: str = os.getenv("DATABASE_USERNAME")
    database_password: str = os.getenv("DATABASE_PASSWORD")
    
    @property
    def database_connection_string(self) -> str:
        return (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={self.database_server};"
            f"DATABASE={self.database_name};"
            f"UID={self.database_username};"
            f"PWD={self.database_password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;"  # Use proper SSL in production
        )

settings = Settings()
```

### 4. Backend Deployment

**Build Backend**:
```bash
# 1. Clone repository
git clone https://github.com/your-org/bps.git
cd bps/backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Verify installation
python -c "import fastapi; import pyodbc; print('Dependencies OK')"
```

**Run with Gunicorn** (Linux):
```bash
# Install gunicorn
pip install gunicorn uvicorn[standard]

# Run with multiple workers
gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile /var/log/bps/access.log \
  --error-logfile /var/log/bps/error.log \
  --log-level info \
  --timeout 120
```

**Run with Uvicorn** (Windows):
```powershell
# Production mode (no --reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Systemd Service** (Linux):
```ini
# /etc/systemd/system/bps-backend.service
[Unit]
Description=BPS Backend Service
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/opt/bps/backend
Environment="PATH=/opt/bps/backend/venv/bin"
EnvironmentFile=/etc/bps/backend.env
ExecStart=/opt/bps/backend/venv/bin/gunicorn main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --access-logfile /var/log/bps/access.log \
    --error-logfile /var/log/bps/error.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Start Service**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable bps-backend
sudo systemctl start bps-backend
sudo systemctl status bps-backend
```

### 5. Frontend Deployment

**Build Frontend**:
```bash
# 1. Install dependencies
cd frontend  # or project root
npm install

# 2. Set production environment
export VITE_API_BASE_URL=https://bps.bosch.com/api
# or use .env.production file

# 3. Build for production
npm run build

# Output: dist/ directory
```

**Build Output Structure**:
```
dist/
├── assets/
│   ├── index-abc123.js    # Main bundle (code-split)
│   ├── vendor-xyz789.js   # Vendor dependencies
│   └── index-def456.css   # Compiled CSS
├── index.html             # Entry point
└── favicon.ico
```

**Deploy with Nginx**:
```nginx
# /etc/nginx/sites-available/bps
server {
    listen 80;
    server_name bps.bosch.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bps.bosch.com;
    
    # SSL Certificate (use Bosch internal CA)
    ssl_certificate /etc/ssl/certs/bps.bosch.com.crt;
    ssl_certificate_key /etc/ssl/private/bps.bosch.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Frontend static files
    root /var/www/bps/dist;
    index index.html;
    
    # Serve static assets with cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # SPA fallback: all routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Logging
    access_log /var/log/nginx/bps_access.log;
    error_log /var/log/nginx/bps_error.log;
}
```

**Enable Nginx Config**:
```bash
sudo ln -s /etc/nginx/sites-available/bps /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### 6. IIS Deployment (Windows)

**Install IIS Components**:
```powershell
# Enable IIS with required features
Install-WindowsFeature -name Web-Server -IncludeManagementTools
Install-WindowsFeature -name Web-WebSockets
Install-WindowsFeature -name Web-Asp-Net45
```

**Backend: IIS with FastAPI**:
```powershell
# Install HttpPlatformHandler
# Download from: https://www.iis.net/downloads/microsoft/httpplatformhandler

# web.config in backend folder
```

```xml
<!-- backend/web.config -->
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="httpPlatformHandler" path="*" verb="*" 
           modules="httpPlatformHandler" resourceType="Unspecified" />
    </handlers>
    <httpPlatform processPath="C:\Python310\python.exe"
                  arguments="-m uvicorn main:app --host 0.0.0.0 --port %HTTP_PLATFORM_PORT%"
                  startupTimeLimit="60"
                  stdoutLogEnabled="true"
                  stdoutLogFile=".\logs\stdout.log">
      <environmentVariables>
        <environmentVariable name="PYTHONPATH" value="." />
      </environmentVariables>
    </httpPlatform>
  </system.webServer>
</configuration>
```

**Frontend: IIS Static Site**:
```xml
<!-- dist/web.config -->
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
    
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".woff" mimeType="font/woff" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
    
    <httpProtocol>
      <customHeaders>
        <add name="X-Frame-Options" value="SAMEORIGIN" />
        <add name="X-Content-Type-Options" value="nosniff" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

### 7. Security Hardening

**Backend Security**:
```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

app = FastAPI(
    title="BPS API",
    docs_url=None if settings.environment == "production" else "/api/docs",
    redoc_url=None if settings.environment == "production" else "/api/redoc",
)

# HTTPS redirect (production only)
if settings.environment == "production":
    app.add_middleware(HTTPSRedirectMiddleware)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["bps.bosch.com", "bps-staging.bosch.com"]
)

# CORS (strict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),  # No wildcards!
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Rate limiting (use slowapi or similar)
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/auth/send-otp")
@limiter.limit("5/hour")  # Max 5 OTP requests per hour per IP
async def send_otp(request: Request, email: str):
    ...
```

**Database Security**:
```sql
-- Use parameterized queries (already done)
-- ✅ cursor.execute("SELECT * FROM employees WHERE id = ?", (id,))
-- ❌ cursor.execute(f"SELECT * FROM employees WHERE id = {id}")

-- Limit permissions
REVOKE ALL ON DATABASE::DCCT_BPS_Production FROM bps_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO bps_app_user;
-- No DDL permissions (CREATE, DROP, ALTER)

-- Enable auditing
USE master;
GO
CREATE SERVER AUDIT BPS_Audit
TO FILE (FILEPATH = 'D:\Audit\');
GO
ALTER SERVER AUDIT BPS_Audit WITH (STATE = ON);
GO

USE DCCT_BPS_Production;
GO
CREATE DATABASE AUDIT SPECIFICATION BPS_DB_Audit
FOR SERVER AUDIT BPS_Audit
ADD (SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo BY PUBLIC);
GO
ALTER DATABASE AUDIT SPECIFICATION BPS_DB_Audit WITH (STATE = ON);
GO
```

### 8. Monitoring & Logging

**Application Logging** (`backend/main.py`):
```python
import logging
from logging.handlers import RotatingFileHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            settings.log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        ),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("bps")

# Log all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    logger.info(f"📥 {request.method} {request.url.path}")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(f"📤 {request.method} {request.url.path} - {response.status_code} ({process_time:.2f}s)")
    
    return response
```

**Health Check Endpoint**:
```python
@app.get("/api/health")
async def health_check():
    """Health check for load balancer"""
    try:
        # Check database connection
        cursor = get_db_cursor()
        cursor.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    return {
        "status": "healthy",
        "database": db_status,
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Prometheus Metrics** (optional):
```python
from prometheus_fastapi_instrumentator import Instrumentator

instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app)

# Metrics available at /metrics
```

**Nginx Access Log Analysis**:
```bash
# Top 10 most accessed endpoints
awk '{print $7}' /var/log/nginx/bps_access.log | sort | uniq -c | sort -rn | head -10

# Response time analysis
awk '{print $NF}' /var/log/nginx/bps_access.log | awk '{sum+=$1; count++} END {print "Avg:", sum/count, "Max:", max}'

# Error rate
grep " 5[0-9][0-9] " /var/log/nginx/bps_access.log | wc -l
```

### 9. Backup & Disaster Recovery

**Database Backup Schedule**:
```sql
-- Full backup (weekly)
BACKUP DATABASE DCCT_BPS_Production
TO DISK = 'D:\Backups\BPS_Full_' + CONVERT(VARCHAR, GETDATE(), 112) + '.bak'
WITH FORMAT, INIT, COMPRESSION;

-- Differential backup (daily)
BACKUP DATABASE DCCT_BPS_Production
TO DISK = 'D:\Backups\BPS_Diff_' + CONVERT(VARCHAR, GETDATE(), 112) + '.bak'
WITH DIFFERENTIAL, COMPRESSION;

-- Transaction log backup (hourly)
BACKUP LOG DCCT_BPS_Production
TO DISK = 'D:\Backups\BPS_Log_' + CONVERT(VARCHAR, GETDATE(), 112) + '_' + REPLACE(CONVERT(VARCHAR, GETDATE(), 108), ':', '') + '.trn'
WITH COMPRESSION;
```

**Backup Script** (PowerShell):
```powershell
# backup.ps1
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "D:\Backups"
$s3Bucket = "s3://bps-backups"

# SQL Server backup
sqlcmd -S localhost -Q "BACKUP DATABASE DCCT_BPS_Production TO DISK = '$backupDir\BPS_$date.bak' WITH COMPRESSION"

# Upload to S3 (or network share)
aws s3 cp "$backupDir\BPS_$date.bak" "$s3Bucket/"

# Clean old backups (keep 30 days)
Get-ChildItem $backupDir -Filter "BPS_*.bak" | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)} | Remove-Item
```

**Restore Procedure**:
```sql
-- 1. Stop application
-- 2. Restore database
RESTORE DATABASE DCCT_BPS_Production
FROM DISK = 'D:\Backups\BPS_20250115_120000.bak'
WITH REPLACE, RECOVERY;

-- 3. Verify data
SELECT COUNT(*) FROM employees;
SELECT COUNT(*) FROM competency_assessments;

-- 4. Restart application
```

### 10. Deployment Checklist

**Pre-Deployment**:
- [ ] All tests passing (`pytest`, `npm run typecheck`)
- [ ] Code reviewed and approved
- [ ] Database schema updated
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Backup created
- [ ] Rollback plan prepared

**Deployment Steps**:
- [ ] Put application in maintenance mode
- [ ] Pull latest code (`git pull origin main`)
- [ ] Update dependencies (`pip install -r requirements.txt`, `npm install`)
- [ ] Run database migrations
- [ ] Build frontend (`npm run build`)
- [ ] Deploy frontend to web server
- [ ] Restart backend service
- [ ] Verify health check endpoint
- [ ] Test critical user flows
- [ ] Remove maintenance mode
- [ ] Monitor logs for errors

**Post-Deployment**:
- [ ] Verify all pages load
- [ ] Test authentication flow
- [ ] Check database connections
- [ ] Monitor response times
- [ ] Review error logs
- [ ] Notify team of successful deployment
- [ ] Update documentation (if needed)

**Rollback Procedure**:
```bash
# 1. Stop current version
sudo systemctl stop bps-backend

# 2. Revert code
git checkout <previous-commit>

# 3. Restore database (if schema changed)
# Run restore script

# 4. Rebuild/restart
npm run build
sudo systemctl start bps-backend

# 5. Verify rollback successful
curl https://bps.bosch.com/api/health
```

## Troubleshooting

**Issue: 502 Bad Gateway**
- **Check**: Backend service running? `sudo systemctl status bps-backend`
- **Check**: Firewall blocking port 8000? `sudo ufw status`
- **Check**: Backend logs: `tail -f /var/log/bps/error.log`

**Issue: Database Connection Failed**
- **Check**: SQL Server accessible? `telnet 10.88.43.154 1433`
- **Check**: Credentials correct in `.env`?
- **Check**: Firewall rules for SQL Server port?

**Issue: CORS Errors**
- **Check**: `allowed_origins` in `backend/config.py`
- **Check**: Nginx proxy headers configured?
- **Check**: Frontend making requests to correct API URL?

**Issue: High CPU Usage**
- **Check**: Number of workers (reduce if needed)
- **Check**: Slow database queries (add indexes)
- **Check**: Memory leaks (restart service)

**Issue: Slow Response Times**
- **Check**: Database query performance
- **Check**: Network latency
- **Check**: Frontend bundle size (code splitting)
