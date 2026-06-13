export function uniqueServices(services: readonly string[] = []): string[] {
  return [...new Set(services.map((service) => service.trim()).filter(Boolean))].sort();
}
