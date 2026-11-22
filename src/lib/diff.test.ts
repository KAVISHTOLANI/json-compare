import { describe, expect, it } from 'vitest';
import { diff, parseJSON, preview, structure, summarise, toMarkdown } from './diff';

describe('parseJSON', () => {
  it('parses valid JSON', () => {
    expect(parseJSON('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });
  it('reports a line and column for errors', () => {
    const r = parseJSON('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(3);
      expect(r.message).toMatch(/double quotes|trailing commas/);
    }
    const end = parseJSON('{"a": [1, 2');
    expect(end.ok).toBe(false);
    if (!end.ok) expect(end.message).toMatch(/ends too early/);
    expect(parseJSON('   ').ok).toBe(false);
  });
});

describe('diff', () => {
  it('ignores key order and finds added, removed, changed and type changes', () => {
    const a = { name: 'Ada', age: 36, tags: ['x'], meta: { v: 1 } };
    const b = { meta: { v: '1' }, age: 37, name: 'Ada', email: 'a@b.c' };
    const ch = diff(a, b);
    expect(ch).toEqual([
      { path: '$.age', kind: 'changed', before: 36, after: 37 },
      { path: '$.email', kind: 'added', after: 'a@b.c' },
      { path: '$.meta.v', kind: 'type', before: 1, after: '1' },
      { path: '$.tags', kind: 'removed', before: ['x'] },
    ]);
    expect(summarise(ch)).toEqual({ added: 1, removed: 1, changed: 1, type: 1 });
  });
  it('compares arrays by index or by key', () => {
    const a = [{ id: 1, n: 'a' }, { id: 2, n: 'b' }];
    const b = [{ id: 2, n: 'b' }, { id: 1, n: 'A' }];
    expect(diff(a, b).length).toBe(4);
    expect(diff(a, b, { arrayKey: 'id' })).toEqual([{ path: '$[id=1].n', kind: 'changed', before: 'a', after: 'A' }]);
    expect(diff([1, 2], [1, 2, 3])).toEqual([{ path: '$[2]', kind: 'added', after: 3 }]);
  });
  it('quotes awkward keys and treats identical docs as equal', () => {
    expect(diff({ 'first name': 1 }, { 'first name': 2 })[0].path).toBe('$["first name"]');
    expect(diff({ a: [1, { b: null }] }, { a: [1, { b: null }] })).toEqual([]);
  });
});

describe('helpers', () => {
  it('summarises structure, previews and exports markdown', () => {
    expect(structure({ a: 1, b: [1, { c: 2 }] })).toEqual({ keys: 3, depth: 4, arrays: 1, values: 3 });
    expect(preview('x'.repeat(100), 10)).toHaveLength(10);
    expect(toMarkdown([])).toBe('No differences.\n');
    expect(toMarkdown([{ path: '$.a', kind: 'changed', before: 1, after: 2 }])).toContain('| changed | `$.a` | `1` | `2` |');
  });
});
