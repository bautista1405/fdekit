export interface DockerCustomerApiConfig {
  url: string;
  healthUrl?: string;
  serviceName?: string;
  replicas?: number;
  description?: string;
}
