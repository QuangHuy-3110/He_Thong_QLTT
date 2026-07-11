export interface Creator {
  id: number;
  full_name: string;
  username: string;
  email: string;
}

export interface Directory {
  id: number;
  name: string;
  is_public: boolean;
  attributes: any;
  parent: number | null;
  user?: number;
}

export interface LessonPlan {
  id: number;
  title: string;
  description: string;
  target_student: string;
  status: string;
  creator: Creator;
  created_at: string;
  file_path?: string;
  file_url?: string;
  attributes?: any;
  directory_ids?: number[];
  directory_names?: string[];
  latest_feedback?: string | null;
  content_preview?: string;
  average_rating?: number;
  total_ratings?: number;
}

export interface Activity {
  ten_hoat_dong: string;
  thoi_gian: string;
  tom_tat: string;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  email?: string;
  phone_number?: string;
  avatar_url?: string;
}
