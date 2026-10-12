import { readdir, readFile } from 'fs/promises';
import path from 'path';

const FIXTURE_ROOT = path.resolve(__dirname, '../../fixtures');
const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['Anthropic API key', /sk-ant-[a-zA-Z0-9_-]{20,}/],
  ['OpenAI API key', /sk-[a-zA-Z0-9_-]{32,}/],
  ['GitHub token', /gh[opsu]_[a-zA-Z0-9]{20,}/],
  ['GitHub fine-grained token', /github_pat_[a-zA-Z0-9_]{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['JSON web token', /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['authorization token', /authorization["']?\s*[:=]\s*["']?bearer\s+[a-zA-Z0-9._-]{16,}/i],
  ['Windows home path', /[a-zA-Z]:\\Users\\(?!user(?:\\|$))[^\\\s]+\\/],
  ['Unix home path', /\/(?:home|Users)\/(?!user(?:\/|$))[^/\s]+\//]
];

async function fixtureFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? fixtureFiles(location) : [location];
  }));
  return nested.flat();
}

describe('fixture secret guard', () => {
  it('contains no credentials or operator-specific home paths', async () => {
    const violations: string[] = [];

    for (const file of await fixtureFiles(FIXTURE_ROOT)) {
      const content = await readFile(file, 'utf8');
      for (const [name, pattern] of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(FIXTURE_ROOT, file)}: ${name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
