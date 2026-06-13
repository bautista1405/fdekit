import { shellEscape } from '@fdekit/core';

export function composeArgs(options: {
  composeFile?: string;
  projectName?: string;
  envFile?: string;
  profiles?: string[];
  services?: string[];
}): string {
  return [
    options.composeFile ? `-f ${shellEscape(options.composeFile)}` : '',
    options.projectName ? `-p ${shellEscape(options.projectName)}` : '',
    options.envFile ? `--env-file ${shellEscape(options.envFile)}` : '',
    ...(options.profiles ?? []).map((profile) => `--profile ${shellEscape(profile)}`),
  ].filter(Boolean).join(' ');
}

export function dockerComposeStartCommand(options: {
  composeCommand: string;
  composeFile?: string;
  projectName?: string;
  envFile?: string;
  profiles?: string[];
  services?: string[];
}): string {
  const args = composeArgs(options);
  const services = (options.services ?? []).map(shellEscape).join(' ');

  return [
    options.composeCommand,
    args,
    'up -d',
    services,
  ].filter(Boolean).join(' ');
}

export function dockerComposeStopCommand(options: {
  composeCommand: string;
  composeFile?: string;
  projectName?: string;
  envFile?: string;
  profiles?: string[];
}): string {
  const args = composeArgs(options);

  return [options.composeCommand, args, 'down'].filter(Boolean).join(' ');
}
