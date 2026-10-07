/**
 * The catalogue's interface: the models the surface serves, loaded once at start.
 */
export { createCatalogue } from './catalogue';
export { SHIPPED_CATALOGUE_PATH, loadCatalogue } from './load';
export type { Catalogue, ModelPage, ModelPageRequest } from './catalogue';
export type {
  CapabilitySupport,
  CatalogueEntry,
  ContextManagementCapability,
  EffortCapability,
  ModelCapabilities,
  ModelInfo,
  ThinkingCapability
} from './model-info';
