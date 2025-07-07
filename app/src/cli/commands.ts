import { Command } from 'commander';

export function createCommands(): Command {
  const program = new Command();
  
  program
    .name('claude-wrapper')
    .description('Claude API wrapper with OpenAI compatibility')
    .version('1.0.0');

  program
    .command('start')
    .description('Start the Claude wrapper server')
    .action(() => {
      console.log('Starting Claude wrapper server...');
    });

  program
    .command('stop')
    .description('Stop the Claude wrapper server')
    .action(() => {
      console.log('Stopping Claude wrapper server...');
    });

  program
    .command('status')
    .description('Check server status')
    .action(() => {
      console.log('Checking server status...');
    });

  return program;
}