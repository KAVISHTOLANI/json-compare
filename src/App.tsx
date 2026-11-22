import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText, downloadText, EmptyState, Landing, NotFound, Notice, PageHead, Shell, useFlash, usePersistentState, useRoute } from './shared/ui';
import { diff, parseJSON, preview, structure, summarise, toMarkdown, type Change, type ChangeKind, type ParseResult } from './lib/diff';
import { SAMPLE_LEFT, SAMPLE_RIGHT } from './lib/samples';

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/compare', label: 'Compare' },
  { to: '/guide', label: 'How it reads JSON' },
];

export default function App() {
  const [route] = useRoute();
  let page;
  if (route === '/') page = <Home />;
  else if (route === '/compare') page = <Workspace />;
  else if (route === '/guide') page = <Guide />;
  else page = <NotFound />;
  return (
    <Shell name="JSON Compare" wordmark={['JSON', 'Compare']} nav={NAV} route={route} cta={{ to: '/compare', label: 'Open workspace' }} footerNote="Documents never leave your browser.">
      {page}
    </Shell>
  );
}

const KIND_LABEL: Record<ChangeKind, string> = { added: 'Added', removed: 'Removed', changed: 'Changed', type: 'Type changed' };

function ChangeRow({ c }: { c: Change }) {
  return (
    <tr className={`chg chg-${c.kind}`}>
      <td><span className={`kind kind-${c.kind}`}>{KIND_LABEL[c.kind]}</span></td>
      <td><code className="path">{c.path}</code></td>
      <td><code className="val before">{preview(c.before)}</code></td>
      <td><code className="val after">{preview(c.after)}</code></td>
    </tr>
  );
}

function Home() {
  const changes = diff(JSON.parse(SAMPLE_LEFT), JSON.parse(SAMPLE_RIGHT), { arrayKey: 'sku' });
  const s = summarise(changes);
  return (
    <Landing
      compact
      eyebrow="Developer tool · JSON diff"
      title={<>See exactly what changed <em>between two JSON documents.</em></>}
      lead="Paste two payloads, configs or API responses. JSON Compare validates both, points to the exact line of any syntax error, and lists every added, removed and changed value by path — ignoring key order."
      primary={{ href: '#/compare', label: 'Open the workspace' }}
      secondary={{ href: '#/guide', label: 'How comparison works' }}
      previewLabel="Order v1 → v2 · real diff output"
      meta={['Runs locally', 'No upload', 'Demo payloads included']}
      preview={
        <div className="hero-diff">
          <div className="summary-chips">
            <span className="kind kind-added">+{s.added} added</span>
            <span className="kind kind-removed">−{s.removed} removed</span>
            <span className="kind kind-changed">~{s.changed} changed</span>
            <span className="kind kind-type">{s.type} type</span>
          </div>
          <table className="table diff-table compact">
            <tbody>{changes.slice(0, 6).map((c) => <ChangeRow key={c.path} c={c} />)}</tbody>
          </table>
        </div>
      }
      steps={[
        { title: 'Paste both documents', body: 'Left is the original, right is the new version. Both are validated as you type.' },
        { title: 'Read the differences', body: 'Every change is listed by its JSON path with the before and after values.' },
        { title: 'Share the report', body: 'Copy or download the differences as a Markdown table for a ticket or PR.' },
      ]}
      features={[
        { title: 'Precise errors', body: 'Syntax problems are reported with line and column, and the line is marked in the gutter.' },
        { title: 'Key order ignored', body: 'Objects are compared by key, so reordered fields are not reported as changes.' },
        { title: 'Match arrays by id', body: 'Name an identifying field (like “id” or “sku”) to compare list items regardless of position.' },
        { title: 'Type changes', body: '1 → "1" and false → "false" are flagged separately from value changes.' },
      ]}
      note="Very large documents (several MB) are compared in the browser’s main thread and may take a moment; a progress state is shown."
      closing={{ title: <>Diff your <em>first payload.</em></>, action: { href: '#/compare', label: 'Open the workspace' } }}
    />
  );
}

