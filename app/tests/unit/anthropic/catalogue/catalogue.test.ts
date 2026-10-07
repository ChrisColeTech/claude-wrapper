import { CatalogueEntry, createCatalogue } from '../../../../src/anthropic/catalogue';

function entry(id: string, createdAt: string, aliases: string[] = []): CatalogueEntry {
  return {
    id,
    type: 'model',
    display_name: `Display ${id}`,
    created_at: createdAt,
    max_input_tokens: 1000,
    max_tokens: 100,
    capabilities: null,
    aliases
  };
}

describe('catalogue', () => {
  describe('resolve', () => {
    const catalogue = createCatalogue([
      entry('model-a-1', '2026-01-01T00:00:00Z', ['a']),
      entry('model-b-20250101', '2025-01-01T00:00:00Z', ['b', 'model-b'])
    ]);

    it('resolves a canonical id to its entry', () => {
      expect(catalogue.resolve('model-a-1')).toEqual({
        id: 'model-a-1',
        type: 'model',
        display_name: 'Display model-a-1',
        created_at: '2026-01-01T00:00:00Z',
        max_input_tokens: 1000,
        max_tokens: 100,
        capabilities: null
      });
    });

    it.each(['b', 'model-b'])('resolves the alias %s to the entry under its canonical id', (alias) => {
      expect(catalogue.resolve(alias)?.id).toBe('model-b-20250101');
    });

    it.each(['model-c', 'A', '', 'model-a-1 '])('answers null for a name it does not serve: %p', (name) => {
      expect(catalogue.resolve(name)).toBeNull();
    });
  });

  describe('list', () => {
    // File order is deliberately not release order; m2 and m3 share a release time.
    const catalogue = createCatalogue([
      entry('m3', '2026-03-01T00:00:00Z'),
      entry('m1', '2026-09-01T00:00:00Z', ['one']),
      entry('m4', '2025-10-15T00:00:00Z'),
      entry('m2', '2026-03-01T00:00:00Z')
    ]);
    const ids = (page: { data: { id: string }[] }) => page.data.map((model) => model.id);

    it('lists every model newest first, ties in file order, without aliases', () => {
      const page = catalogue.list({ limit: 20 });

      expect(ids(page)).toEqual(['m1', 'm3', 'm2', 'm4']);
      expect(page).toEqual(expect.objectContaining({ first_id: 'm1', last_id: 'm4', has_more: false }));
      expect(page.data[0]).not.toHaveProperty('aliases');
    });

    it('cuts the page at limit and says more follow', () => {
      expect(catalogue.list({ limit: 2 })).toEqual(expect.objectContaining({
        first_id: 'm1', last_id: 'm3', has_more: true
      }));
    });

    it('pages forward from after_id', () => {
      expect(ids(catalogue.list({ limit: 2, afterId: 'm3' }))).toEqual(['m2', 'm4']);
      expect(catalogue.list({ limit: 2, afterId: 'm3' }).has_more).toBe(false);
      expect(catalogue.list({ limit: 1, afterId: 'm1' })).toEqual(expect.objectContaining({
        first_id: 'm3', last_id: 'm3', has_more: true
      }));
    });

    it('pages backward from before_id, keeping the models nearest the cursor', () => {
      expect(ids(catalogue.list({ limit: 2, beforeId: 'm4' }))).toEqual(['m3', 'm2']);
      expect(catalogue.list({ limit: 2, beforeId: 'm4' }).has_more).toBe(true);
      expect(catalogue.list({ limit: 2, beforeId: 'm3' })).toEqual(expect.objectContaining({
        first_id: 'm1', last_id: 'm1', has_more: false
      }));
    });

    it('lists the models between after_id and before_id when both are given', () => {
      expect(ids(catalogue.list({ limit: 20, afterId: 'm1', beforeId: 'm4' }))).toEqual(['m3', 'm2']);
    });

    it('takes a cursor by alias too', () => {
      expect(ids(catalogue.list({ limit: 20, afterId: 'one' }))).toEqual(['m3', 'm2', 'm4']);
    });

    it('answers an empty page with null ids past the end', () => {
      expect(catalogue.list({ limit: 20, afterId: 'm4' })).toEqual({
        data: [], first_id: null, last_id: null, has_more: false
      });
    });

    it.each([{ afterId: 'nope' }, { beforeId: 'nope' }])('answers an empty page for a cursor naming no model: %p', (cursor) => {
      expect(catalogue.list({ limit: 20, ...cursor }).data).toEqual([]);
    });
  });
});
