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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          client_id: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          client_id?: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          client_id?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "app_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          assigned_client_user_id: string | null
          assigned_influencer_id: string
          brief_notes: string
          client_id: string
          created_at: string
          id: string
          is_deleted: boolean
          sla_hours: number
          status: Database["public"]["Enums"]["campaign_status"]
          target_idea_count: number
        }
        Insert: {
          assigned_client_user_id?: string | null
          assigned_influencer_id: string
          brief_notes?: string
          client_id: string
          created_at?: string
          id: string
          is_deleted?: boolean
          sla_hours?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          target_idea_count?: number
        }
        Update: {
          assigned_client_user_id?: string | null
          assigned_influencer_id?: string
          brief_notes?: string
          client_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          sla_hours?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          target_idea_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_assigned_client_user_id_fkey"
            columns: ["assigned_client_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_assigned_influencer_id_fkey"
            columns: ["assigned_influencer_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          notes: string
          phone: string
        }
        Insert: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id: string
          notes?: string
          phone?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string
          phone?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          campaign_id: string
          client_notes: string | null
          created_at: string
          created_by_user_id: string
          description: string
          id: string
          resulting_project_id: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["idea_status"]
          title: string
        }
        Insert: {
          campaign_id: string
          client_notes?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string
          id: string
          resulting_project_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title: string
        }
        Update: {
          campaign_id?: string
          client_notes?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string
          id?: string
          resulting_project_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_resulting_project_id_fkey"
            columns: ["resulting_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id: string
          project_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_client_id: string | null
          assigned_editor_id: string | null
          assigned_influencer_id: string | null
          assigned_kierownik_id: string | null
          assigned_operator_id: string | null
          client_email: string
          client_id: string | null
          client_name: string
          client_phone: string
          company: string
          current_stage_index: number
          id: string
          name: string
          priority: Database["public"]["Enums"]["project_priority"]
          publication_date: string | null
          sla_hours: number | null
          status: Database["public"]["Enums"]["project_status"]
        }
        Insert: {
          assigned_client_id?: string | null
          assigned_editor_id?: string | null
          assigned_influencer_id?: string | null
          assigned_kierownik_id?: string | null
          assigned_operator_id?: string | null
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string
          company?: string
          current_stage_index?: number
          id: string
          name?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          publication_date?: string | null
          sla_hours?: number | null
          status?: Database["public"]["Enums"]["project_status"]
        }
        Update: {
          assigned_client_id?: string | null
          assigned_editor_id?: string | null
          assigned_influencer_id?: string | null
          assigned_kierownik_id?: string | null
          assigned_operator_id?: string | null
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string
          company?: string
          current_stage_index?: number
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          publication_date?: string | null
          sla_hours?: number | null
          status?: Database["public"]["Enums"]["project_status"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_editor_id_fkey"
            columns: ["assigned_editor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_influencer_id_fkey"
            columns: ["assigned_influencer_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_kierownik_id_fkey"
            columns: ["assigned_kierownik_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          created_at: string
          id: string
          note: string
          project_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id: string
          note?: string
          project_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          project_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_at: string | null
          assigned_role: Database["public"]["Enums"]["user_role"]
          assigned_roles: Database["public"]["Enums"]["user_role"][]
          client_feedback: string | null
          completed_at: string | null
          completed_by: string | null
          deadline_date: string | null
          description: string
          history: Json
          id: string
          input_type: Database["public"]["Enums"]["input_type"]
          order: number
          previous_value: string | null
          project_id: string
          role_completions: Json
          status: Database["public"]["Enums"]["task_status"]
          title: string
          value: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_role: Database["public"]["Enums"]["user_role"]
          assigned_roles?: Database["public"]["Enums"]["user_role"][]
          client_feedback?: string | null
          completed_at?: string | null
          completed_by?: string | null
          deadline_date?: string | null
          description?: string
          history?: Json
          id: string
          input_type: Database["public"]["Enums"]["input_type"]
          order: number
          previous_value?: string | null
          project_id: string
          role_completions?: Json
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          value?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_role?: Database["public"]["Enums"]["user_role"]
          assigned_roles?: Database["public"]["Enums"]["user_role"][]
          client_feedback?: string | null
          completed_at?: string | null
          completed_by?: string | null
          deadline_date?: string | null
          description?: string
          history?: Json
          id?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          order?: number
          previous_value?: string | null
          project_id?: string
          role_completions?: Json
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      campaign_status:
        | "awaiting_ideas"
        | "in_review"
        | "completed"
        | "cancelled"
      idea_status:
        | "pending"
        | "accepted"
        | "accepted_with_notes"
        | "saved_for_later"
        | "rejected"
      input_type:
        | "boolean"
        | "text"
        | "url"
        | "approval"
        | "social_descriptions"
        | "social_dates"
        | "publication_confirm"
        | "actor_assignment"
        | "filming_confirmation"
        | "raw_footage"
        | "multi_party_notes"
        | "frameio_review"
        | "script_review"
      project_priority: "low" | "medium" | "high" | "urgent"
      project_status: "active" | "frozen"
      task_status:
        | "locked"
        | "todo"
        | "done"
        | "pending_client_approval"
        | "needs_influencer_revision"
        | "deferred"
        | "rejected_final"
      user_role:
        | "admin"
        | "klient"
        | "influencer"
        | "montazysta"
        | "kierownik_planu"
        | "operator"
        | "publikator"
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
    Enums: {
      campaign_status: [
        "awaiting_ideas",
        "in_review",
        "completed",
        "cancelled",
      ],
      idea_status: [
        "pending",
        "accepted",
        "accepted_with_notes",
        "saved_for_later",
        "rejected",
      ],
      input_type: [
        "boolean",
        "text",
        "url",
        "approval",
        "social_descriptions",
        "social_dates",
        "publication_confirm",
        "actor_assignment",
        "filming_confirmation",
        "raw_footage",
        "multi_party_notes",
        "frameio_review",
        "script_review",
      ],
      project_priority: ["low", "medium", "high", "urgent"],
      project_status: ["active", "frozen"],
      task_status: [
        "locked",
        "todo",
        "done",
        "pending_client_approval",
        "needs_influencer_revision",
        "deferred",
        "rejected_final",
      ],
      user_role: [
        "admin",
        "klient",
        "influencer",
        "montazysta",
        "kierownik_planu",
        "operator",
        "publikator",
      ],
    },
  },
} as const