function Editor({ label, value, onChange, result, onFormat, onClear }: { label: string; value: string; onChange: (v: string) => void; result: ParseResult; onFormat: () => void; onClear: () => void }) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;
  const errLine = !result.ok ? result.line : null;
  const id = `ed-${label.toLowerCase()}`;
  return (
    <section className="pane" aria-label={`${label} document`}>
      <header className="pane-head">
        <label id={`${id}-label`} htmlFor={id} className="label-mono">{label}</label>
        <span className={`pane-status ${value.trim() ? (result.ok ? 'ok' : 'err') : ''}`}>
          {!value.trim() ? 'Empty' : result.ok ? `Valid · ${new Blob([value]).size.toLocaleString()} bytes` : 'Invalid JSON'}
        </span>
        <span className="pane-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onFormat} disabled={!result.ok}>Format</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClear} disabled={!value}>Clear</button>
        </span>
      </header>
      <div className="editor">
        <div className="gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: Math.min(lines, 5000) }, (_, i) => <span key={i} className={errLine === i + 1 ? 'err' : ''}>{i + 1}</span>)}
        </div>
        <textarea
          id={id}
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => gutter.current && (gutter.current.scrollTop = e.currentTarget.scrollTop)}
          aria-invalid={value.trim() && !result.ok ? true : undefined}
          aria-describedby={!result.ok && value.trim() ? `${id}-err` : undefined}
          placeholder='{ "paste": "JSON here" }'
          wrap="off"
        />
      </div>
      {value.trim() && !result.ok && (
        <p className="pane-error" id={`${id}-err`} role="alert">
          {result.line != null && <strong>Line {result.line}, column {result.column}: </strong>}
          {result.message}
        </p>
      )}
    </section>
  );
}

const PAGE = 25;

function Workspace() {
  const [left, setLeft] = usePersistentState('json-compare:left', SAMPLE_LEFT);
  const [right, setRight] = usePersistentState('json-compare:right', SAMPLE_RIGHT);
  const [arrayKey, setArrayKey] = usePersistentState('json-compare:array-key', 'sku');
  const [filter, setFilter] = useState<ChangeKind | 'all'>('all');
  const [pathQuery, setPathQuery] = useState('');
  const [page, setPage] = useState(0);
  const [flash, setFlash] = useFlash();
  const [inputs, setInputs] = useState({ left, right, arrayKey });
  const pending = inputs.left !== left || inputs.right !== right || inputs.arrayKey !== arrayKey;

  // Debounce comparison so typing stays responsive; shows a “Comparing…” state meanwhile.
  useEffect(() => {
    const t = setTimeout(() => setInputs({ left, right, arrayKey }), left.length + right.length > 200_000 ? 600 : 200);
    return () => clearTimeout(t);
  }, [left, right, arrayKey]);

  const pl = useMemo(() => parseJSON(left), [left]);
  const pr = useMemo(() => parseJSON(right), [right]);
  const result = useMemo(() => {
    const a = parseJSON(inputs.left), b = parseJSON(inputs.right);
    if (!a.ok || !b.ok) return null;
    return { changes: diff(a.value, b.value, { arrayKey: inputs.arrayKey.trim() || undefined }), sa: structure(a.value), sb: structure(b.value) };
  }, [inputs]);
  useEffect(() => setPage(0), [filter, pathQuery, inputs]);

  const shown = result ? result.changes.filter((c) => (filter === 'all' || c.kind === filter) && (!pathQuery || c.path.toLowerCase().includes(pathQuery.toLowerCase()))) : [];
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const s = result ? summarise(result.changes) : null;

  const format = (v: string, set: (s: string) => void) => {
    const p = parseJSON(v);
    if (p.ok) set(JSON.stringify(p.value, null, 2));
  };

  return (
    <div className="stack">
      <PageHead
        eyebrow="Workspace · Compare"
        title={<>Compare <em>documents</em></>}
        description={left === SAMPLE_LEFT && right === SAMPLE_RIGHT ? 'Showing two demo order payloads. Paste your own over them.' : 'Comparison updates as you type.'}
        actions={
          <>
            <button type="button" className="btn" onClick={() => { setLeft(right); setRight(left); }}>⇄ Swap</button>
            <button type="button" className="btn" onClick={() => { setLeft(SAMPLE_LEFT); setRight(SAMPLE_RIGHT); setArrayKey('sku'); }}>Load demo</button>
          </>
        }
      />
      <div className="panes">
        <Editor label="Original" value={left} onChange={setLeft} result={pl} onFormat={() => format(left, setLeft)} onClear={() => setLeft('')} />
        <Editor label="Changed" value={right} onChange={setRight} result={pr} onFormat={() => format(right, setRight)} onClear={() => setRight('')} />
      </div>
      <div className="card options">
        <label className="field inline">
          <span className="label">Match array items by field</span>
          <input type="text" className="code" value={arrayKey} onChange={(e) => setArrayKey(e.target.value)} placeholder="e.g. id (leave empty to compare by position)" />
        </label>
        <p className="hint">Only used when every item in both arrays is an object containing this field.</p>
      </div>

      <section className="card results" aria-labelledby="res-title" aria-busy={pending}>
        <div className="card-title-row">
          <h2 id="res-title">Differences</h2>
          {pending && <span className="row small muted"><span className="spinner" aria-hidden="true" /> Comparing…</span>}
          {result && !pending && (
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={async () => setFlash((await copyText(toMarkdown(result.changes))) ? { kind: 'success', text: 'Markdown report copied.' } : { kind: 'error', text: 'Clipboard blocked — use Download.' })}>Copy report</button>
              <button type="button" className="btn btn-sm" onClick={() => downloadText('json-diff.md', toMarkdown(result.changes), 'text/markdown')}>Download .md</button>
            </div>
          )}
        </div>
        {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
        {!left.trim() && !right.trim() ? (
          <EmptyState title="Nothing to compare yet" actions={<button type="button" className="btn btn-primary" onClick={() => { setLeft(SAMPLE_LEFT); setRight(SAMPLE_RIGHT); }}>Load demo documents</button>}>Paste a JSON document into each pane.</EmptyState>
        ) : !result ? (
          <Notice kind="error">Fix the JSON errors above to see differences. {!pl.ok && pl.line ? `Original: line ${pl.line}. ` : ''}{!pr.ok && pr.line ? `Changed: line ${pr.line}.` : ''}</Notice>
        ) : result.changes.length === 0 ? (
          <div className="identical"><strong>No differences.</strong><p className="muted">The documents are structurally identical (key order ignored).</p></div>
        ) : (
          <>
            <div className="stats compact-stats">
              <div className="stat"><div className="stat-label">Total</div><div className="stat-value" data-testid="total">{result.changes.length}</div></div>
              <div className="stat"><div className="stat-label">Added</div><div className="stat-value add">{s!.added}</div></div>
              <div className="stat"><div className="stat-label">Removed</div><div className="stat-value rem">{s!.removed}</div></div>
              <div className="stat"><div className="stat-label">Changed</div><div className="stat-value chgv">{s!.changed}</div></div>
              <div className="stat"><div className="stat-label">Type</div><div className="stat-value typ">{s!.type}</div></div>
            </div>
            <div className="row result-filters">
              <div className="seg" role="radiogroup" aria-label="Show">
                {(['all', 'added', 'removed', 'changed', 'type'] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)}>{k === 'all' ? 'All' : KIND_LABEL[k]}</button>
                ))}
              </div>
              <input type="search" aria-label="Filter by path" className="code path-filter" value={pathQuery} onChange={(e) => setPathQuery(e.target.value)} placeholder="Filter by path, e.g. shipping" />
            </div>
            {shown.length === 0 ? <p className="muted">No differences match this filter.</p> : (
              <div className="table-wrap">
                <table className="table diff-table">
                  <thead><tr><th>Change</th><th>Path</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>{shown.slice(page * PAGE, page * PAGE + PAGE).map((c) => <ChangeRow key={c.path + c.kind} c={c} />)}</tbody>
                </table>
              </div>
            )}
            {pages > 1 && (
              <nav className="row pager" aria-label="Result pages">
                <button type="button" className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
                <span className="small muted">Page {page + 1} of {pages}</span>
                <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button>
              </nav>
            )}
            <p className="hint">Structure — original: {result.sa.keys} keys, depth {result.sa.depth}, {result.sa.arrays} arrays · changed: {result.sb.keys} keys, depth {result.sb.depth}, {result.sb.arrays} arrays.</p>
          </>
        )}
      </section>
    </div>
  );
}

