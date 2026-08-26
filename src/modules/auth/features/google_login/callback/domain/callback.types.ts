export interface GoogleProfilePayload {
  provider_account_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  email_verified: boolean;
}

export interface GoogleCallbackResult {
  code: string;
  redirect_to: string;
}

export interface OauthAccountRecord {
  id: string;
  user_id: string;
}

export interface LinkableUserRecord {
  id: string;
  email_verified_at: Date | null;
}
