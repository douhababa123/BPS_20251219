"""
快速测试能力评估API端点
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

def test_endpoint(name, url):
    """测试单个API端点"""
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"URL: {url}")
    print(f"{'='*60}")
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        count = len(data) if isinstance(data, list) else 1
        
        print(f"✅ 成功! 状态码: {response.status_code}")
        print(f"📊 数据数量: {count}")
        
        if isinstance(data, list) and len(data) > 0:
            print(f"\n前3条记录示例:")
            for i, item in enumerate(data[:3], 1):
                print(f"\n  记录 {i}:")
                # 只显示前几个关键字段
                for key, value in list(item.items())[:5]:
                    if isinstance(value, str) and len(value) > 50:
                        value = value[:50] + "..."
                    print(f"    {key}: {value}")
        
        return True, count
        
    except requests.exceptions.Timeout:
        print(f"❌ 超时! 后端服务可能未运行")
        return False, 0
    except requests.exceptions.ConnectionError:
        print(f"❌ 连接错误! 请确认后端服务正在运行在 http://localhost:8000")
        return False, 0
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP错误: {e}")
        print(f"响应: {response.text[:200]}")
        return False, 0
    except Exception as e:
        print(f"❌ 错误: {str(e)}")
        return False, 0

def main():
    print("\n" + "="*60)
    print("🚀 能力评估API测试脚本")
    print(f"⏰ 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    # 测试各个端点
    results = {}
    
    # 1. 测试能力评估端点
    success, count = test_endpoint(
        "能力评估列表",
        f"{BASE_URL}/competency-assessments"
    )
    results['competency-assessments'] = {'success': success, 'count': count}
    
    # 2. 测试员工端点
    success, count = test_endpoint(
        "员工列表",
        f"{BASE_URL}/employees"
    )
    results['employees'] = {'success': success, 'count': count}
    
    # 3. 测试技能端点
    success, count = test_endpoint(
        "技能列表",
        f"{BASE_URL}/matching/skills"
    )
    results['skills'] = {'success': success, 'count': count}
    
    # 4. 测试部门端点
    success, count = test_endpoint(
        "部门列表",
        f"{BASE_URL}/departments"
    )
    results['departments'] = {'success': success, 'count': count}
    
    # 5. 测试健康检查
    success, _ = test_endpoint(
        "健康检查",
        f"{BASE_URL}/health"
    )
    results['health'] = {'success': success}
    
    # 汇总结果
    print(f"\n\n{'='*60}")
    print("📊 测试结果汇总")
    print(f"{'='*60}")
    
    all_success = all(r['success'] for r in results.values())
    
    for endpoint, result in results.items():
        status = "✅" if result['success'] else "❌"
        count_str = f" ({result['count']} 条)" if 'count' in result else ""
        print(f"{status} {endpoint}{count_str}")
    
    print(f"\n{'='*60}")
    if all_success:
        print("🎉 所有测试通过! API工作正常")
        print("\n✅ 可以启动前端进行测试:")
        print("   cd C:\\Users\\DOC2CHZ\\Software\\BPS_20251219")
        print("   npm run dev")
        print("\n📝 然后访问: http://localhost:5173")
        print("   导航到「能力评估」页面查看数据")
    else:
        print("⚠️ 部分测试失败，请检查:")
        print("   1. 后端服务是否正在运行")
        print("   2. 数据库连接是否正常")
        print("   3. 查看后端日志获取详细错误信息")
    print(f"{'='*60}\n")
    
    return all_success

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ 测试被用户中断")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ 测试脚本错误: {str(e)}")
        exit(1)
