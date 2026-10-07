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

/** A pass that changes nothing: an unarmed pass, and the start of a composition. */
export function identity<T>(): Pass<T, T> {
  return { push: item => [item], end: () => [] };
}

/** Event passes applied in order. */
export function inOrder(passes: Pass<TurnEvent, TurnEvent>[]): Pass<TurnEvent, TurnEvent> {
  return passes.reduce((composed, pass) => chain(composed, pass), identity<TurnEvent>());
}

/** A pass that holds nothing: each event maps to zero or more events. */
export function eachEvent(map: (event: TurnEvent) => TurnEvent[]): Pass<TurnEvent, TurnEvent> {
  return { push: map, end: () => [] };
}
