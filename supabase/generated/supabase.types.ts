export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "meldiq": {
          Tables: {
            "abandoned_uploads": {
                  Row: {
                    "attempts": number,"id": string,"multipart_id": string | null,"next_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"id": string,"multipart_id"?: string | null,"next_at": number
                  }
                  Update: {
                    "attempts"?: number,"id"?: string,"multipart_id"?: string | null,"next_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"account_codes": {
                  Row: {
                    "account_id": string,"attempts": number,"code_hash": string,"created_at": number,"expires_at": number,"purpose": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"attempts"?: number,"code_hash": string,"created_at": number,"expires_at": number,"purpose": string
                  }
                  Update: {
                    "account_id"?: string,"attempts"?: number,"code_hash"?: string,"created_at"?: number,"expires_at"?: number,"purpose"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_codes_fk_0"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"account_email_changes": {
                  Row: {
                    "account_id": string,"attempts": number,"code_hash": string,"created_at": number,"expires_at": number,"new_email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"attempts"?: number,"code_hash": string,"created_at": number,"expires_at": number,"new_email": string
                  }
                  Update: {
                    "account_id"?: string,"attempts"?: number,"code_hash"?: string,"created_at"?: number,"expires_at"?: number,"new_email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"account_key_backups": {
                  Row: {
                    "account_id": string,"ciphertext": string,"created_at": number,"identity_key": string,"iterations": number,"nonce": string,"password_changed_at": number,"salt": string,"updated_at": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"ciphertext": string,"created_at": number,"identity_key": string,"iterations": number,"nonce": string,"password_changed_at": number,"salt": string,"updated_at": number,"version": number
                  }
                  Update: {
                    "account_id"?: string,"ciphertext"?: string,"created_at"?: number,"identity_key"?: string,"iterations"?: number,"nonce"?: string,"password_changed_at"?: number,"salt"?: string,"updated_at"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_key_backups_fk_0"
      columns: ["account_id"]
isOneToOne: true
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"account_key_unlocks": {
                  Row: {
                    "account_id": string,"attempts": number,"code_hash": string,"created_at": number,"expires_at": number,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"attempts"?: number,"code_hash": string,"created_at": number,"expires_at": number,"session_id": string
                  }
                  Update: {
                    "account_id"?: string,"attempts"?: number,"code_hash"?: string,"created_at"?: number,"expires_at"?: number,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_key_unlocks_fk_0"
      columns: ["account_id"]
isOneToOne: true
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"account_passkey_challenges": {
                  Row: {
                    "account_id": string | null,"challenge": string,"created_at": number,"expires_at": number,"id": string,"purpose": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"challenge": string,"created_at": number,"expires_at": number,"id": string,"purpose": string
                  }
                  Update: {
                    "account_id"?: string | null,"challenge"?: string,"created_at"?: number,"expires_at"?: number,"id"?: string,"purpose"?: string
                  }
                  Relationships: [
                    
                  ]
                },"account_passkeys": {
                  Row: {
                    "account_id": string,"backed_up": number,"counter": number,"created_at": number,"id": string,"last_used_at": number | null,"name": string,"public_key": string,"transports": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"backed_up"?: number,"counter"?: number,"created_at": number,"id": string,"last_used_at"?: number | null,"name": string,"public_key": string,"transports"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"backed_up"?: number,"counter"?: number,"created_at"?: number,"id"?: string,"last_used_at"?: number | null,"name"?: string,"public_key"?: string,"transports"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"account_recovery_codes": {
                  Row: {
                    "account_id": string,"code_hash": string,"created_at": number,"id": string,"used_at": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"code_hash": string,"created_at": number,"id": string,"used_at"?: number | null
                  }
                  Update: {
                    "account_id"?: string,"code_hash"?: string,"created_at"?: number,"id"?: string,"used_at"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_recovery_codes_fk_0"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"account_recovery_tickets": {
                  Row: {
                    "account_id": string,"attempts": number,"created_at": number,"email_code_hash": string,"expires_at": number,"new_email": string,"ticket_hash": string,"used_at": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"attempts"?: number,"created_at": number,"email_code_hash": string,"expires_at": number,"new_email": string,"ticket_hash": string,"used_at"?: number | null
                  }
                  Update: {
                    "account_id"?: string,"attempts"?: number,"created_at"?: number,"email_code_hash"?: string,"expires_at"?: number,"new_email"?: string,"ticket_hash"?: string,"used_at"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_recovery_tickets_fk_0"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"account_session_factors": {
                  Row: {
                    "account_id": string,"expires_at": number,"id": string,"verified_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"expires_at": number,"id": string,"verified_at": number
                  }
                  Update: {
                    "account_id"?: string,"expires_at"?: number,"id"?: string,"verified_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_session_factors_fk_0"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_session_factors_fk_1"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "account_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"account_sessions": {
                  Row: {
                    "access_expires_at": number,"access_hash": string,"account_id": string,"created_at": number,"device_id": string | null,"expires_at": number,"id": string,"label": string,"last_used_at": number,"previous_refresh_answer": string | null,"previous_refresh_hash": string | null,"refresh_expires_at": number,"refresh_hash": string,"refreshed_at": number,"revoke_reason": string | null,"revoked_at": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_expires_at": number,"access_hash": string,"account_id": string,"created_at": number,"device_id"?: string | null,"expires_at": number,"id": string,"label": string,"last_used_at": number,"previous_refresh_answer"?: string | null,"previous_refresh_hash"?: string | null,"refresh_expires_at": number,"refresh_hash": string,"refreshed_at": number,"revoke_reason"?: string | null,"revoked_at"?: number | null
                  }
                  Update: {
                    "access_expires_at"?: number,"access_hash"?: string,"account_id"?: string,"created_at"?: number,"device_id"?: string | null,"expires_at"?: number,"id"?: string,"label"?: string,"last_used_at"?: number,"previous_refresh_answer"?: string | null,"previous_refresh_hash"?: string | null,"refresh_expires_at"?: number,"refresh_hash"?: string,"refreshed_at"?: number,"revoke_reason"?: string | null,"revoked_at"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_sessions_fk_0"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_sessions_fk_1"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"account_social_flows": {
                  Row: {
                    "data": string,"expires_at": number,"id": string,"stage": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data": string,"expires_at": number,"id": string,"stage": string
                  }
                  Update: {
                    "data"?: string,"expires_at"?: number,"id"?: string,"stage"?: string
                  }
                  Relationships: [
                    
                  ]
                },"account_social_identities": {
                  Row: {
                    "account_id": string,"connected_at": number,"email": string | null,"id": string,"issuer": string,"provider": string,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"connected_at": number,"email"?: string | null,"id": string,"issuer": string,"provider": string,"subject": string
                  }
                  Update: {
                    "account_id"?: string,"connected_at"?: number,"email"?: string | null,"id"?: string,"issuer"?: string,"provider"?: string,"subject"?: string
                  }
                  Relationships: [
                    
                  ]
                },"account_totp": {
                  Row: {
                    "account_id": string,"created_at": number,"enabled_at": number | null,"last_step": number,"secret": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at": number,"enabled_at"?: number | null,"last_step"?: number,"secret": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: number,"enabled_at"?: number | null,"last_step"?: number,"secret"?: string
                  }
                  Relationships: [
                    
                  ]
                },"account_totp_backup": {
                  Row: {
                    "account_id": string,"code_hash": string,"created_at": number,"id": string,"used_at": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"code_hash": string,"created_at": number,"id": string,"used_at"?: number | null
                  }
                  Update: {
                    "account_id"?: string,"code_hash"?: string,"created_at"?: number,"id"?: string,"used_at"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"account_warnings": {
                  Row: {
                    "created_at": number,"created_by": string | null,"expires_at": number,"id": string,"reason": string,"revoked_at": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by"?: string | null,"expires_at": number,"id": string,"reason": string,"revoked_at"?: number | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string | null,"expires_at"?: number,"id"?: string,"reason"?: string,"revoked_at"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_warnings_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"accounts": {
                  Row: {
                    "admitted_via": string | null,"created_at": number,"disabled_at": number | null,"email": string,"email_verified_at": number | null,"id": string,"legacy_linked_at": number | null,"name": string,"password_changed_at": number,"password_hash": string,"selected_workspace_id": string | null,"updated_at": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admitted_via"?: string | null,"created_at": number,"disabled_at"?: number | null,"email": string,"email_verified_at"?: number | null,"id": string,"legacy_linked_at"?: number | null,"name": string,"password_changed_at": number,"password_hash": string,"selected_workspace_id"?: string | null,"updated_at": number,"user_id"?: string | null
                  }
                  Update: {
                    "admitted_via"?: string | null,"created_at"?: number,"disabled_at"?: number | null,"email"?: string,"email_verified_at"?: number | null,"id"?: string,"legacy_linked_at"?: number | null,"name"?: string,"password_changed_at"?: number,"password_hash"?: string,"selected_workspace_id"?: string | null,"updated_at"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_daily": {
                  Row: {
                    "actions": number,"client_version": string,"day": string,"first_action_at": number | null,"first_at": number,"last_at": number,"platform": string,"requests": number,"signup_at": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actions"?: number,"client_version"?: string,"day": string,"first_action_at"?: number | null,"first_at": number,"last_at": number,"platform": string,"requests"?: number,"signup_at"?: number | null,"user_id": string
                  }
                  Update: {
                    "actions"?: number,"client_version"?: string,"day"?: string,"first_action_at"?: number | null,"first_at"?: number,"last_at"?: number,"platform"?: string,"requests"?: number,"signup_at"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_agent_channels": {
                  Row: {
                    "activation": string,"added_at": number,"added_by": string,"conversation_id": string,"install_id": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activation": string,"added_at": number,"added_by": string,"conversation_id": string,"install_id": string,"org_id": string
                  }
                  Update: {
                    "activation"?: string,"added_at"?: number,"added_by"?: string,"conversation_id"?: string,"install_id"?: string,"org_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_agent_identities": {
                  Row: {
                    "created_at": number,"identity_seed": string,"install_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"identity_seed": string,"install_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"identity_seed"?: string,"install_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_agent_installs": {
                  Row: {
                    "active_hours": string | null,"agent_id": string,"autonomy": string,"avatar_blob": string | null,"avatar_color": string | null,"avatar_sha256": string | null,"created_at": number,"description": string,"display_name": string,"execution_mode": string,"id": string,"installed_by": string,"instructions": string,"invokers": string,"language": string | null,"live_agent": string | null,"max_attempts": number | null,"max_concurrent": number | null,"max_cost_micro_month": number | null,"max_jobs_per_day": number | null,"max_runtime_sec": number | null,"org_id": string,"rev": number,"role_title": string,"state": string,"style": string,"tools": string,"updated_at": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active_hours"?: string | null,"agent_id": string,"autonomy"?: string,"avatar_blob"?: string | null,"avatar_color"?: string | null,"avatar_sha256"?: string | null,"created_at": number,"description": string,"display_name": string,"execution_mode"?: string,"id": string,"installed_by": string,"instructions"?: string,"invokers"?: string,"language"?: string | null,"live_agent"?: string | null,"max_attempts"?: number | null,"max_concurrent"?: number | null,"max_cost_micro_month"?: number | null,"max_jobs_per_day"?: number | null,"max_runtime_sec"?: number | null,"org_id": string,"rev": number,"role_title": string,"state": string,"style"?: string,"tools": string,"updated_at": number,"version": number
                  }
                  Update: {
                    "active_hours"?: string | null,"agent_id"?: string,"autonomy"?: string,"avatar_blob"?: string | null,"avatar_color"?: string | null,"avatar_sha256"?: string | null,"created_at"?: number,"description"?: string,"display_name"?: string,"execution_mode"?: string,"id"?: string,"installed_by"?: string,"instructions"?: string,"invokers"?: string,"language"?: string | null,"live_agent"?: string | null,"max_attempts"?: number | null,"max_concurrent"?: number | null,"max_cost_micro_month"?: number | null,"max_jobs_per_day"?: number | null,"max_runtime_sec"?: number | null,"org_id"?: string,"rev"?: number,"role_title"?: string,"state"?: string,"style"?: string,"tools"?: string,"updated_at"?: number,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_agent_templates": {
                  Row: {
                    "agent_id": string,"availability": string,"created_at": number,"policy": string,"status": string,"updated_at": number,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id": string,"availability"?: string,"created_at": number,"policy"?: string,"status": string,"updated_at": number,"updated_by"?: string | null,"version": number
                  }
                  Update: {
                    "agent_id"?: string,"availability"?: string,"created_at"?: number,"policy"?: string,"status"?: string,"updated_at"?: number,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_approvals": {
                  Row: {
                    "action": string,"artifact_id": string | null,"artifact_sha": string | null,"decided_at": number | null,"decided_by": string | null,"id": string,"job_id": string,"note": string | null,"org_id": string,"payload_hash": string | null,"requested_at": number,"state": string,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"artifact_id"?: string | null,"artifact_sha"?: string | null,"decided_at"?: number | null,"decided_by"?: string | null,"id": string,"job_id": string,"note"?: string | null,"org_id": string,"payload_hash"?: string | null,"requested_at": number,"state": string,"summary": string
                  }
                  Update: {
                    "action"?: string,"artifact_id"?: string | null,"artifact_sha"?: string | null,"decided_at"?: number | null,"decided_by"?: string | null,"id"?: string,"job_id"?: string,"note"?: string | null,"org_id"?: string,"payload_hash"?: string | null,"requested_at"?: number,"state"?: string,"summary"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_channel_context": {
                  Row: {
                    "body": string,"edited_at": number | null,"message_id": string,"reader_id": string,"received_at": number,"sender_user_id": string,"sent_at": number,"thread_root": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"edited_at"?: number | null,"message_id": string,"reader_id": string,"received_at": number,"sender_user_id": string,"sent_at": number,"thread_root"?: string | null
                  }
                  Update: {
                    "body"?: string,"edited_at"?: number | null,"message_id"?: string,"reader_id"?: string,"received_at"?: number,"sender_user_id"?: string,"sent_at"?: number,"thread_root"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_channel_posts": {
                  Row: {
                    "approval_id": string | null,"author_id": string | null,"body": string,"conversation_id": string,"created_at": number,"expires_at": number,"file_ids": string,"id": string,"install_id": string,"job_id": string | null,"kind": string,"org_id": string,"thread_root": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_id"?: string | null,"author_id"?: string | null,"body": string,"conversation_id": string,"created_at": number,"expires_at": number,"file_ids"?: string,"id": string,"install_id": string,"job_id"?: string | null,"kind": string,"org_id": string,"thread_root"?: string | null
                  }
                  Update: {
                    "approval_id"?: string | null,"author_id"?: string | null,"body"?: string,"conversation_id"?: string,"created_at"?: number,"expires_at"?: number,"file_ids"?: string,"id"?: string,"install_id"?: string,"job_id"?: string | null,"kind"?: string,"org_id"?: string,"thread_root"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_channel_readers": {
                  Row: {
                    "conversation_id": string,"created_at": number,"device_id": string,"device_keys": string | null,"id": string,"install_id": string,"mode": string,"off_reason": string | null,"org_id": string,"reader_key": string | null,"reason": string,"state": string,"turned_off_at": number | null,"turned_off_by": string | null,"turned_on_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at": number,"device_id": string,"device_keys"?: string | null,"id": string,"install_id": string,"mode"?: string,"off_reason"?: string | null,"org_id": string,"reader_key"?: string | null,"reason": string,"state": string,"turned_off_at"?: number | null,"turned_off_by"?: string | null,"turned_on_by": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: number,"device_id"?: string,"device_keys"?: string | null,"id"?: string,"install_id"?: string,"mode"?: string,"off_reason"?: string | null,"org_id"?: string,"reader_key"?: string | null,"reason"?: string,"state"?: string,"turned_off_at"?: number | null,"turned_off_by"?: string | null,"turned_on_by"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_files": {
                  Row: {
                    "agent_id": string | null,"approval_state": string,"artifact_version": number,"blob_key": string,"conversation_id": string | null,"created_at": number,"deleted_at": number | null,"expires_at": number,"id": string,"install_id": string | null,"job_id": string | null,"kind": string | null,"mime": string,"name": string,"org_id": string,"role": string,"sha256": string,"size": number,"skill_version": number | null,"supersedes": string | null,"task_id": string | null,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id"?: string | null,"approval_state"?: string,"artifact_version"?: number,"blob_key": string,"conversation_id"?: string | null,"created_at": number,"deleted_at"?: number | null,"expires_at": number,"id": string,"install_id"?: string | null,"job_id"?: string | null,"kind"?: string | null,"mime": string,"name": string,"org_id": string,"role": string,"sha256": string,"size": number,"skill_version"?: number | null,"supersedes"?: string | null,"task_id"?: string | null,"uploaded_by"?: string | null
                  }
                  Update: {
                    "agent_id"?: string | null,"approval_state"?: string,"artifact_version"?: number,"blob_key"?: string,"conversation_id"?: string | null,"created_at"?: number,"deleted_at"?: number | null,"expires_at"?: number,"id"?: string,"install_id"?: string | null,"job_id"?: string | null,"kind"?: string | null,"mime"?: string,"name"?: string,"org_id"?: string,"role"?: string,"sha256"?: string,"size"?: number,"skill_version"?: number | null,"supersedes"?: string | null,"task_id"?: string | null,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_job_events": {
                  Row: {
                    "at": number,"detail": string,"id": number,"job_id": string,"kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"detail"?: string,"id": number,"job_id": string,"kind": string
                  }
                  Update: {
                    "at"?: number,"detail"?: string,"id"?: number,"job_id"?: string,"kind"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_jobs": {
                  Row: {
                    "agent_id": string,"attempts": number,"cancel_requested": number,"chain": number,"checkpoint": string | null,"conversation_id": string | null,"created_at": number,"deadline_at": number,"depends_on": string,"depth": number,"error_code": string | null,"error_detail": string | null,"expires_at": number,"finished_at": number | null,"id": string,"idempotency_key": string | null,"input": string,"install_id": string,"lease_until": number | null,"max_attempts": number,"next_at": number,"org_id": string,"output": string | null,"parent_job_id": string | null,"progress": number,"progress_note": string | null,"requested_by": string,"revision": number,"root_job_id": string,"skill_id": string,"source_job_id": string | null,"started_at": number | null,"state": string,"thread_root": string | null,"trigger_id": string | null,"updated_at": number,"version": number,"waiting_on": string | null,"worker": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id": string,"attempts"?: number,"cancel_requested"?: number,"chain"?: number,"checkpoint"?: string | null,"conversation_id"?: string | null,"created_at": number,"deadline_at": number,"depends_on"?: string,"depth"?: number,"error_code"?: string | null,"error_detail"?: string | null,"expires_at": number,"finished_at"?: number | null,"id": string,"idempotency_key"?: string | null,"input": string,"install_id": string,"lease_until"?: number | null,"max_attempts": number,"next_at": number,"org_id": string,"output"?: string | null,"parent_job_id"?: string | null,"progress"?: number,"progress_note"?: string | null,"requested_by": string,"revision"?: number,"root_job_id": string,"skill_id": string,"source_job_id"?: string | null,"started_at"?: number | null,"state": string,"thread_root"?: string | null,"trigger_id"?: string | null,"updated_at": number,"version": number,"waiting_on"?: string | null,"worker"?: string | null
                  }
                  Update: {
                    "agent_id"?: string,"attempts"?: number,"cancel_requested"?: number,"chain"?: number,"checkpoint"?: string | null,"conversation_id"?: string | null,"created_at"?: number,"deadline_at"?: number,"depends_on"?: string,"depth"?: number,"error_code"?: string | null,"error_detail"?: string | null,"expires_at"?: number,"finished_at"?: number | null,"id"?: string,"idempotency_key"?: string | null,"input"?: string,"install_id"?: string,"lease_until"?: number | null,"max_attempts"?: number,"next_at"?: number,"org_id"?: string,"output"?: string | null,"parent_job_id"?: string | null,"progress"?: number,"progress_note"?: string | null,"requested_by"?: string,"revision"?: number,"root_job_id"?: string,"skill_id"?: string,"source_job_id"?: string | null,"started_at"?: number | null,"state"?: string,"thread_root"?: string | null,"trigger_id"?: string | null,"updated_at"?: number,"version"?: number,"waiting_on"?: string | null,"worker"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_model_capabilities": {
                  Row: {
                    "capability": string,"model": string,"provider_id": string,"verified_at": number | null,"verify_detail": string | null,"verify_ok": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capability": string,"model": string,"provider_id": string,"verified_at"?: number | null,"verify_detail"?: string | null,"verify_ok"?: number | null
                  }
                  Update: {
                    "capability"?: string,"model"?: string,"provider_id"?: string,"verified_at"?: number | null,"verify_detail"?: string | null,"verify_ok"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_models": {
                  Row: {
                    "auto_routable": number,"enabled": number,"input_price_micro": number | null,"minute_price_micro": number | null,"model": string,"output_price_micro": number | null,"price_source": string,"price_updated_at": number | null,"provider_id": string,"quality_rank": number | null,"request_price_micro": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_routable"?: number,"enabled"?: number,"input_price_micro"?: number | null,"minute_price_micro"?: number | null,"model": string,"output_price_micro"?: number | null,"price_source"?: string,"price_updated_at"?: number | null,"provider_id": string,"quality_rank"?: number | null,"request_price_micro"?: number | null
                  }
                  Update: {
                    "auto_routable"?: number,"enabled"?: number,"input_price_micro"?: number | null,"minute_price_micro"?: number | null,"model"?: string,"output_price_micro"?: number | null,"price_source"?: string,"price_updated_at"?: number | null,"provider_id"?: string,"quality_rank"?: number | null,"request_price_micro"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_models_fk_0"
      columns: ["provider_id"]
isOneToOne: false
      referencedRelation: "ai_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_org_entitlements": {
                  Row: {
                    "doc": string,"org_id": string,"rev": number,"updated_at": number,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "doc": string,"org_id": string,"rev": number,"updated_at": number,"updated_by"?: string | null
                  }
                  Update: {
                    "doc"?: string,"org_id"?: string,"rev"?: number,"updated_at"?: number,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_providers": {
                  Row: {
                    "created_at": number,"created_by": string,"enabled": number,"fallback_id": string | null,"id": string,"kind": string,"last_test_at": number | null,"last_test_detail": string | null,"last_test_ok": number | null,"max_retries": number,"name": string,"secret_ciphertext": string | null,"secret_set_at": number | null,"timeout_ms": number,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by": string,"enabled"?: number,"fallback_id"?: string | null,"id": string,"kind": string,"last_test_at"?: number | null,"last_test_detail"?: string | null,"last_test_ok"?: number | null,"max_retries"?: number,"name": string,"secret_ciphertext"?: string | null,"secret_set_at"?: number | null,"timeout_ms"?: number,"updated_at": number
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string,"enabled"?: number,"fallback_id"?: string | null,"id"?: string,"kind"?: string,"last_test_at"?: number | null,"last_test_detail"?: string | null,"last_test_ok"?: number | null,"max_retries"?: number,"name"?: string,"secret_ciphertext"?: string | null,"secret_set_at"?: number | null,"timeout_ms"?: number,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_reader_choices": {
                  Row: {
                    "at": number,"choice": string,"reader_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"choice": string,"reader_id": string,"user_id": string
                  }
                  Update: {
                    "at"?: number,"choice"?: string,"reader_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_reader_events": {
                  Row: {
                    "at": number,"job_id": string | null,"message_id": string,"outcome": string,"reader_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"job_id"?: string | null,"message_id": string,"outcome": string,"reader_id": string
                  }
                  Update: {
                    "at"?: number,"job_id"?: string | null,"message_id"?: string,"outcome"?: string,"reader_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_routing": {
                  Row: {
                    "category": string,"fallbacks": string,"max_price_micro": number | null,"model": string | null,"prefer": string,"provider_id": string | null,"updated_at": number,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"fallbacks"?: string,"max_price_micro"?: number | null,"model"?: string | null,"prefer"?: string,"provider_id"?: string | null,"updated_at": number,"updated_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"fallbacks"?: string,"max_price_micro"?: number | null,"model"?: string | null,"prefer"?: string,"provider_id"?: string | null,"updated_at"?: number,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_shared_messages": {
                  Row: {
                    "conversation_id": string,"count": number,"created_at": number,"expires_at": number,"job_id": string,"messages": string,"org_id": string,"shared_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"count": number,"created_at": number,"expires_at": number,"job_id": string,"messages": string,"org_id": string,"shared_by": string
                  }
                  Update: {
                    "conversation_id"?: string,"count"?: number,"created_at"?: number,"expires_at"?: number,"job_id"?: string,"messages"?: string,"org_id"?: string,"shared_by"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_system_checks": {
                  Row: {
                    "finished_at": number,"id": string,"org_id": string | null,"report": string,"requested_by": string,"scope": string,"started_at": number,"summary": string,"worst": string
                  }
                  ComputedFields: never
                  Insert: {
                    "finished_at": number,"id": string,"org_id"?: string | null,"report": string,"requested_by": string,"scope": string,"started_at": number,"summary": string,"worst": string
                  }
                  Update: {
                    "finished_at"?: number,"id"?: string,"org_id"?: string | null,"report"?: string,"requested_by"?: string,"scope"?: string,"started_at"?: number,"summary"?: string,"worst"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_task_events": {
                  Row: {
                    "actor_id": string | null,"at": number,"detail": string,"id": number,"kind": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"at": number,"detail"?: string,"id": number,"kind": string,"task_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"at"?: number,"detail"?: string,"id"?: number,"kind"?: string,"task_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_task_settings": {
                  Row: {
                    "org_id": string,"roles": string,"updated_at": number,"updated_by": string,"users": string
                  }
                  ComputedFields: never
                  Insert: {
                    "org_id": string,"roles"?: string,"updated_at": number,"updated_by": string,"users"?: string
                  }
                  Update: {
                    "org_id"?: string,"roles"?: string,"updated_at"?: number,"updated_by"?: string,"users"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_tasks": {
                  Row: {
                    "accepted_at": number | null,"assignee_id": string,"blocked_reason": string | null,"cancel_reason": string | null,"conversation_id": string | null,"created_at": number,"created_by": string,"deliverables": string,"depends_on": string,"done_at": number | null,"done_by": string | null,"due_at": number | null,"escalated_at": number | null,"id": string,"install_id": string | null,"instructions": string,"job_id": string | null,"last_reminder_at": number | null,"opened_at": number | null,"org_id": string,"priority": string,"reference_files": string,"reminders": number,"return_reason": string | null,"returns": number,"rev": number,"state": string,"submission_note": string | null,"submitted_at": number | null,"title": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: number | null,"assignee_id": string,"blocked_reason"?: string | null,"cancel_reason"?: string | null,"conversation_id"?: string | null,"created_at": number,"created_by": string,"deliverables"?: string,"depends_on"?: string,"done_at"?: number | null,"done_by"?: string | null,"due_at"?: number | null,"escalated_at"?: number | null,"id": string,"install_id"?: string | null,"instructions": string,"job_id"?: string | null,"last_reminder_at"?: number | null,"opened_at"?: number | null,"org_id": string,"priority"?: string,"reference_files"?: string,"reminders"?: number,"return_reason"?: string | null,"returns"?: number,"rev"?: number,"state"?: string,"submission_note"?: string | null,"submitted_at"?: number | null,"title": string,"updated_at": number
                  }
                  Update: {
                    "accepted_at"?: number | null,"assignee_id"?: string,"blocked_reason"?: string | null,"cancel_reason"?: string | null,"conversation_id"?: string | null,"created_at"?: number,"created_by"?: string,"deliverables"?: string,"depends_on"?: string,"done_at"?: number | null,"done_by"?: string | null,"due_at"?: number | null,"escalated_at"?: number | null,"id"?: string,"install_id"?: string | null,"instructions"?: string,"job_id"?: string | null,"last_reminder_at"?: number | null,"opened_at"?: number | null,"org_id"?: string,"priority"?: string,"reference_files"?: string,"reminders"?: number,"return_reason"?: string | null,"returns"?: number,"rev"?: number,"state"?: string,"submission_note"?: string | null,"submitted_at"?: number | null,"title"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_tool_policies": {
                  Row: {
                    "mode": string,"tool": string,"updated_at": number,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "mode": string,"tool": string,"updated_at": number,"updated_by"?: string | null
                  }
                  Update: {
                    "mode"?: string,"tool"?: string,"updated_at"?: number,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_triggers": {
                  Row: {
                    "brief": string,"config": string,"conversation_id": string | null,"created_at": number,"created_by": string,"enabled": number,"failures": number,"id": string,"install_id": string,"kind": string,"label": string,"last_error": string | null,"last_fired_at": number | null,"last_job_id": string | null,"next_run_at": number | null,"org_id": string,"rev": number,"run_as": string,"secret_hash": string | null,"source_install_id": string | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "brief": string,"config": string,"conversation_id"?: string | null,"created_at": number,"created_by": string,"enabled"?: number,"failures"?: number,"id": string,"install_id": string,"kind": string,"label": string,"last_error"?: string | null,"last_fired_at"?: number | null,"last_job_id"?: string | null,"next_run_at"?: number | null,"org_id": string,"rev": number,"run_as": string,"secret_hash"?: string | null,"source_install_id"?: string | null,"updated_at": number
                  }
                  Update: {
                    "brief"?: string,"config"?: string,"conversation_id"?: string | null,"created_at"?: number,"created_by"?: string,"enabled"?: number,"failures"?: number,"id"?: string,"install_id"?: string,"kind"?: string,"label"?: string,"last_error"?: string | null,"last_fired_at"?: number | null,"last_job_id"?: string | null,"next_run_at"?: number | null,"org_id"?: string,"rev"?: number,"run_as"?: string,"secret_hash"?: string | null,"source_install_id"?: string | null,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "agent_id": string | null,"at": number,"capability": string | null,"cost_micro": number | null,"error_kind": string | null,"feature": string,"id": number,"input_tokens": number | null,"install_id": string | null,"job_id": string | null,"latency_ms": number | null,"model": string,"org_id": string | null,"outcome": string,"output_tokens": number | null,"provider_id": string,"route": string | null,"status": number | null,"tokens_source": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id"?: string | null,"at": number,"capability"?: string | null,"cost_micro"?: number | null,"error_kind"?: string | null,"feature": string,"id": number,"input_tokens"?: number | null,"install_id"?: string | null,"job_id"?: string | null,"latency_ms"?: number | null,"model": string,"org_id"?: string | null,"outcome": string,"output_tokens"?: number | null,"provider_id": string,"route"?: string | null,"status"?: number | null,"tokens_source"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "agent_id"?: string | null,"at"?: number,"capability"?: string | null,"cost_micro"?: number | null,"error_kind"?: string | null,"feature"?: string,"id"?: number,"input_tokens"?: number | null,"install_id"?: string | null,"job_id"?: string | null,"latency_ms"?: number | null,"model"?: string,"org_id"?: string | null,"outcome"?: string,"output_tokens"?: number | null,"provider_id"?: string,"route"?: string | null,"status"?: number | null,"tokens_source"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"alert_deliveries": {
                  Row: {
                    "at": number,"channel": string,"detail": string | null,"id": number,"incident_id": string,"outcome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"channel": string,"detail"?: string | null,"id": number,"incident_id": string,"outcome": string
                  }
                  Update: {
                    "at"?: number,"channel"?: string,"detail"?: string | null,"id"?: number,"incident_id"?: string,"outcome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"alert_rules": {
                  Row: {
                    "enabled": number,"key": string,"severity": string,"threshold": number,"updated_at": number,"updated_by": string,"window_minutes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: number,"key": string,"severity": string,"threshold": number,"updated_at": number,"updated_by": string,"window_minutes": number
                  }
                  Update: {
                    "enabled"?: number,"key"?: string,"severity"?: string,"threshold"?: number,"updated_at"?: number,"updated_by"?: string,"window_minutes"?: number
                  }
                  Relationships: [
                    
                  ]
                },"alert_state": {
                  Row: {
                    "breaching": number,"incident_id": string | null,"key": string,"last_eval_at": number,"last_value": number | null,"since": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "breaching"?: number,"incident_id"?: string | null,"key": string,"last_eval_at": number,"last_value"?: number | null,"since"?: number | null
                  }
                  Update: {
                    "breaching"?: number,"incident_id"?: string | null,"key"?: string,"last_eval_at"?: number,"last_value"?: number | null,"since"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"analytics_daily": {
                  Row: {
                    "count": number,"day": string,"dims": string,"event": string,"experiment": string,"platform": string,"value_count": number,"value_sum": number,"variant": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"day": string,"dims": string,"event": string,"experiment"?: string,"platform": string,"value_count"?: number,"value_sum"?: number,"variant"?: string
                  }
                  Update: {
                    "count"?: number,"day"?: string,"dims"?: string,"event"?: string,"experiment"?: string,"platform"?: string,"value_count"?: number,"value_sum"?: number,"variant"?: string
                  }
                  Relationships: [
                    
                  ]
                },"api_keys": {
                  Row: {
                    "created_at": number,"created_by": string,"expires_at": number,"hint": string,"id": string,"last_used_at": number | null,"name": string,"org_id": string,"revoked_at": number | null,"scopes": string,"secret_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by": string,"expires_at": number,"hint": string,"id": string,"last_used_at"?: number | null,"name": string,"org_id": string,"revoked_at"?: number | null,"scopes": string,"secret_hash": string
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string,"expires_at"?: number,"hint"?: string,"id"?: string,"last_used_at"?: number | null,"name"?: string,"org_id"?: string,"revoked_at"?: number | null,"scopes"?: string,"secret_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_keys_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"attachment_uploads": {
                  Row: {
                    "conversation_id": string,"created_at": number,"device_id": string,"expires_at": number,"id": string,"multipart_id": string | null,"part_size": number | null,"sha256": string,"size": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at": number,"device_id": string,"expires_at": number,"id": string,"multipart_id"?: string | null,"part_size"?: number | null,"sha256": string,"size": number,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: number,"device_id"?: string,"expires_at"?: number,"id"?: string,"multipart_id"?: string | null,"part_size"?: number | null,"sha256"?: string,"size"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachment_uploads_fk_0"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachment_uploads_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "conversation_id": string,"created_at": number,"expires_at": number,"id": string,"kept": number,"message_id": string | null,"pending_message_until": number | null,"sha256": string | null,"size": number,"uploader_user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at": number,"expires_at": number,"id": string,"kept"?: number,"message_id"?: string | null,"pending_message_until"?: number | null,"sha256"?: string | null,"size": number,"uploader_user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: number,"expires_at"?: number,"id"?: string,"kept"?: number,"message_id"?: string | null,"pending_message_until"?: number | null,"sha256"?: string | null,"size"?: number,"uploader_user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_fk_0"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": number,"detail": string | null,"id": number,"org_id": string | null,"target": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at": number,"detail"?: string | null,"id": number,"org_id"?: string | null,"target"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: number,"detail"?: string | null,"id"?: number,"org_id"?: string | null,"target"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"auth_challenges": {
                  Row: {
                    "created_at": number,"expires_at": number,"nonce": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"expires_at": number,"nonce": string
                  }
                  Update: {
                    "created_at"?: number,"expires_at"?: number,"nonce"?: string
                  }
                  Relationships: [
                    
                  ]
                },"auth_device_sessions": {
                  Row: {
                    "account_id": string,"auth_user_id": string,"bound_at": number,"device_id": string,"id": string,"link_method": string,"password_changed_at": number,"revoked_at": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"auth_user_id": string,"bound_at": number,"device_id": string,"id": string,"link_method": string,"password_changed_at": number,"revoked_at"?: number | null,"user_id": string
                  }
                  Update: {
                    "account_id"?: string,"auth_user_id"?: string,"bound_at"?: number,"device_id"?: string,"id"?: string,"link_method"?: string,"password_changed_at"?: number,"revoked_at"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "auth_device_sessions_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auth_device_sessions_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auth_device_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_card_charge_attempts": {
                  Row: {
                    "charge_id": string,"created_at": number,"generation": number,"id": string,"provider_capture_ref": string | null,"provider_order_ref": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "charge_id": string,"created_at": number,"generation": number,"id": string,"provider_capture_ref"?: string | null,"provider_order_ref"?: string | null,"status": string
                  }
                  Update: {
                    "charge_id"?: string,"created_at"?: number,"generation"?: number,"id"?: string,"provider_capture_ref"?: string | null,"provider_order_ref"?: string | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_card_charges": {
                  Row: {
                    "amount_minor": number,"attempts": number,"created_at": number,"currency": string,"generation": number,"grant_id": string | null,"id": string,"lease_until": number | null,"mandate_id": string,"next_attempt_at": number,"period_end": number,"period_start": number,"provider_capture_ref": string | null,"provider_order_ref": string | null,"request_started_at": number | null,"status": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"attempts"?: number,"created_at": number,"currency": string,"generation"?: number,"grant_id"?: string | null,"id": string,"lease_until"?: number | null,"mandate_id": string,"next_attempt_at": number,"period_end": number,"period_start": number,"provider_capture_ref"?: string | null,"provider_order_ref"?: string | null,"request_started_at"?: number | null,"status"?: string,"updated_at": number
                  }
                  Update: {
                    "amount_minor"?: number,"attempts"?: number,"created_at"?: number,"currency"?: string,"generation"?: number,"grant_id"?: string | null,"id"?: string,"lease_until"?: number | null,"mandate_id"?: string,"next_attempt_at"?: number,"period_end"?: number,"period_start"?: number,"provider_capture_ref"?: string | null,"provider_order_ref"?: string | null,"request_started_at"?: number | null,"status"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_card_mandates": {
                  Row: {
                    "account_id": string,"amount_minor": number,"billing_anchor_at": number,"cancel_at": number | null,"consent_at": number,"consent_request_id": string,"consent_version": string,"created_at": number,"currency": string,"cycle_index": number,"id": string,"interval_months": number,"next_billing_at": number,"org_id": string | null,"paid_through": number | null,"payment_method_id": string,"plan_version_id": string,"retry_count": number,"status": string,"updated_at": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount_minor": number,"billing_anchor_at": number,"cancel_at"?: number | null,"consent_at": number,"consent_request_id": string,"consent_version": string,"created_at": number,"currency": string,"cycle_index"?: number,"id": string,"interval_months"?: number,"next_billing_at": number,"org_id"?: string | null,"paid_through"?: number | null,"payment_method_id": string,"plan_version_id": string,"retry_count"?: number,"status"?: string,"updated_at": number,"user_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"amount_minor"?: number,"billing_anchor_at"?: number,"cancel_at"?: number | null,"consent_at"?: number,"consent_request_id"?: string,"consent_version"?: string,"created_at"?: number,"currency"?: string,"cycle_index"?: number,"id"?: string,"interval_months"?: number,"next_billing_at"?: number,"org_id"?: string | null,"paid_through"?: number | null,"payment_method_id"?: string,"plan_version_id"?: string,"retry_count"?: number,"status"?: string,"updated_at"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"billing_card_setups": {
                  Row: {
                    "account_id": string,"completed_at": number | null,"created_at": number,"expires_at": number,"id": string,"payment_method_id": string | null,"provider": string,"provider_ref": string | null,"request_key": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"completed_at"?: number | null,"created_at": number,"expires_at": number,"id": string,"payment_method_id"?: string | null,"provider": string,"provider_ref"?: string | null,"request_key": string,"status"?: string
                  }
                  Update: {
                    "account_id"?: string,"completed_at"?: number | null,"created_at"?: number,"expires_at"?: number,"id"?: string,"payment_method_id"?: string | null,"provider"?: string,"provider_ref"?: string | null,"request_key"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_checkouts": {
                  Row: {
                    "account_id": string | null,"completed_at": number | null,"created_at": number,"expires_at": number,"id": string,"org_id": string | null,"owner_kind": string,"plan_version_id": string,"provider": string,"provider_session_ref": string | null,"provider_subscription_ref": string | null,"quantity": number,"request_key": string | null,"started_by_account_id": string | null,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"completed_at"?: number | null,"created_at": number,"expires_at": number,"id": string,"org_id"?: string | null,"owner_kind"?: string,"plan_version_id": string,"provider": string,"provider_session_ref"?: string | null,"provider_subscription_ref"?: string | null,"quantity"?: number,"request_key"?: string | null,"started_by_account_id"?: string | null,"status": string,"user_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string | null,"completed_at"?: number | null,"created_at"?: number,"expires_at"?: number,"id"?: string,"org_id"?: string | null,"owner_kind"?: string,"plan_version_id"?: string,"provider"?: string,"provider_session_ref"?: string | null,"provider_subscription_ref"?: string | null,"quantity"?: number,"request_key"?: string | null,"started_by_account_id"?: string | null,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_checkouts_fk_0"
      columns: ["plan_version_id"]
isOneToOne: false
      referencedRelation: "billing_plan_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_commerce_orders": {
                  Row: {
                    "account_id": string,"coupon_id": string | null,"created_at": number,"currency": string,"discount_minor": number,"entitlement_status": string,"id": string,"metadata": string,"product": string,"product_ref": string,"provider": string,"purchase_ref": string,"status": string,"subtotal_minor": number,"tax_minor": number,"tax_status": string,"total_minor": number,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"coupon_id"?: string | null,"created_at": number,"currency": string,"discount_minor"?: number,"entitlement_status"?: string,"id": string,"metadata"?: string,"product": string,"product_ref": string,"provider": string,"purchase_ref": string,"status": string,"subtotal_minor": number,"tax_minor"?: number,"tax_status"?: string,"total_minor": number,"updated_at": number
                  }
                  Update: {
                    "account_id"?: string,"coupon_id"?: string | null,"created_at"?: number,"currency"?: string,"discount_minor"?: number,"entitlement_status"?: string,"id"?: string,"metadata"?: string,"product"?: string,"product_ref"?: string,"provider"?: string,"purchase_ref"?: string,"status"?: string,"subtotal_minor"?: number,"tax_minor"?: number,"tax_status"?: string,"total_minor"?: number,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_coupon_uses": {
                  Row: {
                    "account_id": string,"coupon_id": string,"created_at": number,"id": string,"order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"coupon_id": string,"created_at": number,"id": string,"order_id": string
                  }
                  Update: {
                    "account_id"?: string,"coupon_id"?: string,"created_at"?: number,"id"?: string,"order_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_coupons": {
                  Row: {
                    "code_hash": string,"created_at": number,"currency": string,"enabled": number,"ends_at": number,"id": string,"kind": string,"max_redemptions": number,"product": string,"starts_at": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"created_at": number,"currency"?: string,"enabled"?: number,"ends_at": number,"id": string,"kind": string,"max_redemptions": number,"product": string,"starts_at": number,"value": number
                  }
                  Update: {
                    "code_hash"?: string,"created_at"?: number,"currency"?: string,"enabled"?: number,"ends_at"?: number,"id"?: string,"kind"?: string,"max_redemptions"?: number,"product"?: string,"starts_at"?: number,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_customers": {
                  Row: {
                    "created_at": number,"id": string,"owner_id": string,"owner_kind": string,"provider": string,"provider_customer_ref": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"id": string,"owner_id": string,"owner_kind": string,"provider": string,"provider_customer_ref": string
                  }
                  Update: {
                    "created_at"?: number,"id"?: string,"owner_id"?: string,"owner_kind"?: string,"provider"?: string,"provider_customer_ref"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_grant_notes": {
                  Row: {
                    "ended_at": number | null,"ended_by": string | null,"grant_id": string,"granted_by": string | null,"note": string | null,"original_ends_at": number | null,"original_starts_at": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at"?: number | null,"ended_by"?: string | null,"grant_id": string,"granted_by"?: string | null,"note"?: string | null,"original_ends_at"?: number | null,"original_starts_at"?: number | null
                  }
                  Update: {
                    "ended_at"?: number | null,"ended_by"?: string | null,"grant_id"?: string,"granted_by"?: string | null,"note"?: string | null,"original_ends_at"?: number | null,"original_starts_at"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"billing_grants": {
                  Row: {
                    "account_id": string,"created_at": number,"ends_at": number,"id": string,"once_key": string | null,"plan_key": string,"reference": string | null,"source": string,"starts_at": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at": number,"ends_at": number,"id": string,"once_key"?: string | null,"plan_key": string,"reference"?: string | null,"source": string,"starts_at": number,"user_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: number,"ends_at"?: number,"id"?: string,"once_key"?: string | null,"plan_key"?: string,"reference"?: string | null,"source"?: string,"starts_at"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"billing_invoices": {
                  Row: {
                    "account_id": string | null,"amount_due_minor": number,"amount_paid_minor": number,"amount_refunded_minor": number,"currency": string,"id": string,"issued_at": number,"org_id": string | null,"owner_kind": string,"paid_at": number | null,"period_end": number | null,"period_start": number | null,"provider": string,"provider_invoice_ref": string,"provider_updated_at": number,"status": string,"subscription_id": string | null,"tax_minor": number | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount_due_minor": number,"amount_paid_minor"?: number,"amount_refunded_minor"?: number,"currency": string,"id": string,"issued_at": number,"org_id"?: string | null,"owner_kind"?: string,"paid_at"?: number | null,"period_end"?: number | null,"period_start"?: number | null,"provider": string,"provider_invoice_ref": string,"provider_updated_at": number,"status": string,"subscription_id"?: string | null,"tax_minor"?: number | null,"updated_at": number
                  }
                  Update: {
                    "account_id"?: string | null,"amount_due_minor"?: number,"amount_paid_minor"?: number,"amount_refunded_minor"?: number,"currency"?: string,"id"?: string,"issued_at"?: number,"org_id"?: string | null,"owner_kind"?: string,"paid_at"?: number | null,"period_end"?: number | null,"period_start"?: number | null,"provider"?: string,"provider_invoice_ref"?: string,"provider_updated_at"?: number,"status"?: string,"subscription_id"?: string | null,"tax_minor"?: number | null,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_notification_jobs": {
                  Row: {
                    "account_id": string | null,"attempts": number,"created_at": number,"dedupe_key": string,"gift_id": string | null,"id": string,"kind": string,"last_error": string | null,"lease_until": number | null,"next_attempt_at": number,"resource_id": string | null,"sent_at": number | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"attempts"?: number,"created_at": number,"dedupe_key": string,"gift_id"?: string | null,"id": string,"kind": string,"last_error"?: string | null,"lease_until"?: number | null,"next_attempt_at": number,"resource_id"?: string | null,"sent_at"?: number | null,"status"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"attempts"?: number,"created_at"?: number,"dedupe_key"?: string,"gift_id"?: string | null,"id"?: string,"kind"?: string,"last_error"?: string | null,"lease_until"?: number | null,"next_attempt_at"?: number,"resource_id"?: string | null,"sent_at"?: number | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_payment_actions": {
                  Row: {
                    "actor_account_id": string,"created_at": number,"id": string,"payment_ref": string,"provider": string,"provider_ref": string | null,"purchase_id": string,"reason": string,"status": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_account_id": string,"created_at": number,"id": string,"payment_ref": string,"provider": string,"provider_ref"?: string | null,"purchase_id": string,"reason": string,"status"?: string,"updated_at": number
                  }
                  Update: {
                    "actor_account_id"?: string,"created_at"?: number,"id"?: string,"payment_ref"?: string,"provider"?: string,"provider_ref"?: string | null,"purchase_id"?: string,"reason"?: string,"status"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_payment_methods": {
                  Row: {
                    "account_id": string,"brand": string,"created_at": number,"customer_encrypted": string,"expiry": string | null,"id": string,"last_four": string,"provider": string,"status": string,"token_encrypted": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"brand": string,"created_at": number,"customer_encrypted": string,"expiry"?: string | null,"id": string,"last_four": string,"provider": string,"status"?: string,"token_encrypted": string,"updated_at": number
                  }
                  Update: {
                    "account_id"?: string,"brand"?: string,"created_at"?: number,"customer_encrypted"?: string,"expiry"?: string | null,"id"?: string,"last_four"?: string,"provider"?: string,"status"?: string,"token_encrypted"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_plan_versions": {
                  Row: {
                    "amount_minor": number,"billing_frequency": number,"created_at": number,"created_by": string,"currency": string,"grace_days": number,"id": string,"interval": string,"limits": string,"notes": string,"plan_id": string,"provider": string | null,"provider_price_ref": string | null,"published_at": number | null,"published_by": string | null,"quota_plan_id": string | null,"retired_at": number | null,"trial_days": number,"updated_at": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"billing_frequency"?: number,"created_at": number,"created_by": string,"currency": string,"grace_days"?: number,"id": string,"interval": string,"limits"?: string,"notes"?: string,"plan_id": string,"provider"?: string | null,"provider_price_ref"?: string | null,"published_at"?: number | null,"published_by"?: string | null,"quota_plan_id"?: string | null,"retired_at"?: number | null,"trial_days"?: number,"updated_at": number,"version": number
                  }
                  Update: {
                    "amount_minor"?: number,"billing_frequency"?: number,"created_at"?: number,"created_by"?: string,"currency"?: string,"grace_days"?: number,"id"?: string,"interval"?: string,"limits"?: string,"notes"?: string,"plan_id"?: string,"provider"?: string | null,"provider_price_ref"?: string | null,"published_at"?: number | null,"published_by"?: string | null,"quota_plan_id"?: string | null,"retired_at"?: number | null,"trial_days"?: number,"updated_at"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_plan_versions_fk_0"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "billing_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_plans": {
                  Row: {
                    "audience": string,"created_at": number,"created_by": string,"description": string,"id": string,"key": string,"name": string,"public": number,"segment": string,"status": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"created_at": number,"created_by": string,"description"?: string,"id": string,"key": string,"name": string,"public"?: number,"segment"?: string,"status": string,"updated_at": number
                  }
                  Update: {
                    "audience"?: string,"created_at"?: number,"created_by"?: string,"description"?: string,"id"?: string,"key"?: string,"name"?: string,"public"?: number,"segment"?: string,"status"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_play_purchases": {
                  Row: {
                    "account_id": string,"acknowledged": number,"checked_at": number,"consumed": number,"created_at": number,"id": string,"kind": string,"product_id": string,"purchase_token": string,"reference": string | null,"state": string,"token_hash": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"acknowledged"?: number,"checked_at": number,"consumed"?: number,"created_at": number,"id": string,"kind": string,"product_id": string,"purchase_token": string,"reference"?: string | null,"state": string,"token_hash": string,"updated_at": number
                  }
                  Update: {
                    "account_id"?: string,"acknowledged"?: number,"checked_at"?: number,"consumed"?: number,"created_at"?: number,"id"?: string,"kind"?: string,"product_id"?: string,"purchase_token"?: string,"reference"?: string | null,"state"?: string,"token_hash"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_program": {
                  Row: {
                    "claim_window_days": number,"days": number,"enabled": number,"id": number,"plan_key": string,"referral_cap_days": number,"referral_days": number,"starts_at": number | null,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_window_days": number,"days": number,"enabled": number,"id": number,"plan_key": string,"referral_cap_days": number,"referral_days": number,"starts_at"?: number | null,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "claim_window_days"?: number,"days"?: number,"enabled"?: number,"id"?: number,"plan_key"?: string,"referral_cap_days"?: number,"referral_days"?: number,"starts_at"?: number | null,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_promotion_events": {
                  Row: {
                    "account_id": string,"at": number,"campaign_id": string,"id": string,"impression_id": string | null,"presentation": string,"session_id": string,"type": string,"variant": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"at": number,"campaign_id": string,"id": string,"impression_id"?: string | null,"presentation": string,"session_id": string,"type": string,"variant"?: string
                  }
                  Update: {
                    "account_id"?: string,"at"?: number,"campaign_id"?: string,"id"?: string,"impression_id"?: string | null,"presentation"?: string,"session_id"?: string,"type"?: string,"variant"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_promotion_redemptions": {
                  Row: {
                    "account_id": string,"code": string,"grant_id": string,"redeemed_at": number,"state": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"code": string,"grant_id": string,"redeemed_at": number,"state"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string,"code"?: string,"grant_id"?: string,"redeemed_at"?: number,"state"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_promotion_settings": {
                  Row: {
                    "id": number,"revision": number,"settings": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": number,"revision": number,"settings": string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "id"?: number,"revision"?: number,"settings"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_promotion_state": {
                  Row: {
                    "account_id": string,"dismissed_at": number | null,"history": string,"opt_out": number,"revision": number,"sessions": string,"snoozed_until": number,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"dismissed_at"?: number | null,"history"?: string,"opt_out"?: number,"revision"?: number,"sessions"?: string,"snoozed_until"?: number,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "account_id"?: string,"dismissed_at"?: number | null,"history"?: string,"opt_out"?: number,"revision"?: number,"sessions"?: string,"snoozed_until"?: number,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_promotions": {
                  Row: {
                    "code": string,"created_at": number,"discount_percent": number,"enabled": number,"ends_at": number,"max_redemptions": number,"months": number,"product": string,"redeemed": number,"starts_at": number,"title": string,"updated_at": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at": number,"discount_percent"?: number,"enabled"?: number,"ends_at": number,"max_redemptions": number,"months": number,"product"?: string,"redeemed"?: number,"starts_at": number,"title": string,"updated_at": number,"version"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: number,"discount_percent"?: number,"enabled"?: number,"ends_at"?: number,"max_redemptions"?: number,"months"?: number,"product"?: string,"redeemed"?: number,"starts_at"?: number,"title"?: string,"updated_at"?: number,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_provider_events": {
                  Row: {
                    "attempts": number,"event_ref": string,"id": string,"last_error": string | null,"next_attempt_at": number | null,"processed_at": number | null,"provider": string,"provider_created_at": number,"received_at": number,"status": string,"subscription_id": string | null,"summary": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"event_ref": string,"id": string,"last_error"?: string | null,"next_attempt_at"?: number | null,"processed_at"?: number | null,"provider": string,"provider_created_at": number,"received_at": number,"status": string,"subscription_id"?: string | null,"summary": string,"type": string
                  }
                  Update: {
                    "attempts"?: number,"event_ref"?: string,"id"?: string,"last_error"?: string | null,"next_attempt_at"?: number | null,"processed_at"?: number | null,"provider"?: string,"provider_created_at"?: number,"received_at"?: number,"status"?: string,"subscription_id"?: string | null,"summary"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_referral_codes": {
                  Row: {
                    "account_id": string,"code": string,"created_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"code": string,"created_at": number
                  }
                  Update: {
                    "account_id"?: string,"code"?: string,"created_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_referrals": {
                  Row: {
                    "code": string,"created_at": number,"id": string,"invitee_account_id": string,"inviter_account_id": string,"inviter_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at": number,"id": string,"invitee_account_id": string,"inviter_account_id": string,"inviter_days": number
                  }
                  Update: {
                    "code"?: string,"created_at"?: number,"id"?: string,"invitee_account_id"?: string,"inviter_account_id"?: string,"inviter_days"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_subscription_history": {
                  Row: {
                    "at": number,"detail": string | null,"from_status": string | null,"id": number,"plan_version_id": string,"source": string,"subscription_id": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"detail"?: string | null,"from_status"?: string | null,"id": number,"plan_version_id": string,"source": string,"subscription_id": string,"to_status": string
                  }
                  Update: {
                    "at"?: number,"detail"?: string | null,"from_status"?: string | null,"id"?: number,"plan_version_id"?: string,"source"?: string,"subscription_id"?: string,"to_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_subscriptions": {
                  Row: {
                    "account_id": string | null,"billing_account_id": string | null,"billing_user_id": string | null,"cancel_at_period_end": number,"canceled_at": number | null,"checkout_id": string | null,"created_at": number,"current_period_end": number | null,"current_period_start": number | null,"id": string,"org_id": string | null,"owner_kind": string,"owner_user_id": string | null,"past_due_since": number | null,"plan_version_id": string,"provider": string,"provider_customer_ref": string | null,"provider_subscription_ref": string,"provider_updated_at": number,"quantity": number,"status": string,"trial_end": number | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"billing_account_id"?: string | null,"billing_user_id"?: string | null,"cancel_at_period_end"?: number,"canceled_at"?: number | null,"checkout_id"?: string | null,"created_at": number,"current_period_end"?: number | null,"current_period_start"?: number | null,"id": string,"org_id"?: string | null,"owner_kind"?: string,"owner_user_id"?: string | null,"past_due_since"?: number | null,"plan_version_id": string,"provider": string,"provider_customer_ref"?: string | null,"provider_subscription_ref": string,"provider_updated_at": number,"quantity"?: number,"status": string,"trial_end"?: number | null,"updated_at": number
                  }
                  Update: {
                    "account_id"?: string | null,"billing_account_id"?: string | null,"billing_user_id"?: string | null,"cancel_at_period_end"?: number,"canceled_at"?: number | null,"checkout_id"?: string | null,"created_at"?: number,"current_period_end"?: number | null,"current_period_start"?: number | null,"id"?: string,"org_id"?: string | null,"owner_kind"?: string,"owner_user_id"?: string | null,"past_due_since"?: number | null,"plan_version_id"?: string,"provider"?: string,"provider_customer_ref"?: string | null,"provider_subscription_ref"?: string,"provider_updated_at"?: number,"quantity"?: number,"status"?: string,"trial_end"?: number | null,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_subscriptions_fk_0"
      columns: ["plan_version_id"]
isOneToOne: false
      referencedRelation: "billing_plan_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_webhook_rejections": {
                  Row: {
                    "count": number,"day": string,"provider": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count": number,"day": string,"provider": string,"reason": string
                  }
                  Update: {
                    "count"?: number,"day"?: string,"provider"?: string,"reason"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bot_afk": {
                  Row: {
                    "notified": string,"org_id": string,"reason": string,"since": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "notified"?: string,"org_id": string,"reason": string,"since": number,"user_id": string
                  }
                  Update: {
                    "notified"?: string,"org_id"?: string,"reason"?: string,"since"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_afk_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_alert_watches": {
                  Row: {
                    "channel_id": string,"checked_at": number | null,"created_at": number,"created_by": string,"creator": string,"id": string,"message": string | null,"org_id": string,"role_id": string | null,"seen": string,"source": string,"uploads_id": string,"yt_channel_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"checked_at"?: number | null,"created_at": number,"created_by": string,"creator": string,"id": string,"message"?: string | null,"org_id": string,"role_id"?: string | null,"seen"?: string,"source": string,"uploads_id": string,"yt_channel_id": string
                  }
                  Update: {
                    "channel_id"?: string,"checked_at"?: number | null,"created_at"?: number,"created_by"?: string,"creator"?: string,"id"?: string,"message"?: string | null,"org_id"?: string,"role_id"?: string | null,"seen"?: string,"source"?: string,"uploads_id"?: string,"yt_channel_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_alert_watches_fk_0"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bot_alert_watches_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_giveaways": {
                  Row: {
                    "channel_id": string,"created_at": number,"ended_at": number | null,"ends_at": number,"entrants": number,"host_id": string,"id": string,"message_id": string | null,"org_id": string,"prize": string,"required_role_id": string | null,"winner_ids": string,"winners": number
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"created_at": number,"ended_at"?: number | null,"ends_at": number,"entrants"?: number,"host_id": string,"id": string,"message_id"?: string | null,"org_id": string,"prize": string,"required_role_id"?: string | null,"winner_ids"?: string,"winners": number
                  }
                  Update: {
                    "channel_id"?: string,"created_at"?: number,"ended_at"?: number | null,"ends_at"?: number,"entrants"?: number,"host_id"?: string,"id"?: string,"message_id"?: string | null,"org_id"?: string,"prize"?: string,"required_role_id"?: string | null,"winner_ids"?: string,"winners"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_giveaways_fk_0"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bot_giveaways_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_interactions": {
                  Row: {
                    "bot_id": string,"command": string,"conversation_id": string,"created_at": number,"delivered_at": number | null,"expires_at": number,"id": string,"options": NonNullable<Json>,"org_id": string,"replied_at": number | null,"state": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bot_id": string,"command": string,"conversation_id": string,"created_at": number,"delivered_at"?: number | null,"expires_at": number,"id": string,"options": NonNullable<Json>,"org_id": string,"replied_at"?: number | null,"state": string,"user_id": string
                  }
                  Update: {
                    "bot_id"?: string,"command"?: string,"conversation_id"?: string,"created_at"?: number,"delivered_at"?: number | null,"expires_at"?: number,"id"?: string,"options"?: NonNullable<Json>,"org_id"?: string,"replied_at"?: number | null,"state"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_bot_interactions_fk_0"
      columns: ["bot_id"]
isOneToOne: false
      referencedRelation: "bots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_bot_interactions_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_bot_interactions_fk_2"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_bot_interactions_fk_3"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_levels": {
                  Row: {
                    "last_xp_at": number,"org_id": string,"user_id": string,"xp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_xp_at": number,"org_id": string,"user_id": string,"xp": number
                  }
                  Update: {
                    "last_xp_at"?: number,"org_id"?: string,"user_id"?: string,"xp"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_levels_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_listings": {
                  Row: {
                    "bot_id": string,"category": string,"description": string,"listed": number,"listed_at": number | null,"owner_id": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bot_id": string,"category": string,"description": string,"listed": number,"listed_at"?: number | null,"owner_id": string,"updated_at": number
                  }
                  Update: {
                    "bot_id"?: string,"category"?: string,"description"?: string,"listed"?: number,"listed_at"?: number | null,"owner_id"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"bot_runtime_events": {
                  Row: {
                    "at": number,"bot_key": string,"id": string,"kind": string,"org_id": string,"outcome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"bot_key": string,"id": string,"kind": string,"org_id": string,"outcome": string
                  }
                  Update: {
                    "at"?: number,"bot_key"?: string,"id"?: string,"kind"?: string,"org_id"?: string,"outcome"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_runtime_events_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_starboard": {
                  Row: {
                    "channel_id": string,"created_at": number,"message_id": string,"org_id": string,"star_channel_id": string,"star_message_id": string | null,"stars": number
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"created_at": number,"message_id": string,"org_id": string,"star_channel_id": string,"star_message_id"?: string | null,"stars": number
                  }
                  Update: {
                    "channel_id"?: string,"created_at"?: number,"message_id"?: string,"org_id"?: string,"star_channel_id"?: string,"star_message_id"?: string | null,"stars"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_starboard_fk_0"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bot_starboard_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_wordy_games": {
                  Row: {
                    "day": string,"finished_at": number | null,"guesses": string,"org_id": string,"solved": number,"started_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"finished_at"?: number | null,"guesses"?: string,"org_id": string,"solved"?: number,"started_at": number,"user_id": string
                  }
                  Update: {
                    "day"?: string,"finished_at"?: number | null,"guesses"?: string,"org_id"?: string,"solved"?: number,"started_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_wordy_games_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_wordy_recaps": {
                  Row: {
                    "day": string,"org_id": string,"posted_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"org_id": string,"posted_at": number
                  }
                  Update: {
                    "day"?: string,"org_id"?: string,"posted_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_wordy_recaps_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bot_wordy_stats": {
                  Row: {
                    "best_streak": number,"distribution": string,"last_day": string,"last_won_day": string | null,"org_id": string,"played": number,"streak": number,"user_id": string,"won": number
                  }
                  ComputedFields: never
                  Insert: {
                    "best_streak": number,"distribution": string,"last_day": string,"last_won_day"?: string | null,"org_id": string,"played": number,"streak": number,"user_id": string,"won": number
                  }
                  Update: {
                    "best_streak"?: number,"distribution"?: string,"last_day"?: string,"last_won_day"?: string | null,"org_id"?: string,"played"?: number,"streak"?: number,"user_id"?: string,"won"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bot_wordy_stats_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bots": {
                  Row: {
                    "commands": NonNullable<Json>,"created_at": number,"id": string,"owner_id": string,"public": boolean,"token_hash": string,"token_rotated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "commands": NonNullable<Json>,"created_at": number,"id": string,"owner_id": string,"public": boolean,"token_hash": string,"token_rotated_at": number
                  }
                  Update: {
                    "commands"?: NonNullable<Json>,"created_at"?: number,"id"?: string,"owner_id"?: string,"public"?: boolean,"token_hash"?: string,"token_rotated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_bots_fk_0"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_bots_fk_1"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"branch_members": {
                  Row: {
                    "branch_id": string,"joined_at": number,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"joined_at": number,"role": string,"user_id": string
                  }
                  Update: {
                    "branch_id"?: string,"joined_at"?: number,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "branch_members_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "branch_members_fk_1"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "archived_at": number | null,"created_at": number,"description": string | null,"id": string,"location": string | null,"name": string,"org_id": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: number | null,"created_at": number,"description"?: string | null,"id": string,"location"?: string | null,"name": string,"org_id": string,"updated_at": number
                  }
                  Update: {
                    "archived_at"?: number | null,"created_at"?: number,"description"?: string | null,"id"?: string,"location"?: string | null,"name"?: string,"org_id"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "branches_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"bug_reports": {
                  Row: {
                    "client": string | null,"created_at": number,"details": string,"id": string,"page": string | null,"staff_note": string | null,"status": string,"summary": string,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client"?: string | null,"created_at": number,"details": string,"id": string,"page"?: string | null,"staff_note"?: string | null,"status"?: string,"summary": string,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "client"?: string | null,"created_at"?: number,"details"?: string,"id"?: string,"page"?: string | null,"staff_note"?: string | null,"status"?: string,"summary"?: string,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bug_reports_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"call_hands": {
                  Row: {
                    "call_id": string,"raised_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "call_id": string,"raised_at": number,"user_id": string
                  }
                  Update: {
                    "call_id"?: string,"raised_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "call_hands_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "call_hands_fk_1"
      columns: ["call_id"]
isOneToOne: false
      referencedRelation: "calls"
      referencedColumns: ["id"]
    }
                  ]
                },"call_participants": {
                  Row: {
                    "call_id": string,"device_id": string,"joined_at": number,"left_at": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "call_id": string,"device_id": string,"joined_at": number,"left_at"?: number | null,"user_id": string
                  }
                  Update: {
                    "call_id"?: string,"device_id"?: string,"joined_at"?: number,"left_at"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "call_participants_fk_0"
      columns: ["call_id"]
isOneToOne: false
      referencedRelation: "calls"
      referencedColumns: ["id"]
    }
                  ]
                },"calls": {
                  Row: {
                    "alerted_at": number | null,"answered_at": number | null,"conversation_id": string,"created_at": number,"created_by": string,"end_reason": string | null,"ended_at": number | null,"host_server_id": string | null,"id": string,"room": number,"room_name": string,"state": string,"video": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alerted_at"?: number | null,"answered_at"?: number | null,"conversation_id": string,"created_at": number,"created_by": string,"end_reason"?: string | null,"ended_at"?: number | null,"host_server_id"?: string | null,"id": string,"room"?: number,"room_name": string,"state": string,"video"?: number
                  }
                  Update: {
                    "alerted_at"?: number | null,"answered_at"?: number | null,"conversation_id"?: string,"created_at"?: number,"created_by"?: string,"end_reason"?: string | null,"ended_at"?: number | null,"host_server_id"?: string | null,"id"?: string,"room"?: number,"room_name"?: string,"state"?: string,"video"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "calls_fk_0"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calls_fk_1"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_categories": {
                  Row: {
                    "created_at": number,"created_by": string,"id": string,"name": string,"org_id": string,"position": number,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by": string,"id": string,"name": string,"org_id": string,"position": number,"updated_at": number
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string,"id"?: string,"name"?: string,"org_id"?: string,"position"?: number,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_categories_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_options": {
                  Row: {
                    "conversation_id": string,"no_gifs": number,"org_id": string,"poster_role_ids": string,"read_only": number,"stage": number,"text_only": number,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"no_gifs"?: number,"org_id": string,"poster_role_ids"?: string,"read_only"?: number,"stage"?: number,"text_only"?: number,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "conversation_id"?: string,"no_gifs"?: number,"org_id"?: string,"poster_role_ids"?: string,"read_only"?: number,"stage"?: number,"text_only"?: number,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_options_fk_0"
      columns: ["conversation_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_overwrites": {
                  Row: {
                    "allow": string,"deny": string,"org_id": string,"subject": string,"target_id": string,"target_type": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow": string,"deny": string,"org_id": string,"subject": string,"target_id": string,"target_type": string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "allow"?: string,"deny"?: string,"org_id"?: string,"subject"?: string,"target_id"?: string,"target_type"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_overwrites_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_webhooks": {
                  Row: {
                    "avatar_rev": number | null,"channel_id": string,"created_at": number,"created_by": string,"id": string,"last_used_at": number | null,"name": string,"org_id": string,"token_hash": string,"token_rotated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_rev"?: number | null,"channel_id": string,"created_at": number,"created_by": string,"id": string,"last_used_at"?: number | null,"name": string,"org_id": string,"token_hash": string,"token_rotated_at": number,"user_id": string
                  }
                  Update: {
                    "avatar_rev"?: number | null,"channel_id"?: string,"created_at"?: number,"created_by"?: string,"id"?: string,"last_used_at"?: number | null,"name"?: string,"org_id"?: string,"token_hash"?: string,"token_rotated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_webhooks_fk_0"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channel_webhooks_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"collectible_orders": {
                  Row: {
                    "account_id": string | null,"amount_minor": number,"checkout_url": string | null,"created_at": number,"currency": string,"expires_at": number,"id": string,"item_id": string,"item_version": number,"original_amount_minor": number,"payment_ref": string | null,"promotion_code": string | null,"provider": string,"request_key": string,"session_ref": string | null,"status": string,"sync_status": string,"updated_at": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount_minor": number,"checkout_url"?: string | null,"created_at": number,"currency": string,"expires_at": number,"id": string,"item_id": string,"item_version": number,"original_amount_minor": number,"payment_ref"?: string | null,"promotion_code"?: string | null,"provider": string,"request_key": string,"session_ref"?: string | null,"status"?: string,"sync_status"?: string,"updated_at": number,"user_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string | null,"amount_minor"?: number,"checkout_url"?: string | null,"created_at"?: number,"currency"?: string,"expires_at"?: number,"id"?: string,"item_id"?: string,"item_version"?: number,"original_amount_minor"?: number,"payment_ref"?: string | null,"promotion_code"?: string | null,"provider"?: string,"request_key"?: string,"session_ref"?: string | null,"status"?: string,"sync_status"?: string,"updated_at"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"community_discovery": {
                  Row: {
                    "blurb": string | null,"discoverable": number,"official": number,"org_id": string,"removed_at": number | null,"removed_reason": string | null,"tags": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blurb"?: string | null,"discoverable"?: number,"official"?: number,"org_id": string,"removed_at"?: number | null,"removed_reason"?: string | null,"tags"?: string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "blurb"?: string | null,"discoverable"?: number,"official"?: number,"org_id"?: string,"removed_at"?: number | null,"removed_reason"?: string | null,"tags"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_discovery_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_expressions": {
                  Row: {
                    "animated": number,"created_at": number,"created_by": string,"id": string,"kind": string,"mime": string,"name": string,"org_id": string,"sha256": string,"size": number
                  }
                  ComputedFields: never
                  Insert: {
                    "animated"?: number,"created_at": number,"created_by": string,"id": string,"kind": string,"mime": string,"name": string,"org_id": string,"sha256": string,"size": number
                  }
                  Update: {
                    "animated"?: number,"created_at"?: number,"created_by"?: string,"id"?: string,"kind"?: string,"mime"?: string,"name"?: string,"org_id"?: string,"sha256"?: string,"size"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_expressions_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_lobbies": {
                  Row: {
                    "org_id": string,"rev": number,"settings": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "org_id": string,"rev": number,"settings": string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "org_id"?: string,"rev"?: number,"settings"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_lobbies_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_lobby_feeds": {
                  Row: {
                    "created_at": number,"created_by": string,"last_post_at": number | null,"org_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by": string,"last_post_at"?: number | null,"org_id": string,"token_hash": string
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string,"last_post_at"?: number | null,"org_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_lobby_feeds_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_lobby_posts": {
                  Row: {
                    "id": string,"image": string | null,"org_id": string,"posted_at": number,"text": string | null,"title": string | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"image"?: string | null,"org_id": string,"posted_at": number,"text"?: string | null,"title"?: string | null,"url"?: string | null
                  }
                  Update: {
                    "id"?: string,"image"?: string | null,"org_id"?: string,"posted_at"?: number,"text"?: string | null,"title"?: string | null,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_lobby_posts_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_lobby_seen": {
                  Row: {
                    "org_id": string,"seen_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "org_id": string,"seen_at": number,"user_id": string
                  }
                  Update: {
                    "org_id"?: string,"seen_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_lobby_seen_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_member_defaults": {
                  Row: {
                    "added": string,"org_id": string,"removed": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added": string,"org_id": string,"removed": string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "added"?: string,"org_id"?: string,"removed"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_member_defaults_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_migration_runs": {
                  Row: {
                    "category_id": string | null,"channels": number,"converted_at": number,"members": number,"org_id": string,"role_id": string | null,"source_id": string,"source_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"channels": number,"converted_at": number,"members": number,"org_id": string,"role_id"?: string | null,"source_id": string,"source_type": string
                  }
                  Update: {
                    "category_id"?: string | null,"channels"?: number,"converted_at"?: number,"members"?: number,"org_id"?: string,"role_id"?: string | null,"source_id"?: string,"source_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"community_onboarding": {
                  Row: {
                    "enabled": number,"org_id": string,"prompts": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: number,"org_id": string,"prompts": string,"updated_at": number
                  }
                  Update: {
                    "enabled"?: number,"org_id"?: string,"prompts"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_onboarding_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_pin_awards": {
                  Row: {
                    "awarded_at": number,"awarded_by": string,"id": string,"org_id": string,"pin_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "awarded_at": number,"awarded_by": string,"id": string,"org_id": string,"pin_id": string,"user_id": string
                  }
                  Update: {
                    "awarded_at"?: number,"awarded_by"?: string,"id"?: string,"org_id"?: string,"pin_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_community_pin_awards_fk_0"
      columns: ["pin_id"]
isOneToOne: false
      referencedRelation: "community_pins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_community_pin_awards_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_community_pin_awards_fk_2"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"community_pins": {
                  Row: {
                    "animated": boolean,"created_at": number,"created_by": string,"description": string | null,"format": string,"id": string,"name": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "animated": boolean,"created_at": number,"created_by": string,"description"?: string | null,"format": string,"id": string,"name": string,"org_id": string
                  }
                  Update: {
                    "animated"?: boolean,"created_at"?: number,"created_by"?: string,"description"?: string | null,"format"?: string,"id"?: string,"name"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_community_pins_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_profiles": {
                  Row: {
                    "org_id": string,"profile": string,"rev": number,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "org_id": string,"profile": string,"rev"?: number,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "org_id"?: string,"profile"?: string,"rev"?: number,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_profiles_fk_0"
      columns: ["org_id","user_id"]
isOneToOne: true
      referencedRelation: "org_members"
      referencedColumns: ["org_id","user_id"]
    }
                  ]
                },"community_rule_agreements": {
                  Row: {
                    "agreed_at": number,"id": string,"org_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_at": number,"id": string,"org_id": string,"user_id": string
                  }
                  Update: {
                    "agreed_at"?: number,"id"?: string,"org_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_community_rule_agreements_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_community_rule_agreements_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"community_rules": {
                  Row: {
                    "channel_id": string | null,"id": string,"required": boolean,"rules": NonNullable<Json>,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id"?: string | null,"id": string,"required": boolean,"rules": NonNullable<Json>,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "channel_id"?: string | null,"id"?: string,"required"?: boolean,"rules"?: NonNullable<Json>,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_community_rules_fk_1"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_safety": {
                  Row: {
                    "lock_reason": string | null,"locked_by": string | null,"locked_until": number | null,"new_account_gate": string,"org_id": string,"raid_protection": number,"updated_at": number,"updated_by": string | null,"verification_level": string
                  }
                  ComputedFields: never
                  Insert: {
                    "lock_reason"?: string | null,"locked_by"?: string | null,"locked_until"?: number | null,"new_account_gate"?: string,"org_id": string,"raid_protection"?: number,"updated_at": number,"updated_by"?: string | null,"verification_level"?: string
                  }
                  Update: {
                    "lock_reason"?: string | null,"locked_by"?: string | null,"locked_until"?: number | null,"new_account_gate"?: string,"org_id"?: string,"raid_protection"?: number,"updated_at"?: number,"updated_by"?: string | null,"verification_level"?: string
                  }
                  Relationships: [
                    
                  ]
                },"community_settings": {
                  Row: {
                    "background": string | null,"links": string,"onboarding_required": number,"onboarding_required_since": number | null,"org_id": string,"start_channel_id": string | null,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "background"?: string | null,"links"?: string,"onboarding_required"?: number,"onboarding_required_since"?: number | null,"org_id": string,"start_channel_id"?: string | null,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "background"?: string | null,"links"?: string,"onboarding_required"?: number,"onboarding_required_since"?: number | null,"org_id"?: string,"start_channel_id"?: string | null,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_settings_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_standard_invites": {
                  Row: {
                    "code": string,"invite_id": string,"org_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"invite_id": string,"org_id": string,"user_id": string
                  }
                  Update: {
                    "code"?: string,"invite_id"?: string,"org_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_standard_invites_fk_0"
      columns: ["invite_id"]
isOneToOne: false
      referencedRelation: "invitations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_standard_invites_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_templates": {
                  Row: {
                    "code": string,"created_at": number,"created_by": string,"id": string,"name": string,"org_id": string,"snapshot": string,"updated_at": number,"updated_by": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at": number,"created_by": string,"id": string,"name": string,"org_id": string,"snapshot": string,"updated_at": number,"updated_by": string,"uses"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: number,"created_by"?: string,"id"?: string,"name"?: string,"org_id"?: string,"snapshot"?: string,"updated_at"?: number,"updated_by"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_templates_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_tickets": {
                  Row: {
                    "enabled": number,"max_open": number,"next_number": number,"org_id": string,"poster_id": string | null,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled": number,"max_open": number,"next_number"?: number,"org_id": string,"poster_id"?: string | null,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "enabled"?: number,"max_open"?: number,"next_number"?: number,"org_id"?: string,"poster_id"?: string | null,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_tickets_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_vanity_invites": {
                  Row: {
                    "claimed_at": number,"claimed_by": string,"invite_id": string,"org_id": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at": number,"claimed_by": string,"invite_id": string,"org_id": string,"slug": string
                  }
                  Update: {
                    "claimed_at"?: number,"claimed_by"?: string,"invite_id"?: string,"org_id"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_vanity_invites_fk_0"
      columns: ["invite_id"]
isOneToOne: false
      referencedRelation: "invitations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_vanity_invites_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"community_voice_bans": {
                  Row: {
                    "banned_at": number,"banned_by": string,"org_id": string,"reason": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banned_at": number,"banned_by": string,"org_id": string,"reason"?: string | null,"user_id": string
                  }
                  Update: {
                    "banned_at"?: number,"banned_by"?: string,"org_id"?: string,"reason"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"community_voice_mutes": {
                  Row: {
                    "muted_at": number,"muted_by": string,"org_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "muted_at": number,"muted_by": string,"org_id": string,"user_id": string
                  }
                  Update: {
                    "muted_at"?: number,"muted_by"?: string,"org_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"connections": {
                  Row: {
                    "a": string,"accepted_at": number | null,"b": string,"created_at": number,"pair": string,"requested_by": string,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "a": string,"accepted_at"?: number | null,"b": string,"created_at": number,"pair": string,"requested_by": string,"state": string
                  }
                  Update: {
                    "a"?: string,"accepted_at"?: number | null,"b"?: string,"created_at"?: number,"pair"?: string,"requested_by"?: string,"state"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conversation_members": {
                  Row: {
                    "conversation_id": string,"joined_at": number,"last_post_at": number | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"joined_at": number,"last_post_at"?: number | null,"role": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"joined_at"?: number,"last_post_at"?: number | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_members_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_fk_1"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "archived_at": number | null,"auto_join": number,"category_id": string | null,"created_at": number,"created_by": string,"dm_key": string | null,"format": string,"forum_tags": string | null,"guidelines": string | null,"id": string,"kind": string | null,"name": string | null,"org_id": string | null,"photo_rev": number | null,"position": number,"scope": string | null,"scope_id": string | null,"slowmode_sec": number,"topic": string | null,"type": string,"updated_at": number,"voice": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: number | null,"auto_join"?: number,"category_id"?: string | null,"created_at": number,"created_by": string,"dm_key"?: string | null,"format"?: string,"forum_tags"?: string | null,"guidelines"?: string | null,"id": string,"kind"?: string | null,"name"?: string | null,"org_id"?: string | null,"photo_rev"?: number | null,"position"?: number,"scope"?: string | null,"scope_id"?: string | null,"slowmode_sec"?: number,"topic"?: string | null,"type": string,"updated_at": number,"voice"?: number
                  }
                  Update: {
                    "archived_at"?: number | null,"auto_join"?: number,"category_id"?: string | null,"created_at"?: number,"created_by"?: string,"dm_key"?: string | null,"format"?: string,"forum_tags"?: string | null,"guidelines"?: string | null,"id"?: string,"kind"?: string | null,"name"?: string | null,"org_id"?: string | null,"photo_rev"?: number | null,"position"?: number,"scope"?: string | null,"scope_id"?: string | null,"slowmode_sec"?: number,"topic"?: string | null,"type"?: string,"updated_at"?: number,"voice"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_fk_0"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "channel_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_fk_1"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_fk_2"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_posts": {
                  Row: {
                    "counted": boolean,"created_at": number,"id": string,"platform": string,"reviewed_at": number | null,"reviewed_by": string | null,"reward_note": string | null,"url": string,"user_id": string,"views": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "counted": boolean,"created_at": number,"id": string,"platform": string,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"reward_note"?: string | null,"url": string,"user_id": string,"views"?: number | null
                  }
                  Update: {
                    "counted"?: boolean,"created_at"?: number,"id"?: string,"platform"?: string,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"reward_note"?: string | null,"url"?: string,"user_id"?: string,"views"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_creator_posts_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_program": {
                  Row: {
                    "created_at": number,"id": string,"reason": string | null,"reviewed_at": number | null,"reviewed_by": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"id": string,"reason"?: string | null,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"status": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"id"?: string,"reason"?: string | null,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_creator_program_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_verifications": {
                  Row: {
                    "channel_name": string,"created_at": number,"id": string,"link": string,"notes": string | null,"platform": string,"proof_size": number,"proof_type": string,"reason": string | null,"reviewed_at": number | null,"reviewed_by": string | null,"status": string,"user_id": string,"username_at_approval": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_name": string,"created_at": number,"id": string,"link": string,"notes"?: string | null,"platform": string,"proof_size": number,"proof_type": string,"reason"?: string | null,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"status": string,"user_id": string,"username_at_approval"?: string | null
                  }
                  Update: {
                    "channel_name"?: string,"created_at"?: number,"id"?: string,"link"?: string,"notes"?: string | null,"platform"?: string,"proof_size"?: number,"proof_type"?: string,"reason"?: string | null,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"status"?: string,"user_id"?: string,"username_at_approval"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_creator_verifications_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"decoration_favorites": {
                  Row: {
                    "created_at": number,"decoration_id": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"decoration_id": string,"id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"decoration_id"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_decoration_favorites_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_queue": {
                  Row: {
                    "conversation_id": string,"created_at": number,"expires_at": number,"id": number,"kind": string,"message_id": string,"payload": string,"recipient_device_id": string,"sender_device_id": string,"sender_user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at": number,"expires_at": number,"id": number,"kind": string,"message_id": string,"payload": string,"recipient_device_id": string,"sender_device_id": string,"sender_user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: number,"expires_at"?: number,"id"?: number,"kind"?: string,"message_id"?: string,"payload"?: string,"recipient_device_id"?: string,"sender_device_id"?: string,"sender_user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"departments": {
                  Row: {
                    "branch_id": string,"created_at": number,"description": string | null,"id": string,"name": string,"org_id": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at": number,"description"?: string | null,"id": string,"name": string,"org_id": string,"updated_at": number
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: number,"description"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_fk_0"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "departments_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"devices": {
                  Row: {
                    "certificate": string,"created_at": number,"encryption_key": string,"id": string,"last_seen_at": number | null,"name": string,"revoked_at": number | null,"signing_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "certificate": string,"created_at": number,"encryption_key": string,"id": string,"last_seen_at"?: number | null,"name": string,"revoked_at"?: number | null,"signing_key": string,"user_id": string
                  }
                  Update: {
                    "certificate"?: string,"created_at"?: number,"encryption_key"?: string,"id"?: string,"last_seen_at"?: number | null,"name"?: string,"revoked_at"?: number | null,"signing_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"discord_connections": {
                  Row: {
                    "discord_user_id": string,"expires_at": number,"guild_id": string,"guild_name": string,"id": string,"user_id": string,"verified_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "discord_user_id": string,"expires_at": number,"guild_id": string,"guild_name": string,"id": string,"user_id": string,"verified_at": number
                  }
                  Update: {
                    "discord_user_id"?: string,"expires_at"?: number,"guild_id"?: string,"guild_name"?: string,"id"?: string,"user_id"?: string,"verified_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "discord_connections_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"discord_import_items": {
                  Row: {
                    "import_id": string,"kind": string,"name": string,"note": string | null,"position": number,"source_key": string,"spec": string,"status": string,"target_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "import_id": string,"kind": string,"name": string,"note"?: string | null,"position": number,"source_key": string,"spec": string,"status": string,"target_id"?: string | null
                  }
                  Update: {
                    "import_id"?: string,"kind"?: string,"name"?: string,"note"?: string | null,"position"?: number,"source_key"?: string,"spec"?: string,"status"?: string,"target_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "discord_import_items_fk_0"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "discord_imports"
      referencedColumns: ["id"]
    }
                  ]
                },"discord_imports": {
                  Row: {
                    "created_at": number,"error": string | null,"finished_at": number | null,"guild_id": string,"guild_name": string,"id": string,"new_name": string | null,"options": string,"org_id": string | null,"status": string,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"error"?: string | null,"finished_at"?: number | null,"guild_id": string,"guild_name": string,"id": string,"new_name"?: string | null,"options": string,"org_id"?: string | null,"status": string,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"error"?: string | null,"finished_at"?: number | null,"guild_id"?: string,"guild_name"?: string,"id"?: string,"new_name"?: string | null,"options"?: string,"org_id"?: string | null,"status"?: string,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "discord_imports_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "discord_imports_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"discord_oauth_states": {
                  Row: {
                    "created_at": number,"expires_at": number,"state_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"expires_at": number,"state_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"expires_at"?: number,"state_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "discord_oauth_states_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"discovery_boosts": {
                  Row: {
                    "created_at": number,"created_by": string,"ends_at": number,"id": string,"note": string | null,"org_id": string,"price_cents": number,"source": string,"starts_at": number,"state": string,"tier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by": string,"ends_at": number,"id": string,"note"?: string | null,"org_id": string,"price_cents": number,"source": string,"starts_at": number,"state": string,"tier": string
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string,"ends_at"?: number,"id"?: string,"note"?: string | null,"org_id"?: string,"price_cents"?: number,"source"?: string,"starts_at"?: number,"state"?: string,"tier"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "discovery_boosts_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"discovery_clicks": {
                  Row: {
                    "at": number,"org_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"org_id": string,"user_id": string
                  }
                  Update: {
                    "at"?: number,"org_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "discovery_clicks_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"discovery_visits": {
                  Row: {
                    "day": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"user_id": string
                  }
                  Update: {
                    "day"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"dm_requests": {
                  Row: {
                    "answered_at": number | null,"conversation_id": string,"created_at": number,"recipient": string,"sender": string,"sent": number,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: number | null,"conversation_id": string,"created_at": number,"recipient": string,"sender": string,"sent"?: number,"state": string
                  }
                  Update: {
                    "answered_at"?: number | null,"conversation_id"?: string,"created_at"?: number,"recipient"?: string,"sender"?: string,"sent"?: number,"state"?: string
                  }
                  Relationships: [
                    
                  ]
                },"document_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": number,"document_id": string,"id": string,"quote": string | null,"resolved_at": number | null,"resolved_by": string | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at": number,"document_id": string,"id": string,"quote"?: string | null,"resolved_at"?: number | null,"resolved_by"?: string | null,"updated_at": number
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: number,"document_id"?: string,"id"?: string,"quote"?: string | null,"resolved_at"?: number | null,"resolved_by"?: string | null,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_comments_fk_0"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"document_members": {
                  Row: {
                    "added_at": number,"added_by": string,"document_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at": number,"added_by": string,"document_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "added_at"?: number,"added_by"?: string,"document_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_members_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_members_fk_1"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"document_versions": {
                  Row: {
                    "author_id": string,"content": string,"created_at": number,"document_id": string,"id": string,"rev": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"content": string,"created_at": number,"document_id": string,"id": string,"rev": number,"title": string
                  }
                  Update: {
                    "author_id"?: string,"content"?: string,"created_at"?: number,"document_id"?: string,"id"?: string,"rev"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_versions_fk_0"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "access": string,"archived_at": number | null,"channel_id": string | null,"content": string,"created_at": number,"created_by": string,"default_role": string,"id": string,"org_id": string,"rev": number,"title": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access": string,"archived_at"?: number | null,"channel_id"?: string | null,"content": string,"created_at": number,"created_by": string,"default_role": string,"id": string,"org_id": string,"rev"?: number,"title": string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "access"?: string,"archived_at"?: number | null,"channel_id"?: string | null,"content"?: string,"created_at"?: number,"created_by"?: string,"default_role"?: string,"id"?: string,"org_id"?: string,"rev"?: number,"title"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_fk_0"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"fcm_tokens": {
                  Row: {
                    "created_at": number,"device_id": string,"failing_since": number | null,"last_wake_at": number | null,"token": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"device_id": string,"failing_since"?: number | null,"last_wake_at"?: number | null,"token": string,"updated_at": number
                  }
                  Update: {
                    "created_at"?: number,"device_id"?: string,"failing_since"?: number | null,"last_wake_at"?: number | null,"token"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fcm_tokens_fk_0"
      columns: ["device_id"]
isOneToOne: true
      referencedRelation: "devices"
      referencedColumns: ["id"]
    }
                  ]
                },"federation_blocks": {
                  Row: {
                    "created_at": number,"reason": string | null,"server_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"reason"?: string | null,"server_id": string
                  }
                  Update: {
                    "created_at"?: number,"reason"?: string | null,"server_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"federation_domains": {
                  Row: {
                    "domain": string,"server_id": string,"verified_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "domain": string,"server_id": string,"verified_at": number
                  }
                  Update: {
                    "domain"?: string,"server_id"?: string,"verified_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"federation_inbox": {
                  Row: {
                    "expires_at": number,"item_key": string,"peer_server_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": number,"item_key": string,"peer_server_id": string
                  }
                  Update: {
                    "expires_at"?: number,"item_key"?: string,"peer_server_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"federation_nonces": {
                  Row: {
                    "expires_at": number,"nonce": string,"peer_server_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": number,"nonce": string,"peer_server_id": string
                  }
                  Update: {
                    "expires_at"?: number,"nonce"?: string,"peer_server_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"federation_outbox": {
                  Row: {
                    "attempts": number,"body": string,"created_at": number,"expires_at": number,"id": number,"item_key": string,"kind": string,"last_error": string | null,"next_attempt_at": number,"peer_server_id": string,"size": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body": string,"created_at": number,"expires_at": number,"id": number,"item_key": string,"kind": string,"last_error"?: string | null,"next_attempt_at": number,"peer_server_id": string,"size": number
                  }
                  Update: {
                    "attempts"?: number,"body"?: string,"created_at"?: number,"expires_at"?: number,"id"?: number,"item_key"?: string,"kind"?: string,"last_error"?: string | null,"next_attempt_at"?: number,"peer_server_id"?: string,"size"?: number
                  }
                  Relationships: [
                    
                  ]
                },"federation_peers": {
                  Row: {
                    "agreeing": number,"descriptor": string,"domain": string,"final": string | null,"seq": number,"server_id": string,"state": string,"updated_at": number,"verified_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agreeing": number,"descriptor": string,"domain": string,"final"?: string | null,"seq": number,"server_id": string,"state": string,"updated_at": number,"verified_at": number
                  }
                  Update: {
                    "agreeing"?: number,"descriptor"?: string,"domain"?: string,"final"?: string | null,"seq"?: number,"server_id"?: string,"state"?: string,"updated_at"?: number,"verified_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"history_accounts": {
                  Row: {
                    "bytes": number,"items": number,"next_seq": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes": number,"items": number,"next_seq": number,"user_id": string
                  }
                  Update: {
                    "bytes"?: number,"items"?: number,"next_seq"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "history_accounts_fk_0"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"history_items": {
                  Row: {
                    "body": string | null,"conv_tag": string,"seq": number,"size": number,"tag": string,"ts": number,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"conv_tag": string,"seq": number,"size": number,"tag": string,"ts": number,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"conv_tag"?: string,"seq"?: number,"size"?: number,"tag"?: string,"ts"?: number,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "history_items_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"inbox_accounts": {
                  Row: {
                    "connected_by": string,"created_at": number,"external_id": string,"id": string,"last_error": string | null,"last_event_at": number | null,"live_key": string | null,"meta_json": string,"name": string,"org_id": string,"provider": string,"status": string,"token_expires_at": number | null,"token_sealed": string | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "connected_by": string,"created_at": number,"external_id": string,"id": string,"last_error"?: string | null,"last_event_at"?: number | null,"live_key"?: string | null,"meta_json"?: string,"name": string,"org_id": string,"provider": string,"status"?: string,"token_expires_at"?: number | null,"token_sealed"?: string | null,"updated_at": number
                  }
                  Update: {
                    "connected_by"?: string,"created_at"?: number,"external_id"?: string,"id"?: string,"last_error"?: string | null,"last_event_at"?: number | null,"live_key"?: string | null,"meta_json"?: string,"name"?: string,"org_id"?: string,"provider"?: string,"status"?: string,"token_expires_at"?: number | null,"token_sealed"?: string | null,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbox_accounts_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"inbox_contacts": {
                  Row: {
                    "account_id": string,"created_at": number,"display_name": string | null,"external_user_id": string,"id": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at": number,"display_name"?: string | null,"external_user_id": string,"id": string,"org_id": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: number,"display_name"?: string | null,"external_user_id"?: string,"id"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbox_contacts_fk_0"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "inbox_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbox_contacts_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"inbox_conversations": {
                  Row: {
                    "account_id": string,"assignee_id": string | null,"auto_replies_json": string,"contact_id": string,"created_at": number,"escalation_reason": string | null,"first_response_at": number | null,"handling": string,"id": string,"last_inbound_at": number | null,"last_message_at": number,"org_id": string,"priority": string,"provider": string,"queue_id": string | null,"resolved_at": number | null,"rev": number,"sla_notified_at": number | null,"status": string,"tags_json": string,"unread": number,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"assignee_id"?: string | null,"auto_replies_json"?: string,"contact_id": string,"created_at": number,"escalation_reason"?: string | null,"first_response_at"?: number | null,"handling"?: string,"id": string,"last_inbound_at"?: number | null,"last_message_at": number,"org_id": string,"priority"?: string,"provider": string,"queue_id"?: string | null,"resolved_at"?: number | null,"rev"?: number,"sla_notified_at"?: number | null,"status"?: string,"tags_json"?: string,"unread"?: number,"updated_at": number
                  }
                  Update: {
                    "account_id"?: string,"assignee_id"?: string | null,"auto_replies_json"?: string,"contact_id"?: string,"created_at"?: number,"escalation_reason"?: string | null,"first_response_at"?: number | null,"handling"?: string,"id"?: string,"last_inbound_at"?: number | null,"last_message_at"?: number,"org_id"?: string,"priority"?: string,"provider"?: string,"queue_id"?: string | null,"resolved_at"?: number | null,"rev"?: number,"sla_notified_at"?: number | null,"status"?: string,"tags_json"?: string,"unread"?: number,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbox_conversations_fk_0"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "inbox_contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbox_conversations_fk_1"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "inbox_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbox_conversations_fk_2"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"inbox_events": {
                  Row: {
                    "attempts": number,"error_kind": string | null,"id": string,"next_attempt_at": number,"payload_sealed": string,"provider": string,"received_at": number,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"error_kind"?: string | null,"id": string,"next_attempt_at": number,"payload_sealed": string,"provider": string,"received_at": number,"state"?: string
                  }
                  Update: {
                    "attempts"?: number,"error_kind"?: string | null,"id"?: string,"next_attempt_at"?: number,"payload_sealed"?: string,"provider"?: string,"received_at"?: number,"state"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inbox_messages": {
                  Row: {
                    "attachments_json": string,"attempts": number,"author_id": string | null,"body_sealed": string | null,"conversation_id": string,"created_at": number,"direction": string,"error_kind": string | null,"external_id": string | null,"id": string,"kind": string,"next_attempt_at": number | null,"org_id": string,"origin": string,"provider_ts": number | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments_json"?: string,"attempts"?: number,"author_id"?: string | null,"body_sealed"?: string | null,"conversation_id": string,"created_at": number,"direction": string,"error_kind"?: string | null,"external_id"?: string | null,"id": string,"kind"?: string,"next_attempt_at"?: number | null,"org_id": string,"origin"?: string,"provider_ts"?: number | null,"status": string
                  }
                  Update: {
                    "attachments_json"?: string,"attempts"?: number,"author_id"?: string | null,"body_sealed"?: string | null,"conversation_id"?: string,"created_at"?: number,"direction"?: string,"error_kind"?: string | null,"external_id"?: string | null,"id"?: string,"kind"?: string,"next_attempt_at"?: number | null,"org_id"?: string,"origin"?: string,"provider_ts"?: number | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbox_messages_fk_0"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "inbox_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"inbox_queues": {
                  Row: {
                    "created_at": number,"id": string,"members_json": string,"name": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"id": string,"members_json"?: string,"name": string,"org_id": string
                  }
                  Update: {
                    "created_at"?: number,"id"?: string,"members_json"?: string,"name"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbox_queues_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"inbox_settings": {
                  Row: {
                    "json": string,"org_id": string,"updated_at": number,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "json": string,"org_id": string,"updated_at": number,"updated_by"?: string | null
                  }
                  Update: {
                    "json"?: string,"org_id"?: string,"updated_at"?: number,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbox_settings_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_accounts": {
                  Row: {
                    "connector_id": string,"created_at": number,"external_id": string,"external_label": string | null,"id": string,"last_error": string | null,"last_error_at": number | null,"last_used_at": number | null,"last_validated_at": number | null,"meta": string,"owner_key": string,"owner_type": string,"rev": number,"scopes": string,"status": string,"updated_at": number,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connector_id": string,"created_at": number,"external_id": string,"external_label"?: string | null,"id": string,"last_error"?: string | null,"last_error_at"?: number | null,"last_used_at"?: number | null,"last_validated_at"?: number | null,"meta": string,"owner_key": string,"owner_type": string,"rev": number,"scopes": string,"status": string,"updated_at": number,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "connector_id"?: string,"created_at"?: number,"external_id"?: string,"external_label"?: string | null,"id"?: string,"last_error"?: string | null,"last_error_at"?: number | null,"last_used_at"?: number | null,"last_validated_at"?: number | null,"meta"?: string,"owner_key"?: string,"owner_type"?: string,"rev"?: number,"scopes"?: string,"status"?: string,"updated_at"?: number,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integration_channel_events": {
                  Row: {
                    "actor": string | null,"connector_id": string,"conversation_id": string,"created_at": number,"dedupe_key": string,"expires_at": number,"id": string,"kind": string,"occurred_at": number,"subscription_id": string,"summary": string | null,"title": string,"url": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"connector_id": string,"conversation_id": string,"created_at": number,"dedupe_key": string,"expires_at": number,"id": string,"kind": string,"occurred_at": number,"subscription_id": string,"summary"?: string | null,"title": string,"url"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "actor"?: string | null,"connector_id"?: string,"conversation_id"?: string,"created_at"?: number,"dedupe_key"?: string,"expires_at"?: number,"id"?: string,"kind"?: string,"occurred_at"?: number,"subscription_id"?: string,"summary"?: string | null,"title"?: string,"url"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integration_credentials": {
                  Row: {
                    "access_token": string,"account_id": string,"expires_at": number | null,"key_id": string,"refresh_token": string | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token": string,"account_id": string,"expires_at"?: number | null,"key_id": string,"refresh_token"?: string | null,"updated_at": number
                  }
                  Update: {
                    "access_token"?: string,"account_id"?: string,"expires_at"?: number | null,"key_id"?: string,"refresh_token"?: string | null,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"integration_deliveries": {
                  Row: {
                    "connector_id": string,"event": string,"expires_at": number,"id": string,"received_at": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connector_id": string,"event": string,"expires_at": number,"id": string,"received_at": number,"status": string
                  }
                  Update: {
                    "connector_id"?: string,"event"?: string,"expires_at"?: number,"id"?: string,"received_at"?: number,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integration_hooks": {
                  Row: {
                    "active": number,"conversation_id": string,"created_at": number,"created_by": string,"id": string,"last_delivery_at": number | null,"last_error": string | null,"name": string,"secret": string,"updated_at": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active": number,"conversation_id": string,"created_at": number,"created_by": string,"id": string,"last_delivery_at"?: number | null,"last_error"?: string | null,"name": string,"secret": string,"updated_at": number,"workspace_id": string
                  }
                  Update: {
                    "active"?: number,"conversation_id"?: string,"created_at"?: number,"created_by"?: string,"id"?: string,"last_delivery_at"?: number | null,"last_error"?: string | null,"name"?: string,"secret"?: string,"updated_at"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integration_installs": {
                  Row: {
                    "config": string,"connector_id": string,"connector_version": number,"created_at": number,"decided_at": number | null,"decided_by": string | null,"granted_caps": string,"id": string,"installed_by": string | null,"last_error": string | null,"last_error_at": number | null,"last_event_at": number | null,"request_note": string | null,"requested_by": string | null,"requested_caps": string,"rev": number,"state": string,"updated_at": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config": string,"connector_id": string,"connector_version": number,"created_at": number,"decided_at"?: number | null,"decided_by"?: string | null,"granted_caps": string,"id": string,"installed_by"?: string | null,"last_error"?: string | null,"last_error_at"?: number | null,"last_event_at"?: number | null,"request_note"?: string | null,"requested_by"?: string | null,"requested_caps": string,"rev": number,"state": string,"updated_at": number,"workspace_id": string
                  }
                  Update: {
                    "config"?: string,"connector_id"?: string,"connector_version"?: number,"created_at"?: number,"decided_at"?: number | null,"decided_by"?: string | null,"granted_caps"?: string,"id"?: string,"installed_by"?: string | null,"last_error"?: string | null,"last_error_at"?: number | null,"last_event_at"?: number | null,"request_note"?: string | null,"requested_by"?: string | null,"requested_caps"?: string,"rev"?: number,"state"?: string,"updated_at"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integration_jobs": {
                  Row: {
                    "attempts": number,"created_at": number,"id": string,"idempotency_key": string,"kind": string,"last_error": string | null,"lease_until": number | null,"next_at": number,"payload": string,"state": string,"updated_at": number,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts": number,"created_at": number,"id": string,"idempotency_key": string,"kind": string,"last_error"?: string | null,"lease_until"?: number | null,"next_at": number,"payload": string,"state": string,"updated_at": number,"workspace_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: number,"id"?: string,"idempotency_key"?: string,"kind"?: string,"last_error"?: string | null,"lease_until"?: number | null,"next_at"?: number,"payload"?: string,"state"?: string,"updated_at"?: number,"workspace_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"integration_oauth_states": {
                  Row: {
                    "account_id": string | null,"begin_hash": string | null,"browser_hash": string | null,"connector_id": string,"created_at": number,"error": string | null,"expires_at": number,"finish_hash": string | null,"id": string,"owner_type": string,"redirect_uri": string,"result": string | null,"scopes": string,"state_hash": string,"used_at": number | null,"user_id": string,"verifier": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"begin_hash"?: string | null,"browser_hash"?: string | null,"connector_id": string,"created_at": number,"error"?: string | null,"expires_at": number,"finish_hash"?: string | null,"id": string,"owner_type": string,"redirect_uri": string,"result"?: string | null,"scopes": string,"state_hash": string,"used_at"?: number | null,"user_id": string,"verifier"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"begin_hash"?: string | null,"browser_hash"?: string | null,"connector_id"?: string,"created_at"?: number,"error"?: string | null,"expires_at"?: number,"finish_hash"?: string | null,"id"?: string,"owner_type"?: string,"redirect_uri"?: string,"result"?: string | null,"scopes"?: string,"state_hash"?: string,"used_at"?: number | null,"user_id"?: string,"verifier"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integration_policies": {
                  Row: {
                    "doc": string,"id": string,"rev": number,"updated_at": number,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "doc": string,"id": string,"rev": number,"updated_at": number,"updated_by"?: string | null
                  }
                  Update: {
                    "doc"?: string,"id"?: string,"rev"?: number,"updated_at"?: number,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"integration_subscriptions": {
                  Row: {
                    "account_id": string,"active": number,"connector_id": string,"conversation_id": string,"created_at": number,"created_by": string,"events": string,"id": string,"last_delivery_at": number | null,"last_error": string | null,"resource": string,"updated_at": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active": number,"connector_id": string,"conversation_id": string,"created_at": number,"created_by": string,"events": string,"id": string,"last_delivery_at"?: number | null,"last_error"?: string | null,"resource": string,"updated_at": number,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string,"active"?: number,"connector_id"?: string,"conversation_id"?: string,"created_at"?: number,"created_by"?: string,"events"?: string,"id"?: string,"last_delivery_at"?: number | null,"last_error"?: string | null,"resource"?: string,"updated_at"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invitations": {
                  Row: {
                    "branch_id": string | null,"code_hash": string,"code_hint": string,"created_at": number,"created_by": string,"expires_at": number,"grant_role_id": string | null,"guest_days": number | null,"id": string,"max_uses": number,"org_id": string,"revoked_at": number | null,"role": string,"team_id": string | null,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id"?: string | null,"code_hash": string,"code_hint": string,"created_at": number,"created_by": string,"expires_at": number,"grant_role_id"?: string | null,"guest_days"?: number | null,"id": string,"max_uses": number,"org_id": string,"revoked_at"?: number | null,"role": string,"team_id"?: string | null,"uses"?: number
                  }
                  Update: {
                    "branch_id"?: string | null,"code_hash"?: string,"code_hint"?: string,"created_at"?: number,"created_by"?: string,"expires_at"?: number,"grant_role_id"?: string | null,"guest_days"?: number | null,"id"?: string,"max_uses"?: number,"org_id"?: string,"revoked_at"?: number | null,"role"?: string,"team_id"?: string | null,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_fk_0"
      columns: ["grant_role_id"]
isOneToOne: false
      referencedRelation: "org_roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_fk_1"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_fk_2"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_fk_3"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_fk_4"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"join_applications": {
                  Row: {
                    "answers": string,"created_at": number,"handled_at": number | null,"handled_by": string | null,"id": string,"note": string | null,"org_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answers": string,"created_at": number,"handled_at"?: number | null,"handled_by"?: string | null,"id": string,"note"?: string | null,"org_id": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "answers"?: string,"created_at"?: number,"handled_at"?: number | null,"handled_by"?: string | null,"id"?: string,"note"?: string | null,"org_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "join_applications_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"legacy_tickets": {
                  Row: {
                    "account_id": string | null,"created_at": number,"expires_at": number,"ticket_hash": string,"used_at": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"created_at": number,"expires_at": number,"ticket_hash": string,"used_at"?: number | null,"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"created_at"?: number,"expires_at"?: number,"ticket_hash"?: string,"used_at"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "legacy_tickets_fk_0"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "legacy_tickets_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"linked_account_starts": {
                  Row: {
                    "expires_at": number,"id": string,"provider": string,"user_id": string,"verifier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": number,"id": string,"provider": string,"user_id": string,"verifier": string
                  }
                  Update: {
                    "expires_at"?: number,"id"?: string,"provider"?: string,"user_id"?: string,"verifier"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_linked_account_starts_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"linked_accounts": {
                  Row: {
                    "checked_at": number,"connected_at": number,"external_id": string,"id": string,"items": NonNullable<Json>,"items_kind": string,"name": string,"provider": string,"tokens": string | null,"updated_at": number,"url": string,"user_id": string,"visible": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at": number,"connected_at": number,"external_id": string,"id": string,"items": NonNullable<Json>,"items_kind": string,"name": string,"provider": string,"tokens"?: string | null,"updated_at": number,"url": string,"user_id": string,"visible": boolean
                  }
                  Update: {
                    "checked_at"?: number,"connected_at"?: number,"external_id"?: string,"id"?: string,"items"?: NonNullable<Json>,"items_kind"?: string,"name"?: string,"provider"?: string,"tokens"?: string | null,"updated_at"?: number,"url"?: string,"user_id"?: string,"visible"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_linked_accounts_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"loadtest_registrations": {
                  Row: {
                    "created_at": number,"id": number,"invite_id": string,"network": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"id": number,"invite_id": string,"network": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"id"?: number,"invite_id"?: string,"network"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meeting_participants": {
                  Row: {
                    "meeting_id": string,"response": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "meeting_id": string,"response"?: string,"user_id": string
                  }
                  Update: {
                    "meeting_id"?: string,"response"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meeting_participants_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_participants_fk_1"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["id"]
    }
                  ]
                },"meetings": {
                  Row: {
                    "cancelled_at": number | null,"created_at": number,"description": string | null,"ends_at": number,"id": string,"notified_at": number | null,"org_id": string,"organizer_id": string,"repeat": string | null,"rev": number,"room_id": string,"starts_at": number,"time_zone": string,"title": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: number | null,"created_at": number,"description"?: string | null,"ends_at": number,"id": string,"notified_at"?: number | null,"org_id": string,"organizer_id": string,"repeat"?: string | null,"rev"?: number,"room_id": string,"starts_at": number,"time_zone": string,"title": string,"updated_at": number
                  }
                  Update: {
                    "cancelled_at"?: number | null,"created_at"?: number,"description"?: string | null,"ends_at"?: number,"id"?: string,"notified_at"?: number | null,"org_id"?: string,"organizer_id"?: string,"repeat"?: string | null,"rev"?: number,"room_id"?: string,"starts_at"?: number,"time_zone"?: string,"title"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetings_fk_0"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetings_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"mention_all_events": {
                  Row: {
                    "at": number,"conversation_id": string,"message_id": string,"rowid": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at": number,"conversation_id": string,"message_id": string,"rowid": number,"user_id": string
                  }
                  Update: {
                    "at"?: number,"conversation_id"?: string,"message_id"?: string,"rowid"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"message_events": {
                  Row: {
                    "audience": string,"cls": string,"conversation_id": string,"id": string,"imported_by": string | null,"mention_all": number,"payload": string,"sender_device_id": string | null,"sender_user_id": string,"sent_at": number,"server_ts": number,"target": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"cls": string,"conversation_id": string,"id": string,"imported_by"?: string | null,"mention_all"?: number,"payload": string,"sender_device_id"?: string | null,"sender_user_id": string,"sent_at": number,"server_ts": number,"target"?: string | null,"type": string
                  }
                  Update: {
                    "audience"?: string,"cls"?: string,"conversation_id"?: string,"id"?: string,"imported_by"?: string | null,"mention_all"?: number,"payload"?: string,"sender_device_id"?: string | null,"sender_user_id"?: string,"sent_at"?: number,"server_ts"?: number,"target"?: string | null,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"messaging_settings": {
                  Row: {
                    "dm_policy": string,"request_policy": string,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "dm_policy"?: string,"request_policy"?: string,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "dm_policy"?: string,"request_policy"?: string,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mojo_controls": {
                  Row: {
                    "enforce": string | null,"id": number,"levels": string,"plans": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enforce"?: string | null,"id": number,"levels"?: string,"plans"?: string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "enforce"?: string | null,"id"?: number,"levels"?: string,"plans"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mojo_gift_credits": {
                  Row: {
                    "account_id": string,"applied_at": number | null,"created_at": number,"gift_id": string,"grant_id": string | null,"next_check_at": number,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"applied_at"?: number | null,"created_at": number,"gift_id": string,"grant_id"?: string | null,"next_check_at"?: number,"status"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string,"applied_at"?: number | null,"created_at"?: number,"gift_id"?: string,"grant_id"?: string | null,"next_check_at"?: number,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mojo_gift_deliveries": {
                  Row: {
                    "created_at": number,"delivered_at": number | null,"delivery_status": string,"gift_id": string,"recipient_email_encrypted": string | null,"recipient_email_hash": string | null,"recipient_kind": string,"redeemed_by": string | null,"redemption_expires_at": number | null,"revoked_at": number | null,"revoked_by": string | null,"token_hash": string | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"delivered_at"?: number | null,"delivery_status"?: string,"gift_id": string,"recipient_email_encrypted"?: string | null,"recipient_email_hash"?: string | null,"recipient_kind": string,"redeemed_by"?: string | null,"redemption_expires_at"?: number | null,"revoked_at"?: number | null,"revoked_by"?: string | null,"token_hash"?: string | null,"updated_at": number
                  }
                  Update: {
                    "created_at"?: number,"delivered_at"?: number | null,"delivery_status"?: string,"gift_id"?: string,"recipient_email_encrypted"?: string | null,"recipient_email_hash"?: string | null,"recipient_kind"?: string,"redeemed_by"?: string | null,"redemption_expires_at"?: number | null,"revoked_at"?: number | null,"revoked_by"?: string | null,"token_hash"?: string | null,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"mojo_gifts": {
                  Row: {
                    "amount_minor": number,"buyer_account_id": string,"buyer_user_id": string | null,"created_at": number,"currency": string,"dispute_status": string | null,"expires_at": number,"grant_id": string | null,"id": string,"months": number,"note": string | null,"paid_at": number | null,"plan_key": string,"provider": string,"provider_payment_ref": string | null,"provider_session_ref": string | null,"recipient_user_id": string,"redeemed_at": number | null,"refund_status": string,"request_key": string | null,"status": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"buyer_account_id": string,"buyer_user_id"?: string | null,"created_at": number,"currency": string,"dispute_status"?: string | null,"expires_at": number,"grant_id"?: string | null,"id": string,"months": number,"note"?: string | null,"paid_at"?: number | null,"plan_key": string,"provider": string,"provider_payment_ref"?: string | null,"provider_session_ref"?: string | null,"recipient_user_id": string,"redeemed_at"?: number | null,"refund_status"?: string,"request_key"?: string | null,"status": string,"updated_at": number
                  }
                  Update: {
                    "amount_minor"?: number,"buyer_account_id"?: string,"buyer_user_id"?: string | null,"created_at"?: number,"currency"?: string,"dispute_status"?: string | null,"expires_at"?: number,"grant_id"?: string | null,"id"?: string,"months"?: number,"note"?: string | null,"paid_at"?: number | null,"plan_key"?: string,"provider"?: string,"provider_payment_ref"?: string | null,"provider_session_ref"?: string | null,"recipient_user_id"?: string,"redeemed_at"?: number | null,"refund_status"?: string,"request_key"?: string | null,"status"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"mojo_profile": {
                  Row: {
                    "badge_hidden": number,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_hidden"?: number,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "badge_hidden"?: number,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"nav_preferences": {
                  Row: {
                    "doc": string,"rev": number,"updated_at": number,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "doc": string,"rev": number,"updated_at": number,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "doc"?: string,"rev"?: number,"updated_at"?: number,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nav_preferences_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_apps": {
                  Row: {
                    "created_at": number,"id": string,"name": string,"owner_id": string,"redirect_uris": (string)[],"secret_hash": string,"secret_rotated_at": number,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"id": string,"name": string,"owner_id": string,"redirect_uris": (string)[],"secret_hash": string,"secret_rotated_at": number,"updated_at": number
                  }
                  Update: {
                    "created_at"?: number,"id"?: string,"name"?: string,"owner_id"?: string,"redirect_uris"?: (string)[],"secret_hash"?: string,"secret_rotated_at"?: number,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_oauth_apps_fk_0"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_codes": {
                  Row: {
                    "app_id": string,"challenge": string | null,"created_at": number,"expires_at": number,"family_id": string | null,"id": string,"redirect_uri": string,"scopes": (string)[],"used_at": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_id": string,"challenge"?: string | null,"created_at": number,"expires_at": number,"family_id"?: string | null,"id": string,"redirect_uri": string,"scopes": (string)[],"used_at"?: number | null,"user_id": string
                  }
                  Update: {
                    "app_id"?: string,"challenge"?: string | null,"created_at"?: number,"expires_at"?: number,"family_id"?: string | null,"id"?: string,"redirect_uri"?: string,"scopes"?: (string)[],"used_at"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_oauth_codes_fk_0"
      columns: ["app_id"]
isOneToOne: false
      referencedRelation: "oauth_apps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_oauth_codes_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_grants": {
                  Row: {
                    "app_id": string,"created_at": number,"id": string,"scopes": (string)[],"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_id": string,"created_at": number,"id": string,"scopes": (string)[],"updated_at": number,"user_id": string
                  }
                  Update: {
                    "app_id"?: string,"created_at"?: number,"id"?: string,"scopes"?: (string)[],"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_oauth_grants_fk_0"
      columns: ["app_id"]
isOneToOne: false
      referencedRelation: "oauth_apps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_oauth_grants_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_tokens": {
                  Row: {
                    "access_expires_at": number,"access_hash": string,"app_id": string,"confidential": boolean,"created_at": number,"id": string,"previous_refresh_hash": string | null,"refresh_expires_at": number,"refresh_hash": string,"rotated_at": number,"scopes": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_expires_at": number,"access_hash": string,"app_id": string,"confidential": boolean,"created_at": number,"id": string,"previous_refresh_hash"?: string | null,"refresh_expires_at": number,"refresh_hash": string,"rotated_at": number,"scopes": (string)[],"user_id": string
                  }
                  Update: {
                    "access_expires_at"?: number,"access_hash"?: string,"app_id"?: string,"confidential"?: boolean,"created_at"?: number,"id"?: string,"previous_refresh_hash"?: string | null,"refresh_expires_at"?: number,"refresh_hash"?: string,"rotated_at"?: number,"scopes"?: (string)[],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_oauth_tokens_fk_0"
      columns: ["app_id"]
isOneToOne: false
      referencedRelation: "oauth_apps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_oauth_tokens_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"official_bots": {
                  Row: {
                    "bot_key": string,"enabled": number,"look_name": string | null,"org_id": string,"settings": string,"updated_at": number,"updated_by": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bot_key": string,"enabled": number,"look_name"?: string | null,"org_id": string,"settings": string,"updated_at": number,"updated_by": string,"user_id"?: string | null
                  }
                  Update: {
                    "bot_key"?: string,"enabled"?: number,"look_name"?: string | null,"org_id"?: string,"settings"?: string,"updated_at"?: number,"updated_by"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "official_bots_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"official_bots_plus": {
                  Row: {
                    "expires_at": number | null,"granted_at": number,"granted_by": string,"org_id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: number | null,"granted_at": number,"granted_by": string,"org_id": string,"reason": string
                  }
                  Update: {
                    "expires_at"?: number | null,"granted_at"?: number,"granted_by"?: string,"org_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "official_bots_plus_fk_0"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_answers": {
                  Row: {
                    "answered_at": number,"option_ids": string,"org_id": string,"role_ids": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at": number,"option_ids": string,"org_id": string,"role_ids": string,"user_id": string
                  }
                  Update: {
                    "answered_at"?: number,"option_ids"?: string,"org_id"?: string,"role_ids"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_answers_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_completions": {
                  Row: {
                    "finished_at": number,"org_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "finished_at": number,"org_id": string,"user_id": string
                  }
                  Update: {
                    "finished_at"?: number,"org_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_completions_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"operator_accounts": {
                  Row: {
                    "account_id": string,"code_expires_at": number | null,"code_hash": string | null,"created_at": number,"created_by": string,"note": string | null,"tester": number,"updated_at": number,"updated_by": string,"verification": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"code_expires_at"?: number | null,"code_hash"?: string | null,"created_at": number,"created_by": string,"note"?: string | null,"tester"?: number,"updated_at": number,"updated_by": string,"verification": string
                  }
                  Update: {
                    "account_id"?: string,"code_expires_at"?: number | null,"code_hash"?: string | null,"created_at"?: number,"created_by"?: string,"note"?: string | null,"tester"?: number,"updated_at"?: number,"updated_by"?: string,"verification"?: string
                  }
                  Relationships: [
                    
                  ]
                },"org_bans": {
                  Row: {
                    "banned_at": number,"banned_by": string,"org_id": string,"reason": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banned_at": number,"banned_by": string,"org_id": string,"reason"?: string | null,"user_id": string
                  }
                  Update: {
                    "banned_at"?: number,"banned_by"?: string,"org_id"?: string,"reason"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_bans_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_bans_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"org_deletions": {
                  Row: {
                    "channels": number,"deleted_at": number,"deleted_by": string,"files": number,"members": number,"name_sha256": string,"org_id": string,"request_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channels": number,"deleted_at": number,"deleted_by": string,"files": number,"members": number,"name_sha256": string,"org_id": string,"request_id"?: string | null
                  }
                  Update: {
                    "channels"?: number,"deleted_at"?: number,"deleted_by"?: string,"files"?: number,"members"?: number,"name_sha256"?: string,"org_id"?: string,"request_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"org_entitlements": {
                  Row: {
                    "expires_at": number | null,"key": string,"limit_value": number,"org_id": string,"reason": string | null,"set_at": number,"set_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: number | null,"key": string,"limit_value": number,"org_id": string,"reason"?: string | null,"set_at": number,"set_by": string
                  }
                  Update: {
                    "expires_at"?: number | null,"key"?: string,"limit_value"?: number,"org_id"?: string,"reason"?: string | null,"set_at"?: number,"set_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_entitlements_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"org_members": {
                  Row: {
                    "expires_at": number | null,"joined_at": number,"org_id": string,"role": string,"timeout_until": number | null,"title": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: number | null,"joined_at": number,"org_id": string,"role": string,"timeout_until"?: number | null,"title"?: string | null,"user_id": string
                  }
                  Update: {
                    "expires_at"?: number | null,"joined_at"?: number,"org_id"?: string,"role"?: string,"timeout_until"?: number | null,"title"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_members_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_members_fk_1"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"org_nicknames": {
                  Row: {
                    "nickname": string,"org_id": string,"updated_at": number,"updated_by": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "nickname": string,"org_id": string,"updated_at": number,"updated_by": string,"user_id": string
                  }
                  Update: {
                    "nickname"?: string,"org_id"?: string,"updated_at"?: number,"updated_by"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_nicknames_fk_0"
      columns: ["org_id","user_id"]
isOneToOne: true
      referencedRelation: "org_members"
      referencedColumns: ["org_id","user_id"]
    }
                  ]
                },"org_role_extras": {
                  Row: {
                    "auto_assign": string,"auto_before": number | null,"color2": string | null,"mentionable": number,"org_id": string,"role_id": string,"updated_at": number,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_assign"?: string,"auto_before"?: number | null,"color2"?: string | null,"mentionable"?: number,"org_id": string,"role_id": string,"updated_at": number,"updated_by": string
                  }
                  Update: {
                    "auto_assign"?: string,"auto_before"?: number | null,"color2"?: string | null,"mentionable"?: number,"org_id"?: string,"role_id"?: string,"updated_at"?: number,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_role_extras_fk_0"
      columns: ["role_id"]
isOneToOne: true
      referencedRelation: "org_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_role_members": {
                  Row: {
                    "assigned_at": number,"assigned_by": string,"org_id": string,"role_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at": number,"assigned_by": string,"org_id": string,"role_id": string,"user_id": string
                  }
                  Update: {
                    "assigned_at"?: number,"assigned_by"?: string,"org_id"?: string,"role_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_role_members_fk_0"
      columns: ["org_id","user_id"]
isOneToOne: false
      referencedRelation: "org_members"
      referencedColumns: ["org_id","user_id"]
    },{
      foreignKeyName: "org_role_members_fk_1"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "org_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_roles": {
                  Row: {
                    "archived_at": number | null,"color": string | null,"created_at": number,"created_by": string,"denies": string,"description": string | null,"hoist": number,"icon": string | null,"id": string,"name": string,"org_id": string,"permissions": string,"position": number,"rev": number,"template": string | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: number | null,"color"?: string | null,"created_at": number,"created_by": string,"denies": string,"description"?: string | null,"hoist"?: number,"icon"?: string | null,"id": string,"name": string,"org_id": string,"permissions": string,"position": number,"rev": number,"template"?: string | null,"updated_at": number
                  }
                  Update: {
                    "archived_at"?: number | null,"color"?: string | null,"created_at"?: number,"created_by"?: string,"denies"?: string,"description"?: string | null,"hoist"?: number,"icon"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"permissions"?: string,"position"?: number,"rev"?: number,"template"?: string | null,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_roles_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"orgs": {
                  Row: {
                    "accent": string | null,"activity_alerts": number,"ai_changed_at": number | null,"ai_changed_by": string | null,"ai_enabled": number,"ai_provider": string | null,"banner_rev": number | null,"create_request_id": string | null,"created_at": number,"created_by": string,"description": string | null,"dms_paused_until": number | null,"guest_max_days": number | null,"guests_allowed": number,"guide": string | null,"id": string,"invites_paused_until": number | null,"join_policy": string,"join_questions": string | null,"kind": string,"name": string,"photo_rev": number | null,"platform_suspended_at": number | null,"platform_suspended_until": number | null,"raid_alert_at": number | null,"raid_alert_count": number | null,"rules": string | null,"slug": string,"synthetic": number,"tag": string | null,"updated_at": number,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent"?: string | null,"activity_alerts"?: number,"ai_changed_at"?: number | null,"ai_changed_by"?: string | null,"ai_enabled"?: number,"ai_provider"?: string | null,"banner_rev"?: number | null,"create_request_id"?: string | null,"created_at": number,"created_by": string,"description"?: string | null,"dms_paused_until"?: number | null,"guest_max_days"?: number | null,"guests_allowed"?: number,"guide"?: string | null,"id": string,"invites_paused_until"?: number | null,"join_policy"?: string,"join_questions"?: string | null,"kind"?: string,"name": string,"photo_rev"?: number | null,"platform_suspended_at"?: number | null,"platform_suspended_until"?: number | null,"raid_alert_at"?: number | null,"raid_alert_count"?: number | null,"rules"?: string | null,"slug": string,"synthetic"?: number,"tag"?: string | null,"updated_at": number,"visibility"?: string
                  }
                  Update: {
                    "accent"?: string | null,"activity_alerts"?: number,"ai_changed_at"?: number | null,"ai_changed_by"?: string | null,"ai_enabled"?: number,"ai_provider"?: string | null,"banner_rev"?: number | null,"create_request_id"?: string | null,"created_at"?: number,"created_by"?: string,"description"?: string | null,"dms_paused_until"?: number | null,"guest_max_days"?: number | null,"guests_allowed"?: number,"guide"?: string | null,"id"?: string,"invites_paused_until"?: number | null,"join_policy"?: string,"join_questions"?: string | null,"kind"?: string,"name"?: string,"photo_rev"?: number | null,"platform_suspended_at"?: number | null,"platform_suspended_until"?: number | null,"raid_alert_at"?: number | null,"raid_alert_count"?: number | null,"rules"?: string | null,"slug"?: string,"synthetic"?: number,"tag"?: string | null,"updated_at"?: number,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orgs_fk_0"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"pairing_requests": {
                  Row: {
                    "approved_user_id": string | null,"certificate": string | null,"code_hash": string,"created_at": number,"device_name": string,"encryption_key": string,"expires_at": number,"id": string,"sealed_enc": string | null,"sealed_identity": string | null,"signing_key": string,"transfer_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_user_id"?: string | null,"certificate"?: string | null,"code_hash": string,"created_at": number,"device_name": string,"encryption_key": string,"expires_at": number,"id": string,"sealed_enc"?: string | null,"sealed_identity"?: string | null,"signing_key": string,"transfer_key": string
                  }
                  Update: {
                    "approved_user_id"?: string | null,"certificate"?: string | null,"code_hash"?: string,"created_at"?: number,"device_name"?: string,"encryption_key"?: string,"expires_at"?: number,"id"?: string,"sealed_enc"?: string | null,"sealed_identity"?: string | null,"signing_key"?: string,"transfer_key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pending_blob_deletes": {
                  Row: {
                    "attempts": number,"blob_id": string,"kind": string,"next_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"blob_id": string,"kind": string,"next_at": number
                  }
                  Update: {
                    "attempts"?: number,"blob_id"?: string,"kind"?: string,"next_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_admin_challenges": {
                  Row: {
                    "account_id": string,"challenge": string,"created_at": number,"expires_at": number,"id": string,"purpose": string,"session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"challenge": string,"created_at": number,"expires_at": number,"id": string,"purpose": string,"session_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"challenge"?: string,"created_at"?: number,"expires_at"?: number,"id"?: string,"purpose"?: string,"session_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_admin_enrolments": {
                  Row: {
                    "account_id": string,"attempts": number,"code_hash": string,"created_at": number,"expires_at": number,"issued_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"attempts"?: number,"code_hash": string,"created_at": number,"expires_at": number,"issued_by"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"attempts"?: number,"code_hash"?: string,"created_at"?: number,"expires_at"?: number,"issued_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_admin_passkeys": {
                  Row: {
                    "account_id": string,"backed_up": number,"counter": number,"created_at": number,"id": string,"last_used_at": number | null,"name": string,"public_key": string,"transports": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"backed_up"?: number,"counter"?: number,"created_at": number,"id": string,"last_used_at"?: number | null,"name": string,"public_key": string,"transports"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"backed_up"?: number,"counter"?: number,"created_at"?: number,"id"?: string,"last_used_at"?: number | null,"name"?: string,"public_key"?: string,"transports"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_admin_sessions": {
                  Row: {
                    "account_id": string,"created_at": number,"expires_at": number,"id": string,"idle_expires_at": number,"last_used_at": number,"network": string,"reauth_at": number,"revoke_reason": string | null,"revoked_at": number | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at": number,"expires_at": number,"id": string,"idle_expires_at": number,"last_used_at": number,"network": string,"reauth_at": number,"revoke_reason"?: string | null,"revoked_at"?: number | null,"token_hash": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: number,"expires_at"?: number,"id"?: string,"idle_expires_at"?: number,"last_used_at"?: number,"network"?: string,"reauth_at"?: number,"revoke_reason"?: string | null,"revoked_at"?: number | null,"token_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "account_id": string,"granted_at": number,"granted_by": string | null,"note": string | null,"permissions": string | null,"revoked_at": number | null,"revoked_by": string | null,"role": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"granted_at": number,"granted_by"?: string | null,"note"?: string | null,"permissions"?: string | null,"revoked_at"?: number | null,"revoked_by"?: string | null,"role": string,"updated_at": number
                  }
                  Update: {
                    "account_id"?: string,"granted_at"?: number,"granted_by"?: string | null,"note"?: string | null,"permissions"?: string | null,"revoked_at"?: number | null,"revoked_by"?: string | null,"role"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_appeal_challenges": {
                  Row: {
                    "account_id": string | null,"attempts": number,"code_hash": string,"created_at": number,"expires_at": number,"id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"attempts"?: number,"code_hash": string,"created_at": number,"expires_at": number,"id": string,"user_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string | null,"attempts"?: number,"code_hash"?: string,"created_at"?: number,"expires_at"?: number,"id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_appeals": {
                  Row: {
                    "assigned_to": string | null,"body": string,"created_at": number,"decision": string | null,"delivery_pending": number,"id": string,"next_delivery_at": number,"notice_id": string | null,"notification_error": string | null,"notified_version": number,"status": string,"subject": string,"sync_status": string,"updated_at": number,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"body": string,"created_at": number,"decision"?: string | null,"delivery_pending"?: number,"id": string,"next_delivery_at"?: number,"notice_id"?: string | null,"notification_error"?: string | null,"notified_version"?: number,"status"?: string,"subject": string,"sync_status"?: string,"updated_at": number,"user_id": string,"version"?: number
                  }
                  Update: {
                    "assigned_to"?: string | null,"body"?: string,"created_at"?: number,"decision"?: string | null,"delivery_pending"?: number,"id"?: string,"next_delivery_at"?: number,"notice_id"?: string | null,"notification_error"?: string | null,"notified_version"?: number,"status"?: string,"subject"?: string,"sync_status"?: string,"updated_at"?: number,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_audit": {
                  Row: {
                    "action": string,"actor_account_id": string | null,"actor_role": string | null,"at": number,"detail": string | null,"hash": string,"id": number,"network": string | null,"outcome": string,"prev_hash": string,"reason": string | null,"request_id": string | null,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_account_id"?: string | null,"actor_role"?: string | null,"at": number,"detail"?: string | null,"hash": string,"id": number,"network"?: string | null,"outcome": string,"prev_hash": string,"reason"?: string | null,"request_id"?: string | null,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_account_id"?: string | null,"actor_role"?: string | null,"at"?: number,"detail"?: string | null,"hash"?: string,"id"?: number,"network"?: string | null,"outcome"?: string,"prev_hash"?: string,"reason"?: string | null,"request_id"?: string | null,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_incident_events": {
                  Row: {
                    "actor_account_id": string,"at": number,"body": string,"id": number,"incident_id": string,"kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_account_id": string,"at": number,"body": string,"id": number,"incident_id": string,"kind": string
                  }
                  Update: {
                    "actor_account_id"?: string,"at"?: number,"body"?: string,"id"?: number,"incident_id"?: string,"kind"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_incident_events_fk_0"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "platform_incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_incidents": {
                  Row: {
                    "acknowledged_at": number | null,"assignee_account_id": string | null,"closed_at": number | null,"created_at": number,"created_by": string,"dedupe_key": string | null,"first_seen_at": number | null,"id": string,"kind": string,"last_seen_at": number | null,"notice": string | null,"org_ref": string | null,"resolution": string | null,"resolved_at": number | null,"service": string | null,"severity": string,"source": string,"status": string,"title": string,"updated_at": number,"user_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: number | null,"assignee_account_id"?: string | null,"closed_at"?: number | null,"created_at": number,"created_by": string,"dedupe_key"?: string | null,"first_seen_at"?: number | null,"id": string,"kind": string,"last_seen_at"?: number | null,"notice"?: string | null,"org_ref"?: string | null,"resolution"?: string | null,"resolved_at"?: number | null,"service"?: string | null,"severity": string,"source"?: string,"status": string,"title": string,"updated_at": number,"user_ref"?: string | null
                  }
                  Update: {
                    "acknowledged_at"?: number | null,"assignee_account_id"?: string | null,"closed_at"?: number | null,"created_at"?: number,"created_by"?: string,"dedupe_key"?: string | null,"first_seen_at"?: number | null,"id"?: string,"kind"?: string,"last_seen_at"?: number | null,"notice"?: string | null,"org_ref"?: string | null,"resolution"?: string | null,"resolved_at"?: number | null,"service"?: string | null,"severity"?: string,"source"?: string,"status"?: string,"title"?: string,"updated_at"?: number,"user_ref"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_notice_receipts": {
                  Row: {
                    "notice_id": string,"read_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "notice_id": string,"read_at": number,"user_id": string
                  }
                  Update: {
                    "notice_id"?: string,"read_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_notices": {
                  Row: {
                    "body": string,"created_at": number,"created_by": string,"ends_at": number | null,"id": string,"kind": string,"starts_at": number,"status": string,"target_user_id": string | null,"title": string,"updated_at": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at": number,"created_by": string,"ends_at"?: number | null,"id": string,"kind": string,"starts_at": number,"status"?: string,"target_user_id"?: string | null,"title": string,"updated_at": number,"version"?: number
                  }
                  Update: {
                    "body"?: string,"created_at"?: number,"created_by"?: string,"ends_at"?: number | null,"id"?: string,"kind"?: string,"starts_at"?: number,"status"?: string,"target_user_id"?: string | null,"title"?: string,"updated_at"?: number,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_ownership_requests": {
                  Row: {
                    "approved_name": string | null,"completed_at": number | null,"created_at": number,"expires_at": number,"id": string,"org_id": string,"owner_user_id": string,"reason": string,"requested_by": string,"status": string,"target_user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_name"?: string | null,"completed_at"?: number | null,"created_at": number,"expires_at": number,"id": string,"org_id": string,"owner_user_id": string,"reason": string,"requested_by": string,"status"?: string,"target_user_id": string
                  }
                  Update: {
                    "approved_name"?: string | null,"completed_at"?: number | null,"created_at"?: number,"expires_at"?: number,"id"?: string,"org_id"?: string,"owner_user_id"?: string,"reason"?: string,"requested_by"?: string,"status"?: string,"target_user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_report_cases": {
                  Row: {
                    "appeal_status": string,"assignee_account_id": string | null,"intended_status": string | null,"priority": string,"report_id": string,"sync_status": string,"updated_at": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appeal_status"?: string,"assignee_account_id"?: string | null,"intended_status"?: string | null,"priority"?: string,"report_id": string,"sync_status"?: string,"updated_at": number,"version"?: number
                  }
                  Update: {
                    "appeal_status"?: string,"assignee_account_id"?: string | null,"intended_status"?: string | null,"priority"?: string,"report_id"?: string,"sync_status"?: string,"updated_at"?: number,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_report_events": {
                  Row: {
                    "actor_account_id": string,"at": number,"body": string,"id": number,"kind": string,"report_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_account_id": string,"at": number,"body": string,"id": number,"kind": string,"report_id": string
                  }
                  Update: {
                    "actor_account_id"?: string,"at"?: number,"body"?: string,"id"?: number,"kind"?: string,"report_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_restrictions": {
                  Row: {
                    "kind": string,"reason": string,"set_at": number,"set_by": string,"until": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "kind": string,"reason": string,"set_at": number,"set_by": string,"until"?: number | null,"user_id": string
                  }
                  Update: {
                    "kind"?: string,"reason"?: string,"set_at"?: number,"set_by"?: string,"until"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "key": string,"updated_at": number,"updated_by": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at": number,"updated_by": string,"value": string
                  }
                  Update: {
                    "key"?: string,"updated_at"?: number,"updated_by"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"points_accounts": {
                  Row: {
                    "balance": number,"earned_total": number,"id": string,"last_visit_day": string | null,"level": number,"streak": number,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "balance": number,"earned_total": number,"id": string,"last_visit_day"?: string | null,"level": number,"streak": number,"updated_at": number
                  }
                  Update: {
                    "balance"?: number,"earned_total"?: number,"id"?: string,"last_visit_day"?: string | null,"level"?: number,"streak"?: number,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_points_accounts_fk_0"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"points_days": {
                  Row: {
                    "chats": (string)[],"day": string,"earned": number,"id": string,"minutes": (number)[],"reacted": (string)[],"replied": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chats": (string)[],"day": string,"earned": number,"id": string,"minutes": (number)[],"reacted": (string)[],"replied": (string)[],"user_id": string
                  }
                  Update: {
                    "chats"?: (string)[],"day"?: string,"earned"?: number,"id"?: string,"minutes"?: (number)[],"reacted"?: (string)[],"replied"?: (string)[],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_points_days_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"points_invites": {
                  Row: {
                    "id": string,"inviter_id": string,"joined_at": number,"joiner_id": string,"org_id": string,"settled_at": number | null,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"inviter_id": string,"joined_at": number,"joiner_id": string,"org_id": string,"settled_at"?: number | null,"state": string
                  }
                  Update: {
                    "id"?: string,"inviter_id"?: string,"joined_at"?: number,"joiner_id"?: string,"org_id"?: string,"settled_at"?: number | null,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_points_invites_fk_0"
      columns: ["inviter_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_points_invites_fk_1"
      columns: ["joiner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "native_points_invites_fk_2"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"points_ledger": {
                  Row: {
                    "amount": number,"at": number,"day": string,"detail": string | null,"id": string,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"at": number,"day": string,"detail"?: string | null,"id": string,"kind": string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"at"?: number,"day"?: string,"detail"?: string | null,"id"?: string,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_points_ledger_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"presence_hourly": {
                  Row: {
                    "abnormal": number,"auth_failures": number,"avg_users": number,"connects": number,"disconnects": number,"hour": number,"peak_sockets": number,"peak_users": number,"samples": number
                  }
                  ComputedFields: never
                  Insert: {
                    "abnormal": number,"auth_failures": number,"avg_users": number,"connects": number,"disconnects": number,"hour": number,"peak_sockets": number,"peak_users": number,"samples": number
                  }
                  Update: {
                    "abnormal"?: number,"auth_failures"?: number,"avg_users"?: number,"connects"?: number,"disconnects"?: number,"hour"?: number,"peak_sockets"?: number,"peak_users"?: number,"samples"?: number
                  }
                  Relationships: [
                    
                  ]
                },"presence_samples": {
                  Row: {
                    "abnormal": number,"active_users": number,"auth_failures": number,"call_people": number,"calls": number,"connects": number,"devices": number,"disconnects": number,"minute": number,"platforms": string,"sockets": number,"users": number
                  }
                  ComputedFields: never
                  Insert: {
                    "abnormal": number,"active_users": number,"auth_failures": number,"call_people": number,"calls": number,"connects": number,"devices": number,"disconnects": number,"minute": number,"platforms": string,"sockets": number,"users": number
                  }
                  Update: {
                    "abnormal"?: number,"active_users"?: number,"auth_failures"?: number,"call_people"?: number,"calls"?: number,"connects"?: number,"devices"?: number,"disconnects"?: number,"minute"?: number,"platforms"?: string,"sockets"?: number,"users"?: number
                  }
                  Relationships: [
                    
                  ]
                },"privacy_settings": {
                  Row: {
                    "group_add_policy": string,"id": string,"suggestable": boolean,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_add_policy": string,"id": string,"suggestable": boolean,"updated_at": number
                  }
                  Update: {
                    "group_add_policy"?: string,"id"?: string,"suggestable"?: boolean,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_settings_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_collectible_assets": {
                  Row: {
                    "created_at": number,"id": string,"metadata": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"id": string,"metadata": string
                  }
                  Update: {
                    "created_at"?: number,"id"?: string,"metadata"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profile_collectible_catalog": {
                  Row: {
                    "id": string,"metadata": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"metadata": string,"updated_at": number
                  }
                  Update: {
                    "id"?: string,"metadata"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profile_collectible_inventory": {
                  Row: {
                    "acquired_at": number,"acquisition_source": string,"decoration_id": string,"is_favorite": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acquired_at": number,"acquisition_source": string,"decoration_id": string,"is_favorite"?: number,"user_id": string
                  }
                  Update: {
                    "acquired_at"?: number,"acquisition_source"?: string,"decoration_id"?: string,"is_favorite"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_collectible_inventory_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_collectible_transactions": {
                  Row: {
                    "created_at": number,"currency": string,"decoration_id": string,"id": string,"payment_reference": string | null,"price": number,"transaction_type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"currency": string,"decoration_id": string,"id": string,"payment_reference"?: string | null,"price": number,"transaction_type": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"currency"?: string,"decoration_id"?: string,"id"?: string,"payment_reference"?: string | null,"price"?: number,"transaction_type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_collectible_transactions_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_collectible_uploads": {
                  Row: {
                    "actor_id": string,"expires_at": number,"id": string,"sha256": string,"size": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"expires_at": number,"id": string,"sha256": string,"size": number
                  }
                  Update: {
                    "actor_id"?: string,"expires_at"?: number,"id"?: string,"sha256"?: string,"size"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profile_decorations": {
                  Row: {
                    "animated": boolean,"created_at": number,"creator_id": string,"format": string,"id": string,"name": string,"reason": string | null,"reviewed_at": number | null,"reviewed_by": string | null,"size": number,"status": string,"wearers": number
                  }
                  ComputedFields: never
                  Insert: {
                    "animated": boolean,"created_at": number,"creator_id": string,"format": string,"id": string,"name": string,"reason"?: string | null,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"size": number,"status": string,"wearers": number
                  }
                  Update: {
                    "animated"?: boolean,"created_at"?: number,"creator_id"?: string,"format"?: string,"id"?: string,"name"?: string,"reason"?: string | null,"reviewed_at"?: number | null,"reviewed_by"?: string | null,"size"?: number,"status"?: string,"wearers"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_profile_decorations_fk_0"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"promoted_bookings": {
                  Row: {
                    "clicks": number,"created_at": number,"created_by": string,"ends_at": number,"id": string,"joins": number,"note": string | null,"org_id": string,"price_cents": number,"source": string,"starts_at": number,"state": string,"views": number,"week_start": number
                  }
                  ComputedFields: never
                  Insert: {
                    "clicks"?: number,"created_at": number,"created_by": string,"ends_at": number,"id": string,"joins"?: number,"note"?: string | null,"org_id": string,"price_cents": number,"source": string,"starts_at": number,"state": string,"views"?: number,"week_start": number
                  }
                  Update: {
                    "clicks"?: number,"created_at"?: number,"created_by"?: string,"ends_at"?: number,"id"?: string,"joins"?: number,"note"?: string | null,"org_id"?: string,"price_cents"?: number,"source"?: string,"starts_at"?: number,"state"?: string,"views"?: number,"week_start"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "promoted_bookings_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"push_endpoints": {
                  Row: {
                    "created_at": number,"device_id": string,"endpoint": string,"failing_since": number | null,"kind": string,"last_wake_at": number | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"device_id": string,"endpoint": string,"failing_since"?: number | null,"kind": string,"last_wake_at"?: number | null,"updated_at": number
                  }
                  Update: {
                    "created_at"?: number,"device_id"?: string,"endpoint"?: string,"failing_since"?: number | null,"kind"?: string,"last_wake_at"?: number | null,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_endpoints_fk_0"
      columns: ["device_id"]
isOneToOne: true
      referencedRelation: "devices"
      referencedColumns: ["id"]
    }
                  ]
                },"quota_counters": {
                  Row: {
                    "period_start": string,"quota_key": string,"reserved": number,"scope_id": string,"scope_type": string,"updated_at": number,"used": number
                  }
                  ComputedFields: never
                  Insert: {
                    "period_start": string,"quota_key": string,"reserved"?: number,"scope_id": string,"scope_type": string,"updated_at": number,"used"?: number
                  }
                  Update: {
                    "period_start"?: string,"quota_key"?: string,"reserved"?: number,"scope_id"?: string,"scope_type"?: string,"updated_at"?: number,"used"?: number
                  }
                  Relationships: [
                    
                  ]
                },"quota_events": {
                  Row: {
                    "actor": string | null,"amount": number,"at": number,"detail": string | null,"id": number,"limit_value": number | null,"outcome": string,"policy_id": string | null,"quota_key": string,"scope_id": string,"scope_type": string,"used": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"amount": number,"at": number,"detail"?: string | null,"id": number,"limit_value"?: number | null,"outcome": string,"policy_id"?: string | null,"quota_key": string,"scope_id": string,"scope_type": string,"used": number
                  }
                  Update: {
                    "actor"?: string | null,"amount"?: number,"at"?: number,"detail"?: string | null,"id"?: number,"limit_value"?: number | null,"outcome"?: string,"policy_id"?: string | null,"quota_key"?: string,"scope_id"?: string,"scope_type"?: string,"used"?: number
                  }
                  Relationships: [
                    
                  ]
                },"quota_plan_members": {
                  Row: {
                    "assigned_at": number,"assigned_by": string,"plan_id": string,"scope_id": string,"scope_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at": number,"assigned_by": string,"plan_id": string,"scope_id": string,"scope_type": string
                  }
                  Update: {
                    "assigned_at"?: number,"assigned_by"?: string,"plan_id"?: string,"scope_id"?: string,"scope_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quota_plan_members_fk_0"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "quota_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"quota_plans": {
                  Row: {
                    "archived_at": number | null,"created_at": number,"created_by": string,"description": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: number | null,"created_at": number,"created_by": string,"description"?: string,"id": string,"name": string
                  }
                  Update: {
                    "archived_at"?: number | null,"created_at"?: number,"created_by"?: string,"description"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quota_policies": {
                  Row: {
                    "created_at": number,"created_by": string,"expires_at": number | null,"grace_pct": number,"hard": number,"id": string,"limit_value": number | null,"mode": string,"override": number,"quota_key": string,"reason": string,"scope_id": string,"scope_type": string,"superseded_at": number | null,"superseded_by": string | null,"warn_pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by": string,"expires_at"?: number | null,"grace_pct"?: number,"hard"?: number,"id": string,"limit_value"?: number | null,"mode": string,"override"?: number,"quota_key": string,"reason": string,"scope_id"?: string,"scope_type": string,"superseded_at"?: number | null,"superseded_by"?: string | null,"warn_pct"?: number
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string,"expires_at"?: number | null,"grace_pct"?: number,"hard"?: number,"id"?: string,"limit_value"?: number | null,"mode"?: string,"override"?: number,"quota_key"?: string,"reason"?: string,"scope_id"?: string,"scope_type"?: string,"superseded_at"?: number | null,"superseded_by"?: string | null,"warn_pct"?: number
                  }
                  Relationships: [
                    
                  ]
                },"quota_reservations": {
                  Row: {
                    "amount": number,"created_at": number,"expires_at": number,"id": string,"idempotency_key": string | null,"quota_key": string,"scopes": string,"settled_amount": number | null,"settled_at": number | null,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at": number,"expires_at": number,"id": string,"idempotency_key"?: string | null,"quota_key": string,"scopes": string,"settled_amount"?: number | null,"settled_at"?: number | null,"state": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: number,"expires_at"?: number,"id"?: string,"idempotency_key"?: string | null,"quota_key"?: string,"scopes"?: string,"settled_amount"?: number | null,"settled_at"?: number | null,"state"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reaction_roles": {
                  Row: {
                    "channel_id": string,"emoji": string,"message_id": string,"org_id": string,"position": number,"role_id": string,"set_at": number,"set_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"emoji": string,"message_id": string,"org_id": string,"position": number,"role_id": string,"set_at": number,"set_by": string
                  }
                  Update: {
                    "channel_id"?: string,"emoji"?: string,"message_id"?: string,"org_id"?: string,"position"?: number,"role_id"?: string,"set_at"?: number,"set_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reaction_roles_fk_0"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "org_roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reaction_roles_fk_1"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reaction_roles_fk_2"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"registration_invites": {
                  Row: {
                    "code_hash": string,"code_hint": string,"created_at": number,"expires_at": number,"id": string,"max_uses": number,"note": string | null,"purpose": string,"revoked_at": number | null,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"code_hint": string,"created_at": number,"expires_at": number,"id": string,"max_uses": number,"note"?: string | null,"purpose"?: string,"revoked_at"?: number | null,"uses"?: number
                  }
                  Update: {
                    "code_hash"?: string,"code_hint"?: string,"created_at"?: number,"expires_at"?: number,"id"?: string,"max_uses"?: number,"note"?: string | null,"purpose"?: string,"revoked_at"?: number | null,"uses"?: number
                  }
                  Relationships: [
                    
                  ]
                },"reminder_occurrences": {
                  Row: {
                    "fired_at": number,"occurrence_at": number,"reminder_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fired_at": number,"occurrence_at": number,"reminder_id": string
                  }
                  Update: {
                    "fired_at"?: number,"occurrence_at"?: number,"reminder_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_occurrences_fk_0"
      columns: ["reminder_id"]
isOneToOne: false
      referencedRelation: "reminders"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "anchor_date": string | null,"attempts": number,"completed_at": number | null,"created_at": number,"delivered_at": number | null,"due_at": number,"fired_at": number | null,"id": string,"last_error": string | null,"local_time": string | null,"next_attempt_at": number | null,"recurrence": string | null,"rev": number,"sealed": string,"state": string,"time_zone": string,"updated_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_date"?: string | null,"attempts"?: number,"completed_at"?: number | null,"created_at": number,"delivered_at"?: number | null,"due_at": number,"fired_at"?: number | null,"id": string,"last_error"?: string | null,"local_time"?: string | null,"next_attempt_at"?: number | null,"recurrence"?: string | null,"rev"?: number,"sealed": string,"state": string,"time_zone": string,"updated_at": number,"user_id": string
                  }
                  Update: {
                    "anchor_date"?: string | null,"attempts"?: number,"completed_at"?: number | null,"created_at"?: number,"delivered_at"?: number | null,"due_at"?: number,"fired_at"?: number | null,"id"?: string,"last_error"?: string | null,"local_time"?: string | null,"next_attempt_at"?: number | null,"recurrence"?: string | null,"rev"?: number,"sealed"?: string,"state"?: string,"time_zone"?: string,"updated_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "content": string | null,"conversation_id": string | null,"created_at": number,"handled_at": number | null,"handled_by": string | null,"handled_note": string | null,"id": string,"message_id": string | null,"note": string | null,"org_id": string | null,"reason": string,"reporter_id": string,"status": string,"target_user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string | null,"conversation_id"?: string | null,"created_at": number,"handled_at"?: number | null,"handled_by"?: string | null,"handled_note"?: string | null,"id": string,"message_id"?: string | null,"note"?: string | null,"org_id"?: string | null,"reason": string,"reporter_id": string,"status"?: string,"target_user_id": string
                  }
                  Update: {
                    "content"?: string | null,"conversation_id"?: string | null,"created_at"?: number,"handled_at"?: number | null,"handled_by"?: string | null,"handled_note"?: string | null,"id"?: string,"message_id"?: string | null,"note"?: string | null,"org_id"?: string | null,"reason"?: string,"reporter_id"?: string,"status"?: string,"target_user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"resource_hourly": {
                  Row: {
                    "avg": number,"hour": number,"max": number,"min": number,"samples": number,"series": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avg": number,"hour": number,"max": number,"min": number,"samples": number,"series": string
                  }
                  Update: {
                    "avg"?: number,"hour"?: number,"max"?: number,"min"?: number,"samples"?: number,"series"?: string
                  }
                  Relationships: [
                    
                  ]
                },"resource_samples": {
                  Row: {
                    "minute": number,"series": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "minute": number,"series": string,"value": number
                  }
                  Update: {
                    "minute"?: number,"series"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"session_clients": {
                  Row: {
                    "client": string,"client_version": string,"first_seen_at": number,"last_seen_at": number,"os": string,"platform": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client": string,"client_version"?: string,"first_seen_at": number,"last_seen_at": number,"os"?: string,"platform": string,"session_id": string
                  }
                  Update: {
                    "client"?: string,"client_version"?: string,"first_seen_at"?: number,"last_seen_at"?: number,"os"?: string,"platform"?: string,"session_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sessions": {
                  Row: {
                    "created_at": number,"device_id": string,"expires_at": number,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"device_id": string,"expires_at": number,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"device_id"?: string,"expires_at"?: number,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_fk_0"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"spark_assignments": {
                  Row: {
                    "assigned_at": number,"id": string,"org_id": string,"removed_at": number | null,"removed_reason": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at": number,"id": string,"org_id": string,"removed_at"?: number | null,"removed_reason"?: string | null,"user_id": string
                  }
                  Update: {
                    "assigned_at"?: number,"id"?: string,"org_id"?: string,"removed_at"?: number | null,"removed_reason"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"spark_purchases": {
                  Row: {
                    "amount_minor": number,"buyer_account_id": string | null,"buyer_user_id": string | null,"created_at": number,"currency": string,"expires_at": number,"id": string,"paid_at": number | null,"provider": string,"provider_payment_ref": string | null,"provider_session_ref": string | null,"quantity": number,"request_key": string | null,"status": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"buyer_account_id"?: string | null,"buyer_user_id"?: string | null,"created_at": number,"currency": string,"expires_at": number,"id": string,"paid_at"?: number | null,"provider": string,"provider_payment_ref"?: string | null,"provider_session_ref"?: string | null,"quantity": number,"request_key"?: string | null,"status": string,"updated_at": number
                  }
                  Update: {
                    "amount_minor"?: number,"buyer_account_id"?: string | null,"buyer_user_id"?: string | null,"created_at"?: number,"currency"?: string,"expires_at"?: number,"id"?: string,"paid_at"?: number | null,"provider"?: string,"provider_payment_ref"?: string | null,"provider_session_ref"?: string | null,"quantity"?: number,"request_key"?: string | null,"status"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "spark_purchases_fk_0"
      columns: ["buyer_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"stage_speakers": {
                  Row: {
                    "conversation_id": string,"granted_at": number,"granted_by": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"granted_at": number,"granted_by": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"granted_at"?: number,"granted_by"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_speakers_fk_0"
      columns: ["conversation_id","user_id"]
isOneToOne: true
      referencedRelation: "conversation_members"
      referencedColumns: ["conversation_id","user_id"]
    }
                  ]
                },"submitted_messages": {
                  Row: {
                    "conversation_id": string,"expires_at": number,"message_id": string,"recipient_count": number,"sender_device_id": string,"sender_user_id": string,"server_ts": number
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"expires_at": number,"message_id": string,"recipient_count": number,"sender_device_id": string,"sender_user_id": string,"server_ts": number
                  }
                  Update: {
                    "conversation_id"?: string,"expires_at"?: number,"message_id"?: string,"recipient_count"?: number,"sender_device_id"?: string,"sender_user_id"?: string,"server_ts"?: number
                  }
                  Relationships: [
                    
                  ]
                },"team_members": {
                  Row: {
                    "joined_at": number,"role": string,"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at": number,"role": string,"team_id": string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: number,"role"?: string,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_fk_1"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "archived_at": number | null,"branch_id": string | null,"created_at": number,"department_id": string | null,"description": string | null,"id": string,"name": string,"org_id": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: number | null,"branch_id"?: string | null,"created_at": number,"department_id"?: string | null,"description"?: string | null,"id": string,"name": string,"org_id": string,"updated_at": number
                  }
                  Update: {
                    "archived_at"?: number | null,"branch_id"?: string | null,"created_at"?: number,"department_id"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_fk_0"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_fk_1"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_fk_2"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"telemetry_epochs": {
                  Row: {
                    "kind": string,"started_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "kind": string,"started_at": number
                  }
                  Update: {
                    "kind"?: string,"started_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ticket_panels": {
                  Row: {
                    "category_id": string | null,"created_at": number,"created_by": string,"id": string,"log_channel_id": string | null,"name": string,"org_id": string,"position": number,"post_channel_id": string | null,"posted_message_id": string | null,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at": number,"created_by": string,"id": string,"log_channel_id"?: string | null,"name": string,"org_id": string,"position": number,"post_channel_id"?: string | null,"posted_message_id"?: string | null,"updated_at": number
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: number,"created_by"?: string,"id"?: string,"log_channel_id"?: string | null,"name"?: string,"org_id"?: string,"position"?: number,"post_channel_id"?: string | null,"posted_message_id"?: string | null,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_panels_fk_0"
      columns: ["log_channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_panels_fk_1"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "channel_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_panels_fk_2"
      columns: ["post_channel_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_panels_fk_3"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"tickets": {
                  Row: {
                    "about": string,"channel_id": string,"closed_at": number | null,"closed_by": string | null,"number": number,"opened_at": number,"opener_id": string,"org_id": string,"panel_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "about": string,"channel_id": string,"closed_at"?: number | null,"closed_by"?: string | null,"number": number,"opened_at": number,"opener_id": string,"org_id": string,"panel_id"?: string | null
                  }
                  Update: {
                    "about"?: string,"channel_id"?: string,"closed_at"?: number | null,"closed_by"?: string | null,"number"?: number,"opened_at"?: number,"opener_id"?: string,"org_id"?: string,"panel_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_fk_1"
      columns: ["channel_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"traffic_user_daily": {
                  Row: {
                    "day": string,"metric": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"metric": string,"user_id": string,"value": number
                  }
                  Update: {
                    "day"?: string,"metric"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"usage_daily": {
                  Row: {
                    "day": string,"metric": string,"org_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"metric": string,"org_id": string,"value": number
                  }
                  Update: {
                    "day"?: string,"metric"?: string,"org_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_daily_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"user_activities": {
                  Row: {
                    "activity": NonNullable<Json>,"expires_at": number,"id": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": NonNullable<Json>,"expires_at": number,"id": string,"updated_at": number
                  }
                  Update: {
                    "activity"?: NonNullable<Json>,"expires_at"?: number,"id"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_user_activities_fk_0"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_user_id": string,"created_at": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_user_id": string,"created_at": number,"user_id": string
                  }
                  Update: {
                    "blocked_user_id"?: string,"created_at"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_fk_0"
      columns: ["blocked_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_fk_1"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"user_group_members": {
                  Row: {
                    "added_at": number,"added_by": string,"group_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at": number,"added_by": string,"group_id": string,"user_id": string
                  }
                  Update: {
                    "added_at"?: number,"added_by"?: string,"group_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_group_members_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_group_members_fk_1"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "user_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"user_groups": {
                  Row: {
                    "created_at": number,"created_by": string,"description": string | null,"handle": string,"id": string,"name": string,"org_id": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"created_by": string,"description"?: string | null,"handle": string,"id": string,"name": string,"org_id": string,"updated_at": number
                  }
                  Update: {
                    "created_at"?: number,"created_by"?: string,"description"?: string | null,"handle"?: string,"id"?: string,"name"?: string,"org_id"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_groups_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"username_holds": {
                  Row: {
                    "created_at": number,"expires_at": number,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": number,"expires_at": number,"id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: number,"expires_at"?: number,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "native_username_holds_fk_0"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "about_me": string | null,"avatar_color": number,"avatar_media": string | null,"birthday": string | null,"created_at": number,"deleted_at": number | null,"disabled_at": number | null,"display_name": string,"first_name": string | null,"home_server_id": string | null,"id": string,"identity_key": string,"kind": string,"last_name": string | null,"limited_until": number | null,"notifications_paused_until": number | null,"phone": string | null,"photo_rev": number | null,"presence_mode": string | null,"presence_until": number | null,"privacy": string | null,"profile_banner": string | null,"profile_links": string | null,"profile_style": string | null,"pronouns": string | null,"remote_synced_at": number | null,"status_emoji": string | null,"status_expires_at": number | null,"status_text": string | null,"synthetic": number,"updated_at": number,"username": string,"username_changed_at": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "about_me"?: string | null,"avatar_color"?: number,"avatar_media"?: string | null,"birthday"?: string | null,"created_at": number,"deleted_at"?: number | null,"disabled_at"?: number | null,"display_name": string,"first_name"?: string | null,"home_server_id"?: string | null,"id": string,"identity_key": string,"kind"?: string,"last_name"?: string | null,"limited_until"?: number | null,"notifications_paused_until"?: number | null,"phone"?: string | null,"photo_rev"?: number | null,"presence_mode"?: string | null,"presence_until"?: number | null,"privacy"?: string | null,"profile_banner"?: string | null,"profile_links"?: string | null,"profile_style"?: string | null,"pronouns"?: string | null,"remote_synced_at"?: number | null,"status_emoji"?: string | null,"status_expires_at"?: number | null,"status_text"?: string | null,"synthetic"?: number,"updated_at": number,"username": string,"username_changed_at"?: number | null
                  }
                  Update: {
                    "about_me"?: string | null,"avatar_color"?: number,"avatar_media"?: string | null,"birthday"?: string | null,"created_at"?: number,"deleted_at"?: number | null,"disabled_at"?: number | null,"display_name"?: string,"first_name"?: string | null,"home_server_id"?: string | null,"id"?: string,"identity_key"?: string,"kind"?: string,"last_name"?: string | null,"limited_until"?: number | null,"notifications_paused_until"?: number | null,"phone"?: string | null,"photo_rev"?: number | null,"presence_mode"?: string | null,"presence_until"?: number | null,"privacy"?: string | null,"profile_banner"?: string | null,"profile_links"?: string | null,"profile_style"?: string | null,"pronouns"?: string | null,"remote_synced_at"?: number | null,"status_emoji"?: string | null,"status_expires_at"?: number | null,"status_text"?: string | null,"synthetic"?: number,"updated_at"?: number,"username"?: string,"username_changed_at"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"webhook_deliveries": {
                  Row: {
                    "attempts": number,"created_at": number,"delivered_at": number | null,"event_id": string,"event_type": string,"id": string,"last_error": string | null,"last_status": number | null,"lease_until": number | null,"next_at": number,"org_id": string,"payload": string,"state": string,"webhook_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at": number,"delivered_at"?: number | null,"event_id": string,"event_type": string,"id": string,"last_error"?: string | null,"last_status"?: number | null,"lease_until"?: number | null,"next_at": number,"org_id": string,"payload": string,"state": string,"webhook_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: number,"delivered_at"?: number | null,"event_id"?: string,"event_type"?: string,"id"?: string,"last_error"?: string | null,"last_status"?: number | null,"lease_until"?: number | null,"next_at"?: number,"org_id"?: string,"payload"?: string,"state"?: string,"webhook_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_deliveries_fk_0"
      columns: ["webhook_id"]
isOneToOne: false
      referencedRelation: "webhooks"
      referencedColumns: ["id"]
    }
                  ]
                },"webhooks": {
                  Row: {
                    "consecutive_failures": number,"created_at": number,"created_by": string,"disabled_reason": string | null,"enabled": number,"events": string,"id": string,"name": string,"org_id": string,"secret_sealed": string,"updated_at": number,"url": string,"verified_at": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "consecutive_failures"?: number,"created_at": number,"created_by": string,"disabled_reason"?: string | null,"enabled"?: number,"events": string,"id": string,"name": string,"org_id": string,"secret_sealed": string,"updated_at": number,"url": string,"verified_at"?: number | null
                  }
                  Update: {
                    "consecutive_failures"?: number,"created_at"?: number,"created_by"?: string,"disabled_reason"?: string | null,"enabled"?: number,"events"?: string,"id"?: string,"name"?: string,"org_id"?: string,"secret_sealed"?: string,"updated_at"?: number,"url"?: string,"verified_at"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhooks_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"workflow_runs": {
                  Row: {
                    "attempts": number,"created_at": number,"depth": number,"dry_run": number,"error_kind": string | null,"event_json": string,"event_key": string,"finished_at": number | null,"id": string,"lease_until": number | null,"next_at": number,"org_id": string,"outcome_json": string | null,"state": string,"workflow_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at": number,"depth"?: number,"dry_run"?: number,"error_kind"?: string | null,"event_json": string,"event_key": string,"finished_at"?: number | null,"id": string,"lease_until"?: number | null,"next_at": number,"org_id": string,"outcome_json"?: string | null,"state": string,"workflow_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: number,"depth"?: number,"dry_run"?: number,"error_kind"?: string | null,"event_json"?: string,"event_key"?: string,"finished_at"?: number | null,"id"?: string,"lease_until"?: number | null,"next_at"?: number,"org_id"?: string,"outcome_json"?: string | null,"state"?: string,"workflow_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflow_runs_fk_0"
      columns: ["workflow_id"]
isOneToOne: false
      referencedRelation: "workflows"
      referencedColumns: ["id"]
    }
                  ]
                },"workflows": {
                  Row: {
                    "actions_json": string,"conditions_json": string,"created_at": number,"enabled": number,"id": string,"name": string,"next_run_at": number | null,"org_id": string,"owner_id": string,"rev": number,"trigger_json": string,"trigger_type": string,"updated_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actions_json": string,"conditions_json": string,"created_at": number,"enabled"?: number,"id": string,"name": string,"next_run_at"?: number | null,"org_id": string,"owner_id": string,"rev"?: number,"trigger_json": string,"trigger_type": string,"updated_at": number
                  }
                  Update: {
                    "actions_json"?: string,"conditions_json"?: string,"created_at"?: number,"enabled"?: number,"id"?: string,"name"?: string,"next_run_at"?: number | null,"org_id"?: string,"owner_id"?: string,"rev"?: number,"trigger_json"?: string,"trigger_type"?: string,"updated_at"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflows_fk_0"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
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
        },"meldiq_private": {
          Tables: {
            "auth_links": {
                  Row: {
                    "account_id": string,"auth_user_id": string,"created_at": string,"method": string,"user_id": string,"verified_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"auth_user_id": string,"created_at"?: string,"method": string,"user_id": string,"verified_at": string
                  }
                  Update: {
                    "account_id"?: string,"auth_user_id"?: string,"created_at"?: string,"method"?: string,"user_id"?: string,"verified_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"migration_batches": {
                  Row: {
                    "batch_number": number,"completed_at": string,"record_count": number,"run_id": string,"sha256": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_number": number,"completed_at"?: string,"record_count": number,"run_id": string,"sha256": string,"table_name": string
                  }
                  Update: {
                    "batch_number"?: number,"completed_at"?: string,"record_count"?: number,"run_id"?: string,"sha256"?: string,"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "migration_batches_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "migration_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"migration_runs": {
                  Row: {
                    "catalog_sha256": string,"created_at": string,"environment": string,"id": string,"source_sha256": string
                  }
                  ComputedFields: never
                  Insert: {
                    "catalog_sha256": string,"created_at"?: string,"environment": string,"id": string,"source_sha256": string
                  }
                  Update: {
                    "catalog_sha256"?: string,"created_at"?: string,"environment"?: string,"id"?: string,"source_sha256"?: string
                  }
                  Relationships: [
                    
                  ]
                },"outbox": {
                  Row: {
                    "aggregate_id": string,"attempts": number,"available_at": string,"created_at": string,"dead_at": string | null,"delivered_at": string | null,"destination": string,"event_id": string,"event_type": string,"last_error_code": string | null,"lease_id": string | null,"lease_until": string | null,"payload": NonNullable<Json>,"sequence": number,"topic": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aggregate_id": string,"attempts"?: number,"available_at"?: string,"created_at"?: string,"dead_at"?: string | null,"delivered_at"?: string | null,"destination": string,"event_id": string,"event_type": string,"last_error_code"?: string | null,"lease_id"?: string | null,"lease_until"?: string | null,"payload": NonNullable<Json>,"sequence"?: never,"topic": string
                  }
                  Update: {
                    "aggregate_id"?: string,"attempts"?: number,"available_at"?: string,"created_at"?: string,"dead_at"?: string | null,"delivered_at"?: string | null,"destination"?: string,"event_id"?: string,"event_type"?: string,"last_error_code"?: string | null,"lease_id"?: string | null,"lease_until"?: string | null,"payload"?: NonNullable<Json>,"sequence"?: never,"topic"?: string
                  }
                  Relationships: [
                    
                  ]
                },"realtime_grants": {
                  Row: {
                    "auth_user_id": string,"ephemeral_broadcast": boolean,"expires_at": string,"presence": boolean,"topic": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id": string,"ephemeral_broadcast"?: boolean,"expires_at": string,"presence"?: boolean,"topic": string
                  }
                  Update: {
                    "auth_user_id"?: string,"ephemeral_broadcast"?: boolean,"expires_at"?: string,"presence"?: boolean,"topic"?: string
                  }
                  Relationships: [
                    
                  ]
                },"revoked_auth_sessions": {
                  Row: {
                    "auth_user_id": string,"revoked_at": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id": string,"revoked_at"?: string,"session_id": string
                  }
                  Update: {
                    "auth_user_id"?: string,"revoked_at"?: string,"session_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"row_counters": {
                  Row: {
                    "table_name": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "table_name": string,"value": number
                  }
                  Update: {
                    "table_name"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "active_user_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"can_join_topic":
{ Args: { "extension": string,"sending"?: boolean,"topic": string }; Returns: boolean
                           },
"event_payload":
{ Args: { "value": string }; Returns: Json
                           },
"read_position":
{ Args: { "value": string }; Returns: number
                           },
"session_active":
{ Args: { "session": string,"subject": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "meldiq">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "meldiq": {
          Enums: {
            
          }
        },"meldiq_private": {
          Enums: {
            
          }
        }
} as const
