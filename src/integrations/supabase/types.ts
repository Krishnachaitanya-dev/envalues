export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          owner_id: string
          request_id: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          owner_id: string
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          owner_id?: string
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      chatbots: {
        Row: {
          chatbot_name: string
          created_at: string | null
          farewell_message: string
          greeting_message: string
          id: string
          is_active: boolean | null
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          chatbot_name: string
          created_at?: string | null
          farewell_message?: string
          greeting_message?: string
          id?: string
          is_active?: boolean | null
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          chatbot_name?: string
          created_at?: string | null
          farewell_message?: string
          greeting_message?: string
          id?: string
          is_active?: boolean | null
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbots_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          chatbot_id: string
          created_at: string | null
          current_question_id: string | null
          customer_phone_number: string
          id: string
          last_activity_at: string | null
          session_state: string | null
        }
        Insert: {
          chatbot_id: string
          created_at?: string | null
          current_question_id?: string | null
          customer_phone_number: string
          id?: string
          last_activity_at?: string | null
          session_state?: string | null
        }
        Update: {
          chatbot_id?: string
          created_at?: string | null
          current_question_id?: string | null
          customer_phone_number?: string
          id?: string
          last_activity_at?: string | null
          session_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sessions_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "qa_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          onboarding_completed: boolean | null
          password_hash: string
          updated_at: string | null
          whatsapp_api_token: string | null
          whatsapp_business_number: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          onboarding_completed?: boolean | null
          password_hash: string
          updated_at?: string | null
          whatsapp_api_token?: string | null
          whatsapp_business_number: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          onboarding_completed?: boolean | null
          password_hash?: string
          updated_at?: string | null
          whatsapp_api_token?: string | null
          whatsapp_business_number?: string
        }
        Relationships: []
      }
      qa_pairs: {
        Row: {
          answer_text: string
          chatbot_id: string
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean | null
          is_main_question: boolean | null
          parent_question_id: string | null
          question_text: string
          updated_at: string | null
        }
        Insert: {
          answer_text: string
          chatbot_id: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          is_main_question?: boolean | null
          parent_question_id?: string | null
          question_text: string
          updated_at?: string | null
        }
        Update: {
          answer_text?: string
          chatbot_id?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          is_main_question?: boolean | null
          parent_question_id?: string | null
          question_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_pairs_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_pairs_parent_question_id_fkey"
            columns: ["parent_question_id"]
            isOneToOne: false
            referencedRelation: "qa_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          owner_id: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          owner_id: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          owner_id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          owner_id: string | null
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          owner_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          owner_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          chatbot_id: string
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          owner_id: string
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          chatbot_id: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          owner_id: string
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          chatbot_id?: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          owner_id?: string
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: true
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
