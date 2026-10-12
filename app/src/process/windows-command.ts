import { access, readFile } from 'fs/promises';
import path from 'path';
import { CommandSpec } from './command-runner';

export async function resolveWindowsCommand(spec: CommandSpec): Promise<CommandSpec> {
  if (process.platform !== 'win32' || path.extname(spec.command).toLowerCase() !== '.cmd') {
    return spec;
  }

  const shim = await readFile(spec.command, 'utf8');
  const scriptMatch = shim.match(/%dp0%[\\/]([^"\r\n]+\.js)/i);
  if (!scriptMatch?.[1]) {
    throw new Error(`Unsupported Windows command shim: ${spec.command}`);
  }

  const directory = path.dirname(spec.command);
  const localNode = path.join(directory, 'node.exe');
  let node = process.execPath;
  try {
    await access(localNode);
    node = localNode;
  } catch {
    // Fall back to the Node executable running the wrapper.
  }

  return {
    command: node,
    args: [path.resolve(directory, scriptMatch[1].replace(/[\\/]/g, path.sep)), ...spec.args]
  };
}
