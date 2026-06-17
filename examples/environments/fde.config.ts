import { defineAgent, defineDeployment, pick } from '@fdekit/core';
import { dockerEnvironment } from '@fdekit/environment-docker';
import { flociEnvironment } from '@fdekit/environment-floci';

// Demonstrates BOTH runtime-environment backends in one place. Pick one with FDEKIT_ENV_BACKEND:
//
//   FDEKIT_ENV_BACKEND=docker  (default) -> dockerEnvironment + docker-compose.yml (nginx on :8080)
//   FDEKIT_ENV_BACKEND=floci             -> flociEnvironment (LocalStack-compatible AWS emulator on :4566)
//
// Drive either backend with the `fdekit env` lifecycle (see package.json scripts):
//   fdekit env describe | start | doctor | stop
//
// This deployment is intentionally minimal — a mock provider and one demo agent — so the focus
// stays on the `runtimeEnvironment`. support-triage is the full agent example; this is the
// environments reference.
const backend = pick(process.env.FDEKIT_ENV_BACKEND, ['docker', 'floci'], 'docker');

const runtimeEnvironment =
  backend === 'floci'
    ? flociEnvironment({
        cloud: 'aws',
        services: ['s3', 'sqs'],
      })
    : dockerEnvironment({
        name: 'local-docker',
        services: ['web'],
        customerApi: {
          url: 'http://127.0.0.1:8080',
          healthUrl: 'http://127.0.0.1:8080/',
          serviceName: 'web',
          replicas: 1,
        },
      });

export default defineDeployment({
  name: 'environments-example',
  version: '0.1.0',
  environment: 'local',
  runtimeEnvironment,
  providers: {
    mock: {
      name: 'mock',
      model: 'env-demo',
    },
  },
  agents: {
    demo: defineAgent({
      provider: 'mock',
      instructions: './agents/demo.md',
    }),
  },
});
