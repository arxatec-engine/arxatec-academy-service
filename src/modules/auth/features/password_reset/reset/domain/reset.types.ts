export interface PasswordResetTokenUser {
  id: string;
  email: string;
  email_verified_at: Date | null;
}

export interface PasswordResetTokenRecord {
  id: string;
  user_id: string;
  expires_at: Date;
  consumed_at: Date | null;
  user: PasswordResetTokenUser;
}

export interface ConsumePasswordResetInput {
  token_id: string;
  user_id: string;
  password_hash: string;
  mark_email_verified: boolean;
  now: Date;
}

export interface ConsumePasswordResetResult {
  consumed: boolean;
  revoked_sessions: number;
}
