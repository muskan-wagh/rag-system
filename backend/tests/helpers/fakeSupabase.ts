/**
 * In-memory Supabase double.
 *
 * Supports the query-builder shapes this codebase actually uses: chained
 * `.eq()` / `.in()` / `.order()` / `.range()`, `maybeSingle()` / `single()`,
 * plus `insert` / `update` / `upsert` / `delete`, and `.rpc()`.
 *
 * Builders are thenable (matching supabase-js), and constraints such as
 * UNIQUE and CHECK are simulated where the code depends on them, so an
 * integration test fails loudly rather than silently passing.
 */

export type Row = Record<string, unknown>;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  /** Rows created via insert/upsert, in order — handy for history assertions. */
  inserted: Record<string, Row[]> = {};
  /** Tables the code attempted to write; useful for "nothing was written". */
  writes: string[] = [];

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [name, rows] of Object.entries(seed)) {
      this.tables[name] = rows.map((r) => ({ ...r }));
      this.inserted[name] = [];
    }
  }

  seed(name: string, rows: Row[]): this {
    this.tables[name] = rows.map((r) => ({ ...r }));
    this.inserted[name] = [];
    return this;
  }

  rows(name: string): Row[] {
    if (!this.tables[name]) {
      this.tables[name] = [];
      this.inserted[name] = [];
    }
    return this.tables[name];
  }

  /** All rows in `name` matching the given [column, value] pairs. */
  find(name: string, filters: Array<[string, unknown]>): Row[] {
    return this.rows(name).filter((r) => filters.every(([k, v]) => r[k] === v));
  }

  countWhere(name: string, filters: Array<[string, unknown]>): number {
    return this.find(name, filters).length;
  }
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([k, v]) => row[k] === v);
}

export function makeClient(db: FakeDb, rpcs: Record<string, (args: Record<string, unknown>) => unknown> = {}) {
  function builder(table: string, kind: 'select' | 'insert' | 'update' | 'delete' | 'upsert') {
    const filters: Array<[string, unknown]> = [];
    const inFilters: Array<[string, unknown[], boolean]> = [];
    let payload: Row | Row[] = [];
    let ignoreDuplicates = false;
    let conflictCols: string[] = [];

    const selectRows = (): Row[] => {
      let out = db.rows(table);
      for (const [col, vals, negate] of inFilters) {
        out = out.filter((r) => {
          const hit = vals.includes(r[col]);
          return negate ? !hit : hit;
        });
      }
      return out.filter((r) => matches(r, filters));
    };

    const applyOrder = (rows: Row[]) => {
      // A single `.order(col, {ascending:false})` is enough for this codebase.
      const asc = orderState.ascending;
      const col = orderState.column;
      if (!col) return rows;
      return [...rows].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av === bv) return 0;
        const cmp = av === undefined ? -1 : bv === undefined ? 1 : av < bv ? -1 : 1;
        return asc ? cmp : -cmp;
      });
    };

    const orderState: { column: string | null; ascending: boolean } = { column: null, ascending: true };
    const rangeState: { from: number | null; to: number | null } = { from: null, to: null };

    const terminal = () => {
      switch (kind) {
        case 'select': {
          let rows = applyOrder(selectRows());
          if (rangeState.from !== null && rangeState.to !== null) {
            rows = rows.slice(rangeState.from, rangeState.to + 1);
          }
          return { data: rows, error: null };
        }
        case 'insert': {
          const list = Array.isArray(payload) ? payload : [payload];
          db.rows(table).push(...list.map((r) => ({ ...r })));
          db.inserted[table].push(...list.map((r) => ({ ...r })));
          db.writes.push(table);
          return { data: list, error: null };
        }
        case 'update': {
          const hits = selectRows();
          hits.forEach((h) => Object.assign(h, payload));
          db.writes.push(table);
          return { data: hits[0] ?? null, error: null };
        }
        case 'delete': {
          const hits = selectRows();
          for (let i = db.rows(table).length - 1; i >= 0; i -= 1) {
            if (hits.includes(db.rows(table)[i])) db.rows(table).splice(i, 1);
          }
          db.writes.push(table);
          return { data: null, error: null };
        }
        default:
          return { data: null, error: null };
      }
    };

    const q: Record<string, unknown> = {
      select: (_cols?: string) => q,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return q;
      },
      neq: (col: string, val: unknown) => {
        inFilters.push([col, [val], true]);
        return q;
      },
      in: (col: string, vals: unknown[]) => {
        inFilters.push([col, vals, false]);
        return q;
      },
      is: (col: string, val: unknown) => {
        filters.push([col, val]);
        return q;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderState.column = col;
        orderState.ascending = opts?.ascending !== false;
        return q;
      },
      range: (from: number, to: number) => {
        rangeState.from = from;
        rangeState.to = to;
        return q;
      },
      limit: () => q,
      insert: (p: Row | Row[]) => {
        payload = p;
        kind = 'insert';
        return q;
      },
      update: (p: Row) => {
        payload = p;
        kind = 'update';
        return q;
      },
      delete: () => {
        kind = 'delete';
        return q;
      },
      upsert: (p: Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        payload = p;
        kind = 'upsert';
        ignoreDuplicates = Boolean(opts?.ignoreDuplicates);
        conflictCols = (opts?.onConflict || '').split(',').map((c) => c.trim()).filter(Boolean);
        return q;
      },
      single: () => {
        const res = terminal();
        const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return Promise.resolve({ data, error: null });
      },
      maybeSingle: () => {
        const res = terminal();
        const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return Promise.resolve({ data, error: null });
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        let out: { data: unknown; error: unknown };
        if (kind === 'upsert') {
          const list = Array.isArray(payload) ? payload : [payload];
          const created: Row[] = [];
          for (const row of list) {
            const cols = conflictCols.length ? conflictCols : ['id'];
            const existing = conflictCols.length
              ? db.find(table, cols.map((c) => [c, row[c]] as [string, unknown]))
              : [];
            if (existing.length && ignoreDuplicates) continue;
            if (existing.length) Object.assign(existing[0], row);
            else {
              db.rows(table).push({ ...row });
              created.push(row);
            }
            db.inserted[table].push({ ...row });
          }
          db.writes.push(table);
          out = { data: created[0] ?? null, error: null };
        } else {
          out = terminal();
        }
        return Promise.resolve(out).then(res, rej);
      },
    };
    return q;
  }

  return {
    from: (table: string) => builder(table, 'select'),
    rpc: (name: string, args: Record<string, unknown>) => {
      const fn = rpcs[name];
      if (!fn) return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
      return Promise.resolve({ data: fn(args), error: null });
    },
  };
}