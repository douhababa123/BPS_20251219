"""
独立的后端服务器启动脚本
避免被其他进程干扰
"""
import uvicorn

if __name__ == "__main__":
    print("=" * 70)
    print("🚀 启动 BPS 后端服务器...")
    print("=" * 70)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
