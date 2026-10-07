/**
 * The derived connector fixtures (`tests/fixtures/upstream/derived/`): no connector run has been
 * recorded yet (e2e scenario 9 records one), so two bridge recordings stand in. Upstream reports a
 * connector call exactly as it reports a call to the wrapper's own MCP server (a `tool_use` named
 * `mcp__<server>__<tool>`, then a `user/tool_result` frame), so a bridge run whose server answered
 * becomes a connector run by renaming its server. Each committed file must equal its derivation
 * from the committed source, so the source and the derivation cannot drift apart.
 *
 * After a deliberate change to a source or to the derivation, rewrite the derived files:
 *   UPDATE_DERIVED_FIXTURES=1 npm run test:unit -- tests/unit/upstream-fixtures/derived-connector
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  CONNECTOR_DERIVATIONS, deriveConnectorRecording
} from '../../scripts/upstream-fixtures/derive-connector';

const UPSTREAM = path.resolve(__dirname, '..', '..', 'fixtures', 'upstream');
const UPDATE = process.env['UPDATE_DERIVED_FIXTURES'] === '1';

type WireEntry = { t_ms: number; dir: string; frame: unknown };

const entries = (text: string): WireEntry[] =>
  text.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line) as WireEntry);

const stdout = (text: string): Record<string, unknown>[] => entries(text)
  .filter(entry => entry.dir === 'cli->host').map(entry => JSON.parse(String(entry.frame)) as Record<string, unknown>);

const read = (name: string): string => fs.readFileSync(path.join(UPSTREAM, name), 'utf8');

describe.each(CONNECTOR_DERIVATIONS)('derived connector fixture $target', derivation => {
  const derived = deriveConnectorRecording(read(derivation.source), derivation);

  it('is committed exactly as derived from its source', () => {
    if (UPDATE) {
      fs.mkdirSync(path.dirname(path.join(UPSTREAM, derivation.target)), { recursive: true });
      fs.writeFileSync(path.join(UPSTREAM, derivation.target), derived);
    }
    expect(read(derivation.target)).toBe(derived);
  });

  it("names the connector where the source named the bridge's server, nowhere the old name", () => {
    expect(derived).not.toContain(`mcp__${derivation.from}__`);
    const init = stdout(derived).find(frame => frame['subtype'] === 'init') as { mcp_servers: unknown; tools: string[] };

    expect(init.mcp_servers).toEqual([{ name: derivation.to, status: 'connected', source: 'dynamic' }]);
    expect(init.tools.length).toBeGreaterThan(0);
    expect(init.tools.every(tool => tool.startsWith(`mcp__${derivation.to}__`))).toBe(true);
  });

  it("keeps only what upstream's stdio carried, with the source's timing", () => {
    const sourceEntries = entries(read(derivation.source)).filter(entry => ['host->cli', 'cli->host', 'proc'].includes(entry.dir));

    expect(entries(derived).map(entry => [entry.t_ms, entry.dir])).toEqual(sourceEntries.map(entry => [entry.t_ms, entry.dir]));
  });

  it("leaves every frame but the server's name as upstream wrote it", () => {
    const unnamed = (text: string, name: string) => stdout(text).map(frame => JSON.stringify(frame)
      .split(`mcp__${name}__`).join('mcp__X__').split(`"name":"${name}"`).join('"name":"X"')
      .split(`"server_display_name":"${name}"`).join('"server_display_name":"X"'));

    expect(unnamed(derived, derivation.to)).toEqual(unnamed(read(derivation.source), derivation.from));
  });
});
