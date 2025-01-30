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
      wallets: {
        Row: {
          id: string
          address: string
          private_key: string
          mnemonic: string | null
          status: 'created' | 'connected' | 'minting' | 'completed' | 'failed'
          created_at: string
          network: string | null
          chain_id: number
          tag: string | null
          first_transaction_at: string | null
          last_transaction_at: string | null
          transaction_count: number
          email: string | null
          email_hash: string | null
          email_domain: string | null
          email_created_at: string | null
        }
        Insert: {
          id?: string
          address: string
          private_key: string
          mnemonic?: string | null
          status: 'created' | 'connected' | 'minting' | 'completed' | 'failed'
          created_at?: string
          network?: string | null
          chain_id: number
          tag?: string | null
          first_transaction_at?: string | null
          last_transaction_at?: string | null
          transaction_count?: number
          email?: string | null
          email_hash?: string | null
          email_domain?: string | null
          email_created_at?: string | null
        }
        Update: {
          id?: string
          address?: string
          private_key?: string
          mnemonic?: string | null
          status?: 'created' | 'connected' | 'minting' | 'completed' | 'failed'
          created_at?: string
          network?: string | null
          chain_id?: number
          tag?: string | null
          first_transaction_at?: string | null
          last_transaction_at?: string | null
          transaction_count?: number
          email?: string | null
          email_hash?: string | null
          email_domain?: string | null
          email_created_at?: string | null
        }
      }
      api_keys: {
        Row: {
          id: string
          provider: string
          key: string
          created_at: string
          updated_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          provider: string
          key: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          provider?: string
          key?: string
          created_at?: string
          updated_at?: string
          is_active?: boolean
        }
      }
    }
  }
}