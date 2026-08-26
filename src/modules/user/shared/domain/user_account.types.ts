import type { user_city } from '@/generated/enums';

export interface UserCredentialsRecord {
  id: string;
  email: string;
  password_hash: string | null;
}

export interface UserAvatarRecord {
  avatar_key: string | null;
}

export interface UserSummaryRecord {
  created_at: Date;
}

export interface UpdateUserProfileInput {
  user_id: string;
  full_name: string;
  organization: string | null;
  is_independent: boolean;
  city: user_city;
  city_other: string | null;
}

export interface ChangeUserPasswordInput {
  user_id: string;
  session_id: string;
  password_hash: string;
  now: Date;
}

export interface SetUserAvatarInput {
  user_id: string;
  avatar_url: string | null;
  avatar_key: string | null;
}

export interface ApiUserSummary {
  member_since: string;
  completed_courses: number;
}
