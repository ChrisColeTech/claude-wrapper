/**
 * A translator pass and how passes compose: each takes items in order and returns the items it
 * produces, in order; `end` flushes what it holds once the frames have ended.
 */
import { TurnEvent } from './turn-event';

export interface Pass<In, Out> {
  push(item: In): Out[];
  end(): Out[];
}

/** `first`'s output feeds `second`, flushes included. */
export function chain<A, B, C>(first: Pass<A, B>, second: Pass<B, C>): Pass<A, C> {
  return {
    push: item => first.push(item).flatMap(produced => second.push(produced)),
    end: () => [...first.end().flatMap(produced => second.push(produced)), ...second.end()]
  };
}

/** Event passes applied in order. */
export function inOrder(passes: Pass<TurnEvent, TurnEvent>[]): Pass<TurnEvent, TurnEvent> {
  const identity: Pass<TurnEvent, TurnEvent> = { push: event => [event], end: () => [] };
  return passes.reduce((composed, pass) => chain(composed, pass), identity);
}

/** A pass that holds nothing: each event maps to zero or more events. */
export function eachEvent(map: (event: TurnEvent) => TurnEvent[]): Pass<TurnEvent, TurnEvent> {
  return { push: map, end: () => [] };
}
