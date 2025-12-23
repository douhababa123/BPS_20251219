import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DebugPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const runTests = async () => {
    setTesting(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      env: {},
      connection: {},
      queries: {},
    };

    // 1. 检查环境变量
    console.log('=== 1. 检查环境变量 ===');
    results.env = {
      url: import.meta.env.VITE_SUPABASE_URL,
      keyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 30) + '...',
      mode: import.meta.env.MODE,
      dev: import.meta.env.DEV,
    };
    console.log('环境变量:', results.env);

    // 2. 测试Supabase客户端
    console.log('=== 2. 测试Supabase客户端 ===');
    try {
      // @ts-ignore
      const supabaseUrl = supabase.supabaseUrl;
      // @ts-ignore
      const supabaseKey = supabase.supabaseKey;
      
      results.connection = {
        url: supabaseUrl,
        keyPrefix: supabaseKey?.substring(0, 30) + '...',
        clientExists: !!supabase,
      };
      console.log('Supabase客户端:', results.connection);
    } catch (err) {
      console.error('获取客户端信息失败:', err);
      results.connection = { error: String(err) };
    }

    // 3. 测试简单查询
    console.log('=== 3. 测试departments表 ===');
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('❌ departments查询失败:', error);
        results.queries.departments = { 
          success: false, 
          error: error.message,
          details: error 
        };
      } else {
        console.log('✅ departments查询成功:', data);
        results.queries.departments = { 
          success: true, 
          count: data?.length || 0,
          sample: data?.[0]
        };
      }
    } catch (err: any) {
      console.error('❌ departments查询异常:', err);
      results.queries.departments = { 
        success: false, 
        error: err.message,
        type: err.constructor.name
      };
    }

    // 4. 测试employees表
    console.log('=== 4. 测试employees表 ===');
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('❌ employees查询失败:', error);
        results.queries.employees = { 
          success: false, 
          error: error.message,
          details: error 
        };
      } else {
        console.log('✅ employees查询成功:', data);
        results.queries.employees = { 
          success: true, 
          count: data?.length || 0,
          sample: data?.[0]
        };
      }
    } catch (err: any) {
      console.error('❌ employees查询异常:', err);
      results.queries.employees = { 
        success: false, 
        error: err.message,
        type: err.constructor.name
      };
    }

    // 5. 测试skills表
    console.log('=== 5. 测试skills表 ===');
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('❌ skills查询失败:', error);
        results.queries.skills = { 
          success: false, 
          error: error.message,
          details: error 
        };
      } else {
        console.log('✅ skills查询成功:', data);
        results.queries.skills = { 
          success: true, 
          count: data?.length || 0,
          sample: data?.[0]
        };
      }
    } catch (err: any) {
      console.error('❌ skills查询异常:', err);
      results.queries.skills = { 
        success: false, 
        error: err.message,
        type: err.constructor.name
      };
    }

    setTestResults(results);
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🔧 Supabase连接诊断</h1>
        <p className="text-gray-400 mb-8">检查环境变量和数据库连接</p>

        {/* 环境变量显示 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">📋 环境变量</h2>
          <div className="font-mono text-sm space-y-2">
            <div className="flex">
              <span className="text-gray-400 w-40">VITE_SUPABASE_URL:</span>
              <span className="text-green-400">{import.meta.env.VITE_SUPABASE_URL || '❌ 未设置'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-400 w-40">VITE_SUPABASE_ANON_KEY:</span>
              <span className="text-green-400">
                {import.meta.env.VITE_SUPABASE_ANON_KEY 
                  ? import.meta.env.VITE_SUPABASE_ANON_KEY.substring(0, 30) + '...' 
                  : '❌ 未设置'}
              </span>
            </div>
            <div className="flex">
              <span className="text-gray-400 w-40">MODE:</span>
              <span className="text-blue-400">{import.meta.env.MODE}</span>
            </div>
            <div className="flex">
              <span className="text-gray-400 w-40">DEV:</span>
              <span className="text-blue-400">{String(import.meta.env.DEV)}</span>
            </div>
          </div>
        </div>

        {/* 测试按钮 */}
        <button
          onClick={runTests}
          disabled={testing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg mb-6 text-lg"
        >
          {testing ? '🔄 测试中...' : '🚀 开始测试连接'}
        </button>

        {/* 测试结果 */}
        {testResults && (
          <div className="space-y-6">
            {/* 连接信息 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">📡 连接信息</h2>
              <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-sm">
                {JSON.stringify(testResults.connection, null, 2)}
              </pre>
            </div>

            {/* 查询结果 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">🔍 查询测试结果</h2>
              <div className="space-y-4">
                {Object.entries(testResults.queries).map(([table, result]: [string, any]) => (
                  <div key={table} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg">{table}</h3>
                      <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                        {result.success ? '✅ 成功' : '❌ 失败'}
                      </span>
                    </div>
                    {result.success ? (
                      <div className="text-sm text-gray-400">
                        <div>记录数: {result.count}</div>
                        {result.sample && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-blue-400">查看样例</summary>
                            <pre className="mt-2 bg-gray-900 p-2 rounded text-xs overflow-x-auto">
                              {JSON.stringify(result.sample, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-red-400">
                        <div>错误: {result.error}</div>
                        {result.details && (
                          <details className="mt-2">
                            <summary className="cursor-pointer">查看详情</summary>
                            <pre className="mt-2 bg-gray-900 p-2 rounded text-xs overflow-x-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 完整结果 */}
            <details className="bg-gray-800 rounded-lg p-6">
              <summary className="cursor-pointer text-xl font-bold mb-4">📄 完整测试结果（JSON）</summary>
              <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-xs">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* 诊断建议 */}
        <div className="mt-8 bg-yellow-900 border border-yellow-700 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">💡 诊断步骤</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li><strong>检查环境变量</strong>：上面应该显示完整的URL和Key前缀</li>
            <li><strong>如果环境变量显示"未设置"</strong>：
              <ul className="ml-6 mt-1 space-y-1">
                <li>• 确认项目根目录有 .env 文件</li>
                <li>• <strong className="text-yellow-300">重启开发服务器</strong>（Ctrl+C 然后 npm run dev）</li>
                <li>• 强制刷新浏览器（Ctrl+Shift+R）</li>
              </ul>
            </li>
            <li><strong>如果查询失败显示"NetworkError"</strong>：
              <ul className="ml-6 mt-1 space-y-1">
                <li>• 检查网络连接</li>
                <li>• 检查是否使用了VPN或代理</li>
                <li>• 在浏览器Network标签查看请求详情</li>
              </ul>
            </li>
            <li><strong>如果查询失败但有具体错误信息</strong>：
              <ul className="ml-6 mt-1 space-y-1">
                <li>• 可能是RLS策略问题</li>
                <li>• 可能是Key权限不足</li>
                <li>• 查看Supabase后台的Auth设置</li>
              </ul>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
