// 数据库类型定义
// 这些类型与Supabase数据库表结构对应

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      competency_definitions: {
        Row: {
          id: number
          module_id: number
          module_name: string
          competency_type: string
          competency_code: string | null
          description: string | null
          owner_engineer: string | null
          is_key_competency: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          module_id: number
          module_name: string
          competency_type: string
          competency_code?: string | null
          description?: string | null
          owner_engineer?: string | null
          is_key_competency?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          module_id?: number
          module_name?: string
          competency_type?: string
          competency_code?: string | null
          description?: string | null
          owner_engineer?: string | null
          is_key_competency?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      competency_assessments: {
        Row: {
          id: number
          engineer_id: string
          engineer_name: string
          department: string
          competency_id: number | null
          module_name: string
          competency_type: string
          current_score: number
          target_score: number
          gap: number
          assessment_year: number
          assessment_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          engineer_id: string
          engineer_name: string
          department: string
          competency_id?: number | null
          module_name: string
          competency_type: string
          current_score: number
          target_score: number
          assessment_year: number
          assessment_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          engineer_id?: string
          engineer_name?: string
          department?: string
          competency_id?: number | null
          module_name?: string
          competency_type?: string
          current_score?: number
          target_score?: number
          assessment_year?: number
          assessment_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
