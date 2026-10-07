#!/usr/bin/env node
'use strict';
/**
 * The wrapper's PreToolUse hook client (spec sections 8 and 16). Upstream runs it, with the
 * absolute Node path, for every WebSearch and WebFetch call of a run whose settings file names it:
 *
 *   node hook-client.js <the run's hook endpoint file>
 *
 * It posts its stdin (upstream's hook input) to the run's hook endpoint on the wrapper's loopback
 * control server, presenting the run's token as a Bearer header, and prints the reply for
 * upstream. The endpoint URL and token come from the run's `0600` endpoint file, never from argv
 * or the environment. The policy lives in the wrapper; this script decides nothing. When anything
 * fails it prints a denial and still exits 0: upstream lets a call through when a hook fails, so
 * the client fails closed itself. Plain Node, no dependencies: it ships as is, outside `dist/`.
 */
const fs = require('fs');
const http = require('http');

/** Well inside upstream's 30 s hook timeout, after which upstream would let the call through. */
const TIMEOUT_MS = 20000;

function deny(detail) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `unavailable: the wrapper's hook endpoint did not answer (${detail})`
    }
  });
}

function finish(text) {
  process.stdout.write(`${text}\n`, () => process.exit(0));
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);
  });
}

/** A failure the denial may name: never a parser's message, which could quote the token. */
class Failure extends Error {}

function readEndpoint(file) {
  try {
    const endpoint = JSON.parse(fs.readFileSync(file, 'utf8'));
    const url = new URL(endpoint.url);
    if (url.protocol === 'http:' && typeof endpoint.token === 'string') return { url, token: endpoint.token };
  } catch {
    // reported below, without the file's content
  }
  throw new Failure('the endpoint file is missing or invalid');
}

function parseReply(text) {
  try {
    const reply = JSON.parse(text);
    if (typeof reply === 'object' && reply !== null && !Array.isArray(reply)) return JSON.stringify(reply);
  } catch {
    // reported below
  }
  throw new Failure('its reply is not a JSON object');
}

/** The reply body when the endpoint answers 200 with a JSON object, else an error. */
function post({ url, token }, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': body.length, authorization: `Bearer ${token}` },
      timeout: TIMEOUT_MS
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Failure(`HTTP ${response.statusCode}`));
        try {
          resolve(parseReply(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Failure('timed out')));
    request.on('error', reject);
    request.end(body);
  });
}

/** A network error by its code (`ECONNREFUSED`), one of ours by its message, else nothing specific. */
function detailOf(error) {
  if (error instanceof Failure) return error.message;
  return error && typeof error.code === 'string' ? error.code : 'unknown error';
}

async function main() {
  try {
    const body = await readStdin();
    finish(await post(readEndpoint(process.argv[2]), body));
  } catch (error) {
    finish(deny(detailOf(error)));
  }
}

main();
