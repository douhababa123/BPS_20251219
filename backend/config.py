"""
应用配置模块
用于加载和管理环境变量配置
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """应用配置类"""
    
    # SQL Server 配置
    db_server: str = "10.88.43.154"
    db_database: str = "DCCT_BPS_Debug"
    db_username: str = "TEST"
    db_password: str = "123456"
    db_driver: str = "ODBC Driver 17 for SQL Server"
    
    # JWT 配置
    jwt_secret_key: str = "your-secret-key-change-this-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 43200  # 30天（30*24*60分钟）
    
    # OTP 配置
    otp_expire_minutes: int = 5
    otp_length: int = 6
    
    # SMTP 配置
    smtp_host: str = "smtp.bosch.com"
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_username: str = ""
    smtp_password: str = ""
    
    # 应用配置
    app_name: str = "BPS API"
    app_version: str = "1.0.0"
    debug: bool = True
    
    # CORS 配置
    allowed_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",  # Vite dev server alternative port
        "http://localhost:3000",
    ]
    
    # 允许的邮箱域名
    allowed_email_domains: List[str] = ["bosch.com", "bshg.com"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # 忽略.env中未定义的字段


# 创建全局配置实例
settings = Settings()
