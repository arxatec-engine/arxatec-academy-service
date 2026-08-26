export interface EmailVerificationTokenRecord {
  id: string;
  user_id: string;
  expires_at: Date;
  consumed_at: Date | null;
  user: {
    id: string;
    email_verified_at: Date | null;
  };
}

export interface ConsumeEmailVerificationTokenInput {
  token_id: string;
  user_id: string;
  verified_at: Date;
}

export interface VerifyEmailResult {
  already_verified: boolean;
}
