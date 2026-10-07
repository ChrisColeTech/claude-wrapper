/**
 * The stream translator's interface (spec section 16): `createTranslator(config) → {push, end}`,
 * frames in, the turn stream out (API events with the control signals inline).
 */
export { createTranslator } from './translator';
export type { ApiEvent, FailSignal, Translator, TranslatorConfig, TranslatorLogger, TurnEvent } from './turn-event';
