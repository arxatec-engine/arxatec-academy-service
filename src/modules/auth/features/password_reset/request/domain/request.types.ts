export interface PasswordResetRecipient {
  id: string;
  email: string;
}

export interface IssuedPasswordResetToken {
  id: string;
  expires_at: Date;
}

export interface DeliverPasswordResetEmailInput {
  email: string;
  token: string;
  redirect_to?: string;
}
