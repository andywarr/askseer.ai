export interface FileData {
  name: string;
  size: number;
  type: string;
  data: string;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}
