/**
 * Pass 10, the field allowlist (spec section 11): every API event keeps only the fields
 * `allowed-fields.ts` lists for it; each dropped field is logged at debug by its path, once per
 * turn, so CLI drift is visible. Control signals pass through untouched.
 */
import { JsonObject } from '../../upstream/frames';
import { ALLOWED_EVENT_FIELDS, FieldRule, Fields } from './allowed-fields';
import { eachEvent, Pass } from './pass';
import { ApiEvent, TranslatorLogger, TurnEvent } from './turn-event';

type Drop = (path: string) => void;

const TYPE_ONLY: Fields = { type: true };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldsFor(rule: Exclude<FieldRule, true>, value: JsonObject): Fields {
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
  if (rule === true || !isObject(value)) return value;
  return filterObject(value, fieldsFor(rule, value), path, drop);
}

export function createAllowlist(logger: TranslatorLogger): Pass<TurnEvent, TurnEvent> {
  const logged = new Set<string>();
  const drop: Drop = path => {
    if (logged.has(path)) return;
    logged.add(path);
    logger.debug('Field dropped from the turn stream', { field: path });
  };

  return eachEvent(event => {
    if (event.type === 'fail') return [event];
    const fields = Object.hasOwn(ALLOWED_EVENT_FIELDS, event.type) ? ALLOWED_EVENT_FIELDS[event.type] : undefined;
    if (!fields) {
      drop(String(event.type));
      return [];
    }
    return [filterObject(event as unknown as JsonObject, fields, event.type, drop) as unknown as ApiEvent];
  });
}
