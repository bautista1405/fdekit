import { describe, expect, it } from 'vitest';
import { dockerEnvironment } from '../index.js';

describe('dockerEnvironment', () => {
  it('creates a Docker Compose environment with services, commands, and customer API evidence', () => {
    const environment = dockerEnvironment({
      composeFile: './docker-compose.local.yml',
      projectName: 'customer-stack',
      services: ['postgres', 'customer-api', 'redis'],
      profiles: ['fde'],
      customerApi: {
        url: 'http://localhost:8787',
        healthUrl: 'http://localhost:8787/health',
        replicas: 2,
      },
      seed: 'npm run seed:docker',
    });

    expect(environment.kind).toBe('local-docker');
    expect(environment.name).toBe('docker-local');
    expect(environment.config).toMatchObject({
      composeCommand: 'docker compose',
      composeFile: './docker-compose.local.yml',
      projectName: 'customer-stack',
      services: ['customer-api', 'postgres', 'redis'],
      profiles: ['fde'],
      customerApi: {
        url: 'http://localhost:8787',
        healthUrl: 'http://localhost:8787/health',
        serviceName: 'customer-api',
        replicas: 2,
      },
    });
    expect(environment.commands.start[0]?.command).toBe(
      'docker compose -f ./docker-compose.local.yml -p customer-stack --profile fde up -d customer-api postgres redis',
    );
    expect(environment.commands.stop[0]?.command).toBe(
      'docker compose -f ./docker-compose.local.yml -p customer-stack --profile fde down',
    );
    expect(environment.commands.seed?.[0]?.command).toBe('npm run seed:docker');
    expect(environment.evidence?.services?.find((service) => service.name === 'customer-api')?.replicas).toBe(2);
  });

  it('supports custom commands and no stop command', () => {
    const environment = dockerEnvironment({
      name: 'compose-customer',
      startCommand: {
        command: 'docker compose up -d',
        cwd: './infra/local',
      },
      stopCommand: false,
      customerApi: {
        serviceName: 'api',
        url: 'http://localhost:3000',
      },
    });

    expect(environment.name).toBe('compose-customer');
    expect(environment.commands.start[0]).toMatchObject({
      name: 'docker.start',
      command: 'docker compose up -d',
      cwd: './infra/local',
    });
    expect(environment.commands.stop).toEqual([]);
    expect(environment.evidence?.services?.find((service) => service.name === 'api')?.endpoint).toBe('http://localhost:3000');
  });
});
