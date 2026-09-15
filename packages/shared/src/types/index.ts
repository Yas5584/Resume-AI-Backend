export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  subscriptionTier: "FREE" | "PRO" | "ENTERPRISE";
  creditsBalance: number;
  image: string | null;
  emailVerified: string | null;
  createdAt: string;
}

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  sessionId: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
