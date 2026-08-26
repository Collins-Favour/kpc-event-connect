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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          space_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          space_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          space_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      desk_tokens: {
        Row: {
          created_at: string
          created_by: string
          desk_id: string
          event_id: string
          expires_at: string
          id: string
          revoked_at: string | null
          space_id: string
          status: Database["public"]["Enums"]["token_status"]
          token_hash: string
          token_hint: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          desk_id: string
          event_id: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["token_status"]
          token_hash: string
          token_hint: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          desk_id?: string
          event_id?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["token_status"]
          token_hash?: string
          token_hint?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desk_tokens_desk_id_fkey"
            columns: ["desk_id"]
            isOneToOne: false
            referencedRelation: "registration_desks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_tokens_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          registration_counter: number
          registration_prefix: string
          space_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          registration_counter?: number
          registration_prefix?: string
          space_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          registration_counter?: number
          registration_prefix?: string
          space_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          last_login_at: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          last_login_at?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_login_at?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registration_desks: {
        Row: {
          code: string
          created_at: string
          event_id: string
          id: string
          location: string | null
          name: string
          space_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          event_id: string
          id?: string
          location?: string | null
          name: string
          space_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          event_id?: string
          id?: string
          location?: string | null
          name?: string
          space_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_desks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_desks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_field_values: {
        Row: {
          created_at: string
          field_id: string
          field_key: string
          id: string
          registration_id: string
          space_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_id: string
          field_key: string
          id?: string
          registration_id: string
          space_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string
          field_key?: string
          id?: string
          registration_id?: string
          space_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "registration_template_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_field_values_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_field_values_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_sessions: {
        Row: {
          created_at: string
          desk_id: string
          ended_at: string | null
          event_id: string
          id: string
          last_seen_at: string
          secret_hash: string
          space_id: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          token_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          desk_id: string
          ended_at?: string | null
          event_id: string
          id?: string
          last_seen_at?: string
          secret_hash: string
          space_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          token_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          desk_id?: string
          ended_at?: string | null
          event_id?: string
          id?: string
          last_seen_at?: string
          secret_hash?: string
          space_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          token_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_sessions_desk_id_fkey"
            columns: ["desk_id"]
            isOneToOne: false
            referencedRelation: "registration_desks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_sessions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_sessions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "desk_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_template_fields: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          field_key: string
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          is_primary: boolean
          label: string
          options: Json
          required: boolean
          space_id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          field_key: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_primary?: boolean
          label: string
          options?: Json
          required?: boolean
          space_id: string
          template_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          field_key?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_primary?: boolean
          label?: string
          options?: Json
          required?: boolean
          space_id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_template_fields_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "registration_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_templates: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          space_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name?: string
          space_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_templates_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          created_at: string
          desk_id: string | null
          email: string | null
          event_id: string
          full_name: string
          id: string
          location: string | null
          phone: string | null
          registered_at: string
          registration_number: string
          session_id: string | null
          space_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          desk_id?: string | null
          email?: string | null
          event_id: string
          full_name: string
          id?: string
          location?: string | null
          phone?: string | null
          registered_at?: string
          registration_number: string
          session_id?: string | null
          space_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          desk_id?: string | null
          email?: string | null
          event_id?: string
          full_name?: string
          id?: string
          location?: string | null
          phone?: string | null
          registered_at?: string
          registration_number?: string
          session_id?: string | null
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_desk_id_fkey"
            columns: ["desk_id"]
            isOneToOne: false
            referencedRelation: "registration_desks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "registration_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          message: string
          provider: string
          recipient: string
          sent_at: string | null
          sent_by: string | null
          space_id: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          message: string
          provider?: string
          recipient: string
          sent_at?: string | null
          sent_by?: string | null
          space_id: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string
          provider?: string
          recipient?: string
          sent_at?: string | null
          sent_by?: string | null
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["space_role"]
          space_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["space_role"]
          space_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["space_role"]
          space_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_invitations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["space_role"]
          space_id: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["space_role"]
          space_id: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["space_role"]
          space_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          accent_color: string | null
          category: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          space_type: Database["public"]["Enums"]["space_type"]
          status: Database["public"]["Enums"]["space_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          space_type?: Database["public"]["Enums"]["space_type"]
          status?: Database["public"]["Enums"]["space_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          space_type?: Database["public"]["Enums"]["space_type"]
          status?: Database["public"]["Enums"]["space_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_space_member: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      is_space_super_admin: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      entity_status: "ACTIVE" | "INACTIVE"
      event_status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED"
      field_type:
        | "TEXT"
        | "NUMBER"
        | "EMAIL"
        | "PHONE"
        | "DATE"
        | "SELECT"
        | "MULTISELECT"
        | "CHECKBOX"
        | "RADIO"
      invitation_status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED"
      member_status: "ACTIVE" | "SUSPENDED"
      session_status: "ACTIVE" | "ENDED"
      space_role: "SPACE_ADMIN" | "SPACE_SUPER_ADMIN"
      space_status: "ACTIVE" | "SUSPENDED" | "ARCHIVED"
      space_type: "INDIVIDUAL" | "ORGANIZATION" | "TEAM"
      token_status: "ACTIVE" | "REVOKED" | "EXPIRED"
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
      entity_status: ["ACTIVE", "INACTIVE"],
      event_status: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"],
      field_type: [
        "TEXT",
        "NUMBER",
        "EMAIL",
        "PHONE",
        "DATE",
        "SELECT",
        "MULTISELECT",
        "CHECKBOX",
        "RADIO",
      ],
      invitation_status: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
      member_status: ["ACTIVE", "SUSPENDED"],
      session_status: ["ACTIVE", "ENDED"],
      space_role: ["SPACE_ADMIN", "SPACE_SUPER_ADMIN"],
      space_status: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
      space_type: ["INDIVIDUAL", "ORGANIZATION", "TEAM"],
      token_status: ["ACTIVE", "REVOKED", "EXPIRED"],
    },
  },
} as const
