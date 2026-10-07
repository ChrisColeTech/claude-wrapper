/**
 * Pass 10, the field allowlist (spec section 11): every API event keeps only the fields
 * `allowed-fields.ts` lists for it; each dropped field is logged at debug by its path, once per
 * turn, so CLI drift is visible. Control signals pass through untouched.
 */
import { JsonObject } from '../../upstream/frames';
import { isObject } from '../../utils/json-object';
import { Logger } from '../../utils/logger';
import { ALLOWED_EVENT_FIELDS, FieldFilter, FieldRule, Fields } from './allowed-fields';
import { eachEvent, Pass } from './pass';
import { ApiEvent, isControlSignal, TurnEvent } from './turn-event';

type Drop = (path: string) => void;

const TYPE_ONLY: Fields = { type: true };

function fieldsFor(rule: FieldFilter, value: JsonObject): Fields {
  if ('fields' in rule) return rule.fields;
  const type = value['type'];
  return (typeof type === 'string' && Object.hasOwn(rule.byType, type) ? rule.byType[type] : undefined) ?? TYPE_ONLY;
}

function filterObject(value: JsonObject, fields: Fields, path: string, drop: Drop): JsonObject {
  const kept: JsonObject = {};
  for (const [name, child] of Object.entries(value)) {
    const rule = Object.hasOwn(fields, name) ? fields[name] : undefined;
    if (rule === undefined) drop(`${path}.${name}`);
    else kept[name] = filterValue(child, rule, `${path}.${name}`, drop);
  }
  return kept;
}

function filterValue(value: unknown, rule: FieldRule, path: string, drop: Drop): unknown {
  if (rule === true) return value;
  if ('replaceWith' in rule) return rule.replaceWith;
  if (!isObject(value)) return value;
  return filterObject(value, fieldsFor(rule, value), path, drop);
}

export function createAllowlist(logger: Pick<Logger, 'debug'>): Pass<TurnEvent, TurnEvent> {
  const logged = new Set<string>();
  const drop: Drop = path => {
    if (logged.has(path)) return;
    logged.add(path);
    logger.debug('Field dropped from the turn stream', { field: path });
  };

  return eachEvent(event => {
    if (isControlSignal(event)) return [event];
    const fields = Object.hasOwn(ALLOWED_EVENT_FIELDS, event.type) ? ALLOWED_EVENT_FIELDS[event.type] : undefined;
    if (!fields) {
      drop(String(event.type));
      return [];
    }
    return [filterObject(event as unknown as JsonObject, fields, event.type, drop) as unknown as ApiEvent];
  });
}
