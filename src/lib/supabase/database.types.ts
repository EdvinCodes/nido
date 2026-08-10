/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with `pnpm db:types` after every migration. Source of truth: the local
 * Supabase database's `nido` schema. See docs/06-CONVENTIONS.md §4.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  nido: {
    Tables: {
      currencies: {
        Row: {
          code: string
          exponent: number
          name: string
          symbol: string
        }
        Insert: {
          code: string
          exponent?: number
          name: string
          symbol: string
        }
        Update: {
          code?: string
          exponent?: number
          name?: string
          symbol?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate: {
        Args: { p_total: number; p_weights: number[] }
        Returns: number[]
      }
      has_role: {
        Args: {
          p_roles: Database["nido"]["Enums"]["member_role"][]
          p_space_id: string
        }
        Returns: boolean
      }
      is_member: {
        Args: {
          p_roles?: Database["nido"]["Enums"]["member_role"][]
          p_space_id: string
        }
        Returns: boolean
      }
      my_participant_id: { Args: { p_space_id: string }; Returns: string }
    }
    Enums: {
      account_kind:
        | "cash"
        | "bank"
        | "card"
        | "savings"
        | "shared_pot"
        | "other"
      budget_period: "day" | "week" | "month" | "quarter" | "year"
      budget_scope:
        | "space"
        | "participant"
        | "category"
        | "category_participant"
      category_kind: "expense" | "income" | "both"
      goal_status: "active" | "reached" | "paused" | "archived"
      import_status: "draft" | "mapping" | "previewing" | "committed" | "failed"
      member_role: "owner" | "admin" | "member" | "viewer"
      member_status: "active" | "invited" | "left" | "removed"
      notification_kind:
        | "budget_threshold"
        | "budget_exceeded"
        | "recurring_due"
        | "recurring_price_change"
        | "goal_reached"
        | "settlement_request"
        | "settlement_confirmed"
        | "member_joined"
        | "import_finished"
        | "bank_sync_failed"
        | "insight"
      recurrence_freq: "day" | "week" | "month" | "year"
      recurring_kind: "subscription" | "bill" | "income" | "transfer"
      space_kind: "solo" | "couple" | "shared"
      split_mode: "personal" | "equal" | "shares" | "percent" | "exact"
      tx_kind: "expense" | "income" | "transfer"
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
  nido: {
    Enums: {
      account_kind: ["cash", "bank", "card", "savings", "shared_pot", "other"],
      budget_period: ["day", "week", "month", "quarter", "year"],
      budget_scope: [
        "space",
        "participant",
        "category",
        "category_participant",
      ],
      category_kind: ["expense", "income", "both"],
      goal_status: ["active", "reached", "paused", "archived"],
      import_status: ["draft", "mapping", "previewing", "committed", "failed"],
      member_role: ["owner", "admin", "member", "viewer"],
      member_status: ["active", "invited", "left", "removed"],
      notification_kind: [
        "budget_threshold",
        "budget_exceeded",
        "recurring_due",
        "recurring_price_change",
        "goal_reached",
        "settlement_request",
        "settlement_confirmed",
        "member_joined",
        "import_finished",
        "bank_sync_failed",
        "insight",
      ],
      recurrence_freq: ["day", "week", "month", "year"],
      recurring_kind: ["subscription", "bill", "income", "transfer"],
      space_kind: ["solo", "couple", "shared"],
      split_mode: ["personal", "equal", "shares", "percent", "exact"],
      tx_kind: ["expense", "income", "transfer"],
    },
  },
} as const

