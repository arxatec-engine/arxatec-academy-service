export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface EmailMessage extends EmailContent {
  to: string;
}
