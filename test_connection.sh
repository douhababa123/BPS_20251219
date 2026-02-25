#!/bin/bash
#
# 数据库连接测试脚本
# 用途: 部署前验证 SQL Server 连接
# 使用: bash test_connection.sh
#

echo "=========================================="
echo "  BPS 数据库连接测试"
echo "  目标: 10.88.43.154:1433"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Ping 测试
echo -e "${YELLOW}[1/4] 测试网络连通性...${NC}"
if ping -c 3 -W 2 10.88.43.154 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 网络可达${NC}"
    ping -c 3 10.88.43.154 | grep 'time='
else
    echo -e "${RED}❌ 网络不可达 - 无法 ping 通 10.88.43.154${NC}"
    echo "   可能原因:"
    echo "   1. Jetson 与 SQL Server 不在同一网段"
    echo "   2. 网络防火墙阻止 ICMP"
    echo "   3. SQL Server 服务器关闭"
    exit 1
fi

# 2. 端口测试
echo -e "\n${YELLOW}[2/4] 测试端口 1433...${NC}"
if command -v nc &> /dev/null; then
    # 使用 netcat
    if timeout 3 nc -zv 10.88.43.154 1433 2>&1 | grep -q "succeeded"; then
        echo -e "${GREEN}✅ 端口 1433 开放${NC}"
    else
        echo -e "${RED}❌ 端口 1433 无法访问${NC}"
        echo "   请在 SQL Server 端检查:"
        echo "   1. SQL Server Configuration Manager → TCP/IP 协议已启用"
        echo "   2. Windows 防火墙 → 允许 1433 端口"
        echo "   3. SQL Server 正在运行"
        exit 1
    fi
elif command -v telnet &> /dev/null; then
    # 使用 telnet
    if timeout 3 bash -c "echo > /dev/tcp/10.88.43.154/1433" 2>/dev/null; then
        echo -e "${GREEN}✅ 端口 1433 开放${NC}"
    else
        echo -e "${RED}❌ 端口 1433 无法访问${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  未找到 nc 或 telnet，跳过端口测试${NC}"
    echo "   安装命令: sudo apt install netcat-openbsd"
fi

# 3. 防火墙规则检查（提供 SQL Server 端命令）
echo -e "\n${YELLOW}[3/4] SQL Server 端防火墙配置检查...${NC}"
echo "   请在 SQL Server (10.88.43.154) 上运行以下 PowerShell 命令:"
echo ""
echo -e "${GREEN}# 检查 1433 端口规则${NC}"
echo "Get-NetFirewallRule | Where-Object {(\$_.DisplayName -like '*SQL*' -or \$_.DisplayName -like '*1433*') -and \$_.Enabled -eq 'True'} | Format-Table DisplayName, Direction, Action"
echo ""
echo -e "${GREEN}# 如果没有规则，添加入站规则:${NC}"
echo "New-NetFirewallRule -DisplayName 'SQL Server (TCP 1433)' -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow -RemoteAddress 10.70.80.183"
echo ""
read -p "是否已确认防火墙规则正确? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  请先配置 SQL Server 防火墙${NC}"
    exit 1
fi

# 4. ODBC 驱动测试
echo -e "\n${YELLOW}[4/4] 测试 ODBC 驱动...${NC}"

if command -v odbcinst &> /dev/null; then
    DRIVER=$(odbcinst -q -d | grep "SQL Server")
    if [ -n "$DRIVER" ]; then
        echo -e "${GREEN}✅ 已安装 ODBC 驱动:${NC}"
        odbcinst -q -d
    else
        echo -e "${RED}❌ 未安装 SQL Server ODBC 驱动${NC}"
        echo "   安装命令:"
        echo "   curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -"
        echo "   curl https://packages.microsoft.com/config/ubuntu/20.04/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list"
        echo "   sudo apt update"
        echo "   sudo ACCEPT_EULA=Y apt-get install -y msodbcsql17"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  未安装 unixodbc，无法测试 ODBC 驱动${NC}"
    echo "   安装命令: sudo apt install unixodbc"
fi

# 5. Python 连接测试（如果 .env 存在）
if [ -f .env ]; then
    echo -e "\n${YELLOW}[5/5] 测试 Python 数据库连接...${NC}"
    
    # 检查 pyodbc
    if python3 -c "import pyodbc" 2>/dev/null; then
        # 读取 .env
        source .env
        
        # 创建临时测试脚本
        cat > /tmp/test_db.py << 'PYEOF'
import pyodbc
import os

try:
    server = os.getenv('DB_SERVER', '10.88.43.154')
    database = os.getenv('DB_DATABASE', 'DCCT_BPS_Debug')
    username = os.getenv('DB_USERNAME', 'TEST')
    password = os.getenv('DB_PASSWORD', '123456')
    driver = os.getenv('DB_DRIVER', 'ODBC Driver 17 for SQL Server')
    
    conn_str = f'DRIVER={{{driver}}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
    conn = pyodbc.connect(conn_str, timeout=5)
    cursor = conn.cursor()
    
    # 测试查询
    cursor.execute("SELECT @@VERSION")
    version = cursor.fetchone()[0]
    print(f"✅ 连接成功")
    print(f"   数据库: {database}@{server}")
    print(f"   版本: {version[:50]}...")
    
    # 测试权限
    cursor.execute("SELECT COUNT(*) FROM departments")
    count = cursor.fetchone()[0]
    print(f"   departments 表记录数: {count}")
    
    conn.close()
    exit(0)
except Exception as e:
    print(f"❌ 连接失败: {e}")
    exit(1)
PYEOF
        
        if python3 /tmp/test_db.py 2>&1; then
            echo -e "${GREEN}✅ Python 数据库连接测试通过${NC}"
        else
            echo -e "${RED}❌ Python 数据库连接测试失败${NC}"
            echo "   请检查 .env 文件中的数据库凭证"
        fi
        
        rm /tmp/test_db.py
    else
        echo -e "${YELLOW}⚠️  pyodbc 未安装，跳过 Python 连接测试${NC}"
        echo "   安装命令: pip3 install pyodbc"
    fi
fi

echo ""
echo "=========================================="
echo -e "${GREEN}🎉 连接测试完成！${NC}"
echo "=========================================="
echo ""
echo "测试结果摘要:"
echo "  ✅ 网络连通: 正常"
echo "  ✅ 端口 1433: 可访问"
echo "  ✅ ODBC 驱动: 已安装"
echo ""
echo "下一步: 运行 bash deploy.sh 开始部署"
echo "=========================================="
