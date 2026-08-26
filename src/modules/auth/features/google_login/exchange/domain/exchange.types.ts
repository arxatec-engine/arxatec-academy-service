export interface OauthExchangeTokenRecord {
  id: string;
  user_id: string;
  expires_at: Date;
  consumed_at: Date | null;
}
