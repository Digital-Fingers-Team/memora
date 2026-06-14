const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: "user" | "admin" };
};

export type KnowledgeObject = {
  id: string;
  title: string;
  rawContent: string;
  structuredSummary?: string;
  keyInsights?: string[];
  tags?: string[];
  categories?: string[];
  status: "pending" | "processing" | "ready" | "failed";
  confidenceScore?: number;
  createdAt: string;
  updatedAt: string;
};

export type Decision = {
  id: string;
  title: string;
  context: string;
  optionsConsidered: string[];
  reasoning: string;
  finalChoice: string;
  expectedOutcome: string;
  actualOutcome?: string;
  learningReport?: string;
  createdAt: string;
};

export type Report = {
  id: string;
  type: "weekly" | "pattern" | "decision_review";
  title: string;
  summary: string;
  insights: string[];
  themes: string[];
  recommendations: string[];
  createdAt: string;
};

export type GraphData = {
  nodes: Array<{ id: string; title: string; tags: string[]; status: string }>;
  edges: Array<{ id: string; source: string; target: string; type: string; strength: number; explanation: string }>;
};

export class ApiClient {
  constructor(private getToken: () => string | undefined) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message ?? "Request failed");
    return payload.data as T;
  }
}
