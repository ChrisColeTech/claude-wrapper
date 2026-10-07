/**
 * The catalogue (spec section 3): the models the surface serves. `resolve` maps a canonical id
 * or an alias to the model under its canonical id; `list` pages the models newest first, as
 * `GET /v1/models` does.
 */
import { CatalogueEntry, ModelInfo } from './model-info';

/** A page request; cursors are model names (canonical id or alias) and exclusive. */
export interface ModelPageRequest {
  limit: number;
  afterId?: string;
  beforeId?: string;
}

/** The `GET /v1/models` body. */
export interface ModelPage {
  data: ModelInfo[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
}

export interface Catalogue {
  /** The model a request's `model` names, by canonical id or alias; `null` when not served. */
  resolve(name: string): ModelInfo | null;
  /**
   * Up to `limit` models, newest first: the first ones after `afterId`, or with `beforeId` the
   * ones nearest before it. `has_more` says whether more lie beyond the page in that direction.
   * A cursor that names no model matches nothing, so the page is empty.
   */
  list(request: ModelPageRequest): ModelPage;
}

function servedInfo(entry: CatalogueEntry): ModelInfo {
  const { aliases: _aliases, ...info } = entry;
  return info;
}

/** Newest first by `created_at`; the sort is stable, so equal times keep file order. */
function newestFirst(entries: readonly CatalogueEntry[]): CatalogueEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function toPage(data: ModelInfo[], hasMore: boolean): ModelPage {
  return {
    data,
    first_id: data[0]?.id ?? null,
    last_id: data[data.length - 1]?.id ?? null,
    has_more: hasMore
  };
}

export function createCatalogue(entries: readonly CatalogueEntry[]): Catalogue {
  const ordered = newestFirst(entries);
  const served = ordered.map(servedInfo);
  const positions = new Map<string, number>();
  ordered.forEach((entry, position) => {
    [entry.id, ...entry.aliases].forEach((name) => positions.set(name, position));
  });

  // The models strictly between the cursors; an unknown cursor leaves nothing between.
  const between = ({ afterId, beforeId }: ModelPageRequest): ModelInfo[] => {
    const start = afterId === undefined ? 0 : (positions.get(afterId) ?? Infinity) + 1;
    const end = beforeId === undefined ? served.length : positions.get(beforeId) ?? 0;
    return served.slice(start, end);
  };

  return {
    resolve: (name) => {
      const position = positions.get(name);
      return position === undefined ? null : served[position] ?? null;
    },
    list: (request) => {
      const models = between(request);
      const page = request.beforeId === undefined
        ? models.slice(0, request.limit)
        : models.slice(Math.max(models.length - request.limit, 0));
      return toPage(page, models.length > page.length);
    }
  };
}
