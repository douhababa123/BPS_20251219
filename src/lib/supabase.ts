import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// 从环境变量获取Supabase配置（如果.env未生效，使用默认值）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wpbgzcmpwsktoaowwkpj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required variables:\n' +
    '- VITE_SUPABASE_URL\n' +
    '- VITE_SUPABASE_ANON_KEY'
  );
}

// 创建Supabase客户端实例
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // 关闭会话持久化（不需要用户认证）
  },
});

// 导出类型，方便在其他文件中使用
export type { Database };
