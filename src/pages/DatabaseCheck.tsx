import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 数据库诊断页面 - 用于检查Supabase连接和数据状态
 */
export default function DatabaseCheck() {
  const [results, setResults] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkDatabase = async () => {
    setIsChecking(true);
    const checkResults: any = {
      timestamp: new Date().toISOString(),
      connection: null,
      tables: {},
      errors: [],
    };

    try {
      // 1. 测试连接
      console.log('🔍 1. 测试Supabase连接...');
      checkResults.connection = {
        url: import.meta.env.VITE_SUPABASE_URL,
        keyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
        status: 'unknown',
      };

      // 2. 检查 departments 表
      console.log('🔍 2. 检查 departments 表...');
      try {
        const { data, error, count } = await supabase
          .from('departments')
          .select('*', { count: 'exact' });
        
        if (error) throw error;
        
        checkResults.tables.departments = {
          status: 'success',
          count: count || 0,
          sample: data?.slice(0, 3),
        };
        console.log('✅ departments:', count, '条记录');
      } catch (err: any) {
        console.error('❌ departments 失败:', err);
        checkResults.tables.departments = {
          status: 'error',
          error: err.message,
        };
        checkResults.errors.push(`departments: ${err.message}`);
      }

      // 3. 检查 employees 表
      console.log('🔍 3. 检查 employees 表...');
      try {
        const { data, error, count } = await supabase
          .from('employees')
          .select('*', { count: 'exact' })
          .eq('is_active', true);
        
        if (error) throw error;
        
        checkResults.tables.employees = {
          status: 'success',
          count: count || 0,
          sample: data?.slice(0, 3),
        };
        console.log('✅ employees:', count, '条记录');
      } catch (err: any) {
        console.error('❌ employees 失败:', err);
        checkResults.tables.employees = {
          status: 'error',
          error: err.message,
        };
        checkResults.errors.push(`employees: ${err.message}`);
      }

      // 4. 检查 skills 表
      console.log('🔍 4. 检查 skills 表...');
      try {
        const { data, error, count } = await supabase
          .from('skills')
          .select('*', { count: 'exact' })
          .eq('is_active', true);
        
        if (error) throw error;
        
        checkResults.tables.skills = {
          status: 'success',
          count: count || 0,
          sample: data?.slice(0, 3),
        };
        console.log('✅ skills:', count, '条记录');
      } catch (err: any) {
        console.error('❌ skills 失败:', err);
        checkResults.tables.skills = {
          status: 'error',
          error: err.message,
        };
        checkResults.errors.push(`skills: ${err.message}`);
      }

      // 5. 检查 competency_assessments 表
      console.log('🔍 5. 检查 competency_assessments 表...');
      try {
        const { data, error, count } = await supabase
          .from('competency_assessments')
          .select('*', { count: 'exact' });
        
        if (error) throw error;
        
        checkResults.tables.competency_assessments = {
          status: 'success',
          count: count || 0,
          sample: data?.slice(0, 3),
        };
        console.log('✅ competency_assessments:', count, '条记录');
      } catch (err: any) {
        console.error('❌ competency_assessments 失败:', err);
        checkResults.tables.competency_assessments = {
          status: 'error',
          error: err.message,
        };
        checkResults.errors.push(`competency_assessments: ${err.message}`);
      }

      // 6. 测试关联查询
      console.log('🔍 6. 测试关联查询（employees + departments）...');
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, departments(name)')
          .eq('is_active', true)
          .limit(1);
        
        if (error) throw error;
        
        checkResults.tables.join_test = {
          status: 'success',
          sample: data?.[0],
        };
        console.log('✅ 关联查询成功');
      } catch (err: any) {
        console.error('❌ 关联查询失败:', err);
        checkResults.tables.join_test = {
          status: 'error',
          error: err.message,
        };
        checkResults.errors.push(`JOIN查询: ${err.message}`);
      }

      // 最终状态
      if (checkResults.errors.length === 0) {
        checkResults.connection.status = 'success';
        console.log('✅ 所有检查通过！');
      } else {
        checkResults.connection.status = 'partial';
        console.log('⚠️ 部分检查失败');
      }

    } catch (err: any) {
      console.error('❌ 检查过程失败:', err);
      checkResults.connection.status = 'error';
      checkResults.errors.push(`全局错误: ${err.message}`);
    }

    setResults(checkResults);
    setIsChecking(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔍 数据库诊断工具</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <button
            onClick={checkDatabase}
            disabled={isChecking}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium"
          >
            {isChecking ? '🔄 检查中...' : '🚀 开始检查'}
          </button>
        </div>

        {results && (
          <div className="space-y-6">
            {/* 连接状态 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📡 连接状态</h2>
              <div className="space-y-2 font-mono text-sm">
                <div>
                  <span className="text-gray-600">URL:</span>{' '}
                  <span className="text-blue-600">{results.connection.url || '未设置'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Key:</span>{' '}
                  <span className="text-blue-600">{results.connection.keyPrefix || '未设置'}</span>
                </div>
                <div>
                  <span className="text-gray-600">状态:</span>{' '}
                  <span className={
                    results.connection.status === 'success' ? 'text-green-600' :
                    results.connection.status === 'partial' ? 'text-yellow-600' :
                    'text-red-600'
                  }>
                    {results.connection.status === 'success' ? '✅ 正常' :
                     results.connection.status === 'partial' ? '⚠️ 部分失败' :
                     '❌ 失败'}
                  </span>
                </div>
              </div>
            </div>

            {/* 表状态 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📊 数据表状态</h2>
              <div className="space-y-4">
                {Object.entries(results.tables).map(([tableName, tableData]: [string, any]) => (
                  <div key={tableName} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold">{tableName}</h3>
                      <span className={
                        tableData.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }>
                        {tableData.status === 'success' ? '✅' : '❌'}
                      </span>
                    </div>
                    
                    {tableData.status === 'success' ? (
                      <div className="text-sm text-gray-600">
                        <div>记录数: <span className="font-bold">{tableData.count}</span></div>
                        {tableData.sample && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-blue-600">查看样例数据</summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                              {JSON.stringify(tableData.sample, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-red-600">
                        错误: {tableData.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 错误汇总 */}
            {results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-red-800 mb-4">❌ 错误汇总</h2>
                <ul className="space-y-2 text-sm text-red-700">
                  {results.errors.map((error: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 成功提示 */}
            {results.errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-green-800 mb-2">✅ 所有检查通过！</h2>
                <p className="text-sm text-green-700">
                  数据库连接正常，所有表都可以正常访问。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
