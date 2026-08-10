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
      accounts: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          currency: string
          icon: string
          id: string
          include_in_totals: boolean
          kind: Database["nido"]["Enums"]["account_kind"]
          name: string
          opening_balance_minor: number
          owner_participant_id: string | null
          position: number
          space_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          currency: string
          icon?: string
          id?: string
          include_in_totals?: boolean
          kind?: Database["nido"]["Enums"]["account_kind"]
          name: string
          opening_balance_minor?: number
          owner_participant_id?: string | null
          position?: number
          space_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          currency?: string
          icon?: string
          id?: string
          include_in_totals?: boolean
          kind?: Database["nido"]["Enums"]["account_kind"]
          name?: string
          opening_balance_minor?: number
          owner_participant_id?: string | null
          position?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounts_owner_participant_id_fkey"
            columns: ["owner_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string
          id: number
          space_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id: string
          id?: never
          space_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string
          id?: never
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_periods: {
        Row: {
          budget_id: string
          ends_on: string
          id: string
          limit_minor: number
          notified: number[]
          space_id: string
          spent_minor: number
          starts_on: string
        }
        Insert: {
          budget_id: string
          ends_on: string
          id?: string
          limit_minor: number
          notified?: number[]
          space_id: string
          spent_minor?: number
          starts_on: string
        }
        Update: {
          budget_id?: string
          ends_on?: string
          id?: string
          limit_minor?: number
          notified?: number[]
          space_id?: string
          spent_minor?: number
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_periods_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_periods_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          alert_thresholds: number[]
          category_id: string | null
          created_at: string
          created_by: string
          currency: string
          ends_on: string | null
          id: string
          include_subcategories: boolean
          is_active: boolean
          limit_minor: number
          name: string
          participant_id: string | null
          period: Database["nido"]["Enums"]["budget_period"]
          rollover: boolean
          scope: Database["nido"]["Enums"]["budget_scope"]
          space_id: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          alert_thresholds?: number[]
          category_id?: string | null
          created_at?: string
          created_by: string
          currency: string
          ends_on?: string | null
          id?: string
          include_subcategories?: boolean
          is_active?: boolean
          limit_minor: number
          name: string
          participant_id?: string | null
          period?: Database["nido"]["Enums"]["budget_period"]
          rollover?: boolean
          scope: Database["nido"]["Enums"]["budget_scope"]
          space_id: string
          starts_on?: string
          updated_at?: string
        }
        Update: {
          alert_thresholds?: number[]
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          ends_on?: string | null
          id?: string
          include_subcategories?: boolean
          is_active?: boolean
          limit_minor?: number
          name?: string
          participant_id?: string | null
          period?: Database["nido"]["Enums"]["budget_period"]
          rollover?: boolean
          scope?: Database["nido"]["Enums"]["budget_scope"]
          space_id?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          icon: string
          id: string
          is_system: boolean
          kind: Database["nido"]["Enums"]["category_kind"]
          name: string
          parent_id: string | null
          position: number
          space_id: string
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          kind?: Database["nido"]["Enums"]["category_kind"]
          name: string
          parent_id?: string | null
          position?: number
          space_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          kind?: Database["nido"]["Enums"]["category_kind"]
          name?: string
          parent_id?: string | null
          position?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
      idempotency_keys: {
        Row: {
          action: string
          created_at: string
          id: string
          request_id: string
          result: Json
          space_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          request_id: string
          result: Json
          space_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          request_id?: string
          result?: Json
          space_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          in_app: boolean
          kind: Database["nido"]["Enums"]["notification_kind"]
          push: boolean
          space_id: string
          user_id: string
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          kind: Database["nido"]["Enums"]["notification_kind"]
          push?: boolean
          space_id: string
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          kind?: Database["nido"]["Enums"]["notification_kind"]
          push?: boolean
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["nido"]["Enums"]["notification_kind"]
          link: string | null
          payload: Json
          read_at: string | null
          space_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: Database["nido"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json
          read_at?: string | null
          space_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["nido"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json
          read_at?: string | null
          space_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          avatar_url: string | null
          color: string
          created_at: string
          default_weight: number
          display_name: string
          id: string
          is_active: boolean
          position: number
          space_id: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          default_weight?: number
          display_name: string
          id?: string
          is_active?: boolean
          position?: number
          space_id: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          default_weight?: number
          display_name?: string
          id?: string
          is_active?: boolean
          position?: number
          space_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          colourblind_safe: boolean
          created_at: string
          default_period_from: string | null
          default_period_preset: string
          default_period_to: string | null
          display_name: string
          id: string
          last_active_space_id: string | null
          locale: string
          theme: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          colourblind_safe?: boolean
          created_at?: string
          default_period_from?: string | null
          default_period_preset?: string
          default_period_to?: string | null
          display_name: string
          id: string
          last_active_space_id?: string | null
          locale?: string
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          colourblind_safe?: boolean
          created_at?: string
          default_period_from?: string | null
          default_period_preset?: string
          default_period_to?: string | null
          display_name?: string
          id?: string
          last_active_space_id?: string | null
          locale?: string
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_active_space_id_fkey"
            columns: ["last_active_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          participant_id: string | null
          revoked_at: string | null
          role: Database["nido"]["Enums"]["member_role"]
          space_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          participant_id?: string | null
          revoked_at?: string | null
          role?: Database["nido"]["Enums"]["member_role"]
          space_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          participant_id?: string | null
          revoked_at?: string | null
          role?: Database["nido"]["Enums"]["member_role"]
          space_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invitations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
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
          joined_at: string
          participant_id: string
          role: Database["nido"]["Enums"]["member_role"]
          space_id: string
          status: Database["nido"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          participant_id: string
          role?: Database["nido"]["Enums"]["member_role"]
          space_id: string
          status?: Database["nido"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          joined_at?: string
          participant_id?: string
          role?: Database["nido"]["Enums"]["member_role"]
          space_id?: string
          status?: Database["nido"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          archived_at: string | null
          base_currency: string
          created_at: string
          created_by: string
          id: string
          kind: Database["nido"]["Enums"]["space_kind"]
          month_starts_on: number
          name: string
          settings: Json
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          archived_at?: string | null
          base_currency?: string
          created_at?: string
          created_by: string
          id?: string
          kind?: Database["nido"]["Enums"]["space_kind"]
          month_starts_on?: number
          name: string
          settings?: Json
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          archived_at?: string | null
          base_currency?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["nido"]["Enums"]["space_kind"]
          month_starts_on?: number
          name?: string
          settings?: Json
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: [
          {
            foreignKeyName: "spaces_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "spaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          space_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          space_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_splits: {
        Row: {
          base_owed_minor: number
          id: string
          owed_minor: number
          participant_id: string
          space_id: string
          transaction_id: string
          weight: number
        }
        Insert: {
          base_owed_minor: number
          id?: string
          owed_minor: number
          participant_id: string
          space_id: string
          transaction_id: string
          weight?: number
        }
        Update: {
          base_owed_minor?: number
          id?: string
          owed_minor?: number
          participant_id?: string
          space_id?: string
          transaction_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_splits_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          space_id: string
          tag_id: string
          transaction_id: string
        }
        Insert: {
          space_id: string
          tag_id: string
          transaction_id: string
        }
        Update: {
          space_id?: string
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount_minor: number
          base_amount_minor: number
          base_rate: number
          booked_on: string
          category_id: string | null
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          description: string
          external_id: string | null
          id: string
          is_pending: boolean
          kind: Database["nido"]["Enums"]["tx_kind"]
          merchant: string | null
          notes: string | null
          occurred_at: string | null
          payer_participant_id: string | null
          space_id: string
          split_mode: Database["nido"]["Enums"]["split_mode"]
          to_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_minor: number
          base_amount_minor: number
          base_rate?: number
          booked_on: string
          category_id?: string | null
          created_at?: string
          created_by: string
          currency: string
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          id?: string
          is_pending?: boolean
          kind: Database["nido"]["Enums"]["tx_kind"]
          merchant?: string | null
          notes?: string | null
          occurred_at?: string | null
          payer_participant_id?: string | null
          space_id: string
          split_mode?: Database["nido"]["Enums"]["split_mode"]
          to_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_minor?: number
          base_amount_minor?: number
          base_rate?: number
          booked_on?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          description?: string
          external_id?: string | null
          id?: string
          is_pending?: boolean
          kind?: Database["nido"]["Enums"]["tx_kind"]
          merchant?: string | null
          notes?: string | null
          occurred_at?: string | null
          payer_participant_id?: string | null
          space_id?: string
          split_mode?: Database["nido"]["Enums"]["split_mode"]
          to_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_payer_participant_id_fkey"
            columns: ["payer_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_transactions: {
        Row: {
          account_color: string | null
          account_id: string | null
          account_name: string | null
          amount_minor: number | null
          base_amount_minor: number | null
          base_rate: number | null
          booked_on: string | null
          category_color: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          external_id: string | null
          id: string | null
          is_pending: boolean | null
          kind: Database["nido"]["Enums"]["tx_kind"] | null
          merchant: string | null
          notes: string | null
          occurred_at: string | null
          payer_avatar_url: string | null
          payer_color: string | null
          payer_name: string | null
          payer_participant_id: string | null
          space_id: string | null
          split_mode: Database["nido"]["Enums"]["split_mode"] | null
          splits: Json | null
          tags: Json | null
          to_account_id: string | null
          to_account_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_payer_participant_id_fkey"
            columns: ["payer_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _assert_contributor: { Args: { p_space_id: string }; Returns: string }
      _can_mutate_transaction: {
        Args: { p_tx: Database["nido"]["Tables"]["transactions"]["Row"] }
        Returns: boolean
      }
      _insert_splits: {
        Args: {
          p_amount_minor: number
          p_base_amount_minor: number
          p_base_rate: number
          p_participants: Json
          p_space_id: string
          p_split_mode: Database["nido"]["Enums"]["split_mode"]
          p_tx_id: string
        }
        Returns: undefined
      }
      _set_transaction_tags: {
        Args: { p_space_id: string; p_tag_ids: string[]; p_tx_id: string }
        Returns: undefined
      }
      accept_invitation: { Args: { p_token: string }; Returns: string }
      account_balance: { Args: { p_account_id: string }; Returns: number }
      allocate: {
        Args: { p_total: number; p_weights: number[] }
        Returns: number[]
      }
      budget_category_ids: {
        Args: { p_budget: Database["nido"]["Tables"]["budgets"]["Row"] }
        Returns: string[]
      }
      compute_budget_spent: {
        Args: { p_budget_id: string; p_from: string; p_to: string }
        Returns: number
      }
      create_space: {
        Args: {
          p_category_keys?: string[]
          p_currency: unknown
          p_kind: Database["nido"]["Enums"]["space_kind"]
          p_month_starts_on?: number
          p_name: string
          p_participants?: Json
          p_timezone: string
          p_week_starts_on?: number
        }
        Returns: string
      }
      create_transaction: { Args: { p: Json }; Returns: Json }
      delete_transaction: {
        Args: { p_id: string; p_request_id?: string }
        Returns: Json
      }
      ensure_budget_periods: {
        Args: { p_budget_id: string; p_through: string }
        Returns: number
      }
      ensure_default_notification_prefs: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      evaluate_budget_thresholds: {
        Args: { p_period_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          p_roles: Database["nido"]["Enums"]["member_role"][]
          p_space_id: string
        }
        Returns: boolean
      }
      hash_invite_token: { Args: { p_token: string }; Returns: string }
      household_month_start: {
        Args: { p_date: string; p_month_starts_on: number }
        Returns: string
      }
      is_member: {
        Args: {
          p_roles?: Database["nido"]["Enums"]["member_role"][]
          p_space_id: string
        }
        Returns: boolean
      }
      my_participant_id: { Args: { p_space_id: string }; Returns: string }
      period_bounds: {
        Args: {
          p_month_starts_on: number
          p_period: Database["nido"]["Enums"]["budget_period"]
          p_reference: string
          p_week_starts_on: number
        }
        Returns: {
          ends_on: string
          starts_on: string
        }[]
      }
      recompute_budget_period: {
        Args: { p_period_id: string }
        Returns: number
      }
      reconcile_open_budget_periods: {
        Args: never
        Returns: {
          after_minor: number
          before_minor: number
          budget_id: string
          period_id: string
        }[]
      }
      refresh_budgets_for_transaction: {
        Args: {
          p_booked_on: string
          p_category_id: string
          p_old_booked_on?: string
          p_old_category_id?: string
          p_space_id: string
        }
        Returns: undefined
      }
      refresh_rollover_limits: {
        Args: { p_budget_id: string }
        Returns: undefined
      }
      restore_transaction: {
        Args: { p_id: string; p_request_id?: string }
        Returns: Json
      }
      run_budget_alerts: { Args: { p_through?: string }; Returns: number }
      search_transactions: {
        Args: { p_limit?: number; p_query: string; p_space_id: string }
        Returns: Json
      }
      seed_default_categories: {
        Args: { p_category_keys?: string[]; p_space_id: string }
        Returns: undefined
      }
      space_series: {
        Args: {
          p_from: string
          p_granularity?: string
          p_space_id: string
          p_to: string
        }
        Returns: Json
      }
      space_summary: {
        Args: {
          p_from: string
          p_participant_id?: string
          p_space_id: string
          p_to: string
        }
        Returns: Json
      }
      suggest_budgets: { Args: { p_space_id: string }; Returns: Json }
      update_transaction: { Args: { p: Json; p_id: string }; Returns: Json }
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

