export interface CertificateRecord {
  id: string;
  recipient_name: string;
  course_title: string;
  completed_at: Date;
  issued_at: Date;
}

export interface ApiCertificate {
  id: string;
  recipient_name: string;
  course_title: string;
  completed_at: string;
  issued_at: string;
  verification_url: string;
  qr_code_data_url: string;
}
