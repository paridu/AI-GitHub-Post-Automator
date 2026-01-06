
export interface GithubProject {
  name: string;
  url: string;
  description: string;
  author: string;
  stars: string;
  topic: string;
  license: string;
}

export interface GeneratedPost {
  id: string;
  project: GithubProject;
  painPoint: string;
  solution: string;
  postContent: string;
  timestamp: string;
  targetDate: string;
  slot: string;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  fbPostId?: string;
}

export interface TimeSlot {
  id: string;
  label: string;
  range: string;
  posts: GeneratedPost[];
}

export interface AppSettings {
  fbPageId: string;
  fbAccessToken: string;
  autoPostEnabled: boolean;
  isConnected: boolean;
  languageStyle: 'thai-only' | 'thai-english-mix' | 'eastern-thai-mix';
}

export enum PostStatus {
  IDLE = 'idle',
  RESEARCHING = 'researching',
  GENERATING = 'generating',
  POSTING = 'posting',
  COMPLETED = 'completed',
  ERROR = 'error'
}
