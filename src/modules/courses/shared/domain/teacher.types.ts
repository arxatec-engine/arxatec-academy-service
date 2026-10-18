export interface TeacherProfile {
  full_name: string;
  biography: string;
  photo_url: string | null;
}

export interface TeacherRecord extends TeacherProfile {
  id: string;
}
