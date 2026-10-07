/**
 * The per-run MCP config file upstream reads through `--mcp-config <path>` (spec section 10):
 * the bridge server's `http` entry, and later one entry per connector beside it, written `0600`
 * into the run's own directory before spawn and removed at teardown. The control-server token
 * travels in the entry's `Authorization` header, so it is in this file and nowhere else: never
 * in argv, never in the environment.
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { RunEndpoint } from './runner';

/** An `http` server entry in Claude Code's `--mcp-config` format. */
export interface McpHttpServerEntry {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  /** Tools always in the prompt, never deferred; startup waits for the server to connect. */
  alwaysLoad: true;
  /** Upstream's wall-clock limit per tool call, in milliseconds. */
  timeout: number;
}

export interface McpConfigFile {
  path: string;
  /** Deletes the file; harmless when it is already gone (the run directory removed with it). */
  remove(): Promise<void>;
}

export const MCP_CONFIG_FILE_NAME = 'mcp-config.json';

/** How far upstream's MCP timeouts sit above the park TTL, so upstream never times out a park first. */
export const PARK_TTL_MARGIN_MS = 60_000;

export const aboveParkTtl = (parkTtlMs: number): number => parkTtlMs + PARK_TTL_MARGIN_MS;

/** The bridge server's entry: the run's control-server endpoint, a call timeout above the park TTL. */
export function bridgeServerEntry(endpoint: RunEndpoint, parkTtlMs: number): McpHttpServerEntry {
  return {
    type: 'http',
    url: endpoint.url,
    headers: { Authorization: `Bearer ${endpoint.token}` },
    alwaysLoad: true,
    timeout: aboveParkTtl(parkTtlMs)
  };
}

/**
 * The file's content, `{mcpServers}`. A planned run takes it as
 * `withRunFile(spec, MCP_CONFIG_FILE_NAME, mcpConfigContent(servers))`: the spawn runner writes it
 * `0600` into the run's directory before spawn and removes it with the directory at exit.
 */
export function mcpConfigContent(servers: Record<string, McpHttpServerEntry>): string {
  return JSON.stringify({ mcpServers: servers });
}

/**
 * Writes `{mcpServers}` to `<runDir>/mcp-config.json`, mode `0600`, refusing to write through
 * anything already at that path, for a directory the caller owns (a planned run uses
 * `mcpConfigContent` with `withRunFile` instead).
 */
export async function writeMcpConfigFile(runDir: string, servers: Record<string, McpHttpServerEntry>): Promise<McpConfigFile> {
  const file = path.join(runDir, MCP_CONFIG_FILE_NAME);
  await fs.writeFile(file, mcpConfigContent(servers), { mode: 0o600, flag: 'wx' });
  return { path: file, remove: () => fs.rm(file, { force: true }) };
}
