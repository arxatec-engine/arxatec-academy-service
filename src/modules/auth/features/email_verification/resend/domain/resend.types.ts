export interface ResendVerificationInput {
  user_id: string;
  email: string;
  email_verified_at: Date | null;
}

export interface RotateEmailVerificationTokenInput {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  invalidated_at: Date;
}

export interface ResendVerificationResult {
  already_verified: boolean;
  retry_after_seconds: number;
}
