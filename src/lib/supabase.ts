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
    persistSession: true, // 启用会话持久化（支持"记住我"功能）
    autoRefreshToken: true, // 自动刷新 Token
    detectSessionInUrl: false, // 不从 URL 检测会话（使用 OTP）
    storage: typeof window !== 'undefined' ? window.localStorage : undefined, // 使用 localStorage 存储会话
  },
});

// 导出类型，方便在其他文件中使用
export type { Database };
