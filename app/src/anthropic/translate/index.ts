/**
 * The stream translator's interface (spec section 16): `createTranslator(config) → {push, end}`,
 * frames in, the turn stream out (API events with the control signals inline).
 */
export { createTranslator } from './translator';
export { isControlSignal } from './turn-event';
export type {
  ApiEvent, ControlSignal, CutReason, CutSignal, FailSignal, ParkSignal, Translator, TranslatorConfig, TranslatorLogger,
  TurnEvent
} from './turn-event';
