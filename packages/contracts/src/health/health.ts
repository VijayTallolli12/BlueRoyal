export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: HealthStatus;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  components: {
    database: ComponentHealth;
    [key: string]: ComponentHealth;
  };
}
