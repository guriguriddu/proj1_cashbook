export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          amount: number;
          merchant: string;
          category_id: string;
          memo: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          amount: number;
          merchant: string;
          category_id: string;
          memo?: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          amount?: number;
          merchant?: string;
          category_id?: string;
          memo?: string;
          source?: string;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          name: string;
          icon: string;
          color: string;
          keywords: string[];
          sort_order: number;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          name: string;
          icon: string;
          color: string;
          keywords?: string[];
          sort_order?: number;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          name?: string;
          icon?: string;
          color?: string;
          keywords?: string[];
          sort_order?: number;
          is_default?: boolean;
          created_at?: string;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          annual: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          annual: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          annual?: number;
          created_at?: string;
        };
      };
      monthly_budgets: {
        Row: {
          id: string;
          budget_id: string;
          month: string;
          amount: number;
        };
        Insert: {
          id?: string;
          budget_id: string;
          month: string;
          amount: number;
        };
        Update: {
          id?: string;
          budget_id?: string;
          month?: string;
          amount?: number;
        };
      };
      category_budgets: {
        Row: {
          id: string;
          budget_id: string;
          category_id: string;
          amount: number;
          month: string | null;
        };
        Insert: {
          id?: string;
          budget_id: string;
          category_id: string;
          amount: number;
          month?: string | null;
        };
        Update: {
          id?: string;
          budget_id?: string;
          category_id?: string;
          amount?: number;
          month?: string | null;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          home_category_order: string[];
          monthly_income: number;
          monthly_fixed_expense: number;
          current_assets: number;
          goal_amount: number;
          goal_months: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          home_category_order?: string[];
          monthly_income?: number;
          monthly_fixed_expense?: number;
          current_assets?: number;
          goal_amount?: number;
          goal_months?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          home_category_order?: string[];
          monthly_income?: number;
          monthly_fixed_expense?: number;
          current_assets?: number;
          goal_amount?: number;
          goal_months?: number;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
