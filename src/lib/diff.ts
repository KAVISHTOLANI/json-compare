export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export type ParseResult = { ok: true; value: Json } | { ok: false; message: string; line: number | null; column: number | null };

/** Parses JSON and turns engine messages into a line/column a person can find. */
export function parseJSON(text: string): ParseResult {
  if (!text.trim()) return { ok: false, message: 'Paste or type a JSON document.', line: null, column: null };
  try {
    return { ok: true, value: JSON.parse(text) as Json };
  } catch (e) {
    const raw = (e as Error).message;
    let line: number | null = null, column: number | null = null;
    const lc = raw.match(/line (\d+) column (\d+)/);
    const pos = raw.match(/position (\d+)/);
    if (lc) {
      line = Number(lc[1]);
      column = Number(lc[2]);
    } else if (pos) {
      const before = text.slice(0, Number(pos[1]));
      line = before.split('\n').length;
      column = before.length - before.lastIndexOf('\n');
    }
    const at = pos ? Number(pos[1]) : -1;
    const atEnd = at >= text.trimEnd().length;
    const hint = /Unexpected end/.test(raw) || atEnd ? 'The document ends too early — a bracket or quote may be missing.' : /Bad control character|Unterminated string/.test(raw) ? 'A string is not closed, or contains a raw line break.' : /Expected double-quoted property name|Unexpected token '/.test(raw) || /property name/.test(raw) ? 'Keys and strings need double quotes, and trailing commas are not allowed.' : 'Check the character at this position.';
    return { ok: false, message: hint, line, column };
  }
}

export function typeOf(v: Json): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export type ChangeKind = 'added' | 'removed' | 'changed' | 'type';
export interface Change {
  path: string;
  kind: ChangeKind;
  before?: Json;
  after?: Json;
}

const keyPath = (base: string, k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? `${base}.${k}` : `${base}[${JSON.stringify(k)}]`);

/**
 * Structural diff. Object key order is ignored. Arrays are compared by index,
 * or by an identifying field (e.g. "id") when every item is an object that has it.
 */
export function diff(a: Json, b: Json, opts: { arrayKey?: string } = {}, path = '$'): Change[] {
  const ta = typeOf(a), tb = typeOf(b);
  if (ta !== tb) return [{ path, kind: 'type', before: a, after: b }];
  if (ta === 'object') {
    const oa = a as Record<string, Json>, ob = b as Record<string, Json>;
    const out: Change[] = [];
    const keys = [...new Set([...Object.keys(oa), ...Object.keys(ob)])].sort();
    for (const k of keys) {
      const p = keyPath(path, k);
      if (!(k in ob)) out.push({ path: p, kind: 'removed', before: oa[k] });
      else if (!(k in oa)) out.push({ path: p, kind: 'added', after: ob[k] });
      else out.push(...diff(oa[k], ob[k], opts, p));
    }
    return out;
  }
  if (ta === 'array') {
    const aa = a as Json[], ab = b as Json[];
    const key = opts.arrayKey;
    const keyed = (arr: Json[]) => !!key && arr.length > 0 && arr.every((x) => typeOf(x) === 'object' && key in (x as object));
    if (key && keyed(aa) && keyed(ab)) {
      const id = (x: Json) => JSON.stringify((x as Record<string, Json>)[key]);
      const ma = new Map(aa.map((x) => [id(x), x])), mb = new Map(ab.map((x) => [id(x), x]));
      const out: Change[] = [];
      for (const [k, v] of ma) {
        const p = `${path}[${key}=${k}]`;
        if (!mb.has(k)) out.push({ path: p, kind: 'removed', before: v });
        else out.push(...diff(v, mb.get(k)!, opts, p));
      }
      for (const [k, v] of mb) if (!ma.has(k)) out.push({ path: `${path}[${key}=${k}]`, kind: 'added', after: v });
      return out;
    }
    const out: Change[] = [];
    for (let i = 0; i < Math.max(aa.length, ab.length); i++) {
      const p = `${path}[${i}]`;
      if (i >= ab.length) out.push({ path: p, kind: 'removed', before: aa[i] });
      else if (i >= aa.length) out.push({ path: p, kind: 'added', after: ab[i] });
      else out.push(...diff(aa[i], ab[i], opts, p));
    }
    return out;
  }
  return Object.is(a, b) ? [] : [{ path, kind: 'changed', before: a, after: b }];
}

export function summarise(changes: Change[]) {
  const s = { added: 0, removed: 0, changed: 0, type: 0 };
  for (const c of changes) s[c.kind]++;
  return s;
}

export interface Stats {
  keys: number;
  depth: number;
  arrays: number;
  values: number;
}

export function structure(v: Json, depth = 1): Stats {
  const t = typeOf(v);
  if (t === 'object') {
    const entries = Object.values(v as object) as Json[];
    return entries.reduce<Stats>((s, x) => {
      const c = structure(x, depth + 1);
      return { keys: s.keys + c.keys, depth: Math.max(s.depth, c.depth), arrays: s.arrays + c.arrays, values: s.values + c.values };
    }, { keys: entries.length, depth, arrays: 0, values: 0 });
  }
  if (t === 'array') {
    return (v as Json[]).reduce<Stats>((s, x) => {
      const c = structure(x, depth + 1);
      return { keys: s.keys + c.keys, depth: Math.max(s.depth, c.depth), arrays: s.arrays + c.arrays, values: s.values + c.values };
    }, { keys: 0, depth, arrays: 1, values: 0 });
  }
  return { keys: 0, depth, arrays: 0, values: 1 };
}

export function preview(v: Json | undefined, max = 60): string {
  if (v === undefined) return '';
  const s = JSON.stringify(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function toMarkdown(changes: Change[]): string {
  if (changes.length === 0) return 'No differences.\n';
  const rows = changes.map((c) => `| ${c.kind} | \`${c.path}\` | ${c.before === undefined ? '' : '`' + preview(c.before, 80).replace(/\|/g, '\\|') + '`'} | ${c.after === undefined ? '' : '`' + preview(c.after, 80).replace(/\|/g, '\\|') + '`'} |`);
  return ['| Change | Path | Before | After |', '| --- | --- | --- | --- |', ...rows].join('\n') + '\n';
}
