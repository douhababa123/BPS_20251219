# BPS Backend Dockerfile
# 基于 Python 3.9 slim-bullseye（Debian 11），支持 ARM64（Jetson）和 AMD64
# 使用 bullseye 固定 Debian 11，确保 apt-key 可用且与 MS Debian 11 包兼容
FROM python:3.9-slim-bullseye

# 安装 ODBC Driver 17 for SQL Server（pyodbc 依赖）
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    apt-transport-https \
    unixodbc-dev \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list \
        -o /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 安装 Python 依赖（先复制 requirements 利用缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
