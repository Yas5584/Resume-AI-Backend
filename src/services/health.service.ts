export interface HealthStatus {
  success: true;
  service: "resumeai-api";
  status: "healthy";
  timestamp: string;
  uptimeSeconds: number;
}

export class HealthService {
  private startTime = Date.now();

  getHealth(): HealthStatus {
    return {
      success: true,
      service: "resumeai-api",
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

export const healthService = new HealthService();