function Guide() {
  return (
    <div className="stack narrow">
      <PageHead eyebrow="Reference" title={<>How comparison <em>works</em></>} description="What JSON Compare treats as a difference, and what it does not." />
      <div className="card prose">
        <h2>Paths</h2>
        <p>Each difference has a path starting at <code>$</code> (the document root). Object keys are joined with dots (<code>$.shipping.cost</code>); keys with spaces or symbols are quoted (<code>$["first name"]</code>); array items use an index (<code>$.items[0]</code>) or, when matching by field, the field value (<code>$.items[sku="TEA-12"]</code>).</p>
        <h2>Kinds of difference</h2>
        <ul>
          <li><span className="kind kind-added">Added</span> — present only in the changed document.</li>
          <li><span className="kind kind-removed">Removed</span> — present only in the original.</li>
          <li><span className="kind kind-changed">Changed</span> — same type, different value.</li>
          <li><span className="kind kind-type">Type changed</span> — for example a number became a string, or an object became an array.</li>
        </ul>
        <h2>What is ignored</h2>
        <p>The order of keys inside objects, and whitespace or formatting. Array order is <strong>not</strong> ignored unless you match items by a field.</p>
        <h2>Limits</h2>
        <p>Numbers are compared as JavaScript numbers, so integers above 2<sup>53</sup> may lose precision. Duplicate keys keep the last value, as <code>JSON.parse</code> does. Comments and trailing commas are syntax errors (this is JSON, not JSON5).</p>
      </div>
    </div>
  );
}
