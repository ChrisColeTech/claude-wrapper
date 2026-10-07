import { randomBytes } from 'crypto';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 24;
/** Bytes at or above this would bias `% 62`; they are discarded. */
const UNBIASED_LIMIT = 256 - (256 % BASE62.length);

/** A fresh request id: `req_` and 24 uniformly random base62 characters. */
export function mintRequestId(): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of randomBytes(ID_LENGTH)) {
      if (byte < UNBIASED_LIMIT && id.length < ID_LENGTH) {
        id += BASE62[byte % BASE62.length];
      }
    }
  }
  return `req_${id}`;
}
