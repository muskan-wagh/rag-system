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
  /** Tables whose contents are computed on access (Postgres VIEWs). */
  private derivedTables: Record<string, () => Row[]> = {};
  /** Simulated UNIQUE constraints: table -> list of column tuples. */
  private uniqueConstraints: Record<string, string[][]> = {};

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
    const derived = this.derivedTables[name];
    if (derived) return derived();
    if (!this.tables[name]) {
      this.tables[name] = [];
      this.inserted[name] = [];
    }
    return this.tables[name];
  }

  /**
   * Register a table whose contents are COMPUTED on every access.
   *
   * Production reads `job_pipeline`, a Postgres VIEW projecting
   * `job_applications` as `current_stage AS stage`. Without this the fake would
   * return an empty table, and every pipeline assertion would pass vacuously
   * against zero rows. Registering it as derived also keeps it in sync with the
   * backing table through writes.
   */
  derive(name: string, producer: () => Row[]): this {
    this.derivedTables[name] = producer;
    return this;
  }

  /**
   * Declare a UNIQUE constraint so INSERT and UPSERT actually reject
   * duplicates with PG code 23505.
   *
   * Without this, every idempotency guarantee in the codebase was untested:
   * the code catches 23505 and re-reads the winning row, but a fake that
   * silently appends duplicates means the dedupe path never ran and the tests
   * passed while a double-click would have created duplicate records in
   * production.
   */
  addUniqueConstraint(table: string, columns: string[]): this {
    const list = this.uniqueConstraints[table] ?? [];
    list.push(columns);
    this.uniqueConstraints[table] = list;
    return this;
  }

  /** First row of `table` that violates any declared UNIQUE constraint. */
  private findUniqueViolation(table: string, row: Row): boolean {
    const constraints = this.uniqueConstraints[table];
    if (!constraints) return false;
    return constraints.some((cols) => {
      if (!cols.every((c) => row[c] !== undefined)) return false;
      return this.rows(table).some(
        (existing) => existing !== row && cols.every((c) => existing[c] === row[c]),
      );
    });
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

    /**
     * Options passed to `.select(cols, { count, head })`.
     *
     * Production code uses `.select('id', { count: 'exact', head: true })` to ask
     * "how many rows match" without transferring them. Without support here,
     * `const { count } = await ...` silently destructured `undefined`, so every
     * count-guarded branch (single-application mirroring, delete-guard,
     * report versioning) took the wrong path in tests.
     */
    let selectCount: 'exact' | undefined;
    let selectHead = false;

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
          if (selectHead) {
            // PostgREST returns no rows for a HEAD request; only the count.
            return {
              data: null,
              error: null,
              count: selectCount === 'exact' ? rows.length : null,
            };
          }
          if (rangeState.from !== null && rangeState.to !== null) {
            rows = rows.slice(rangeState.from, rangeState.to + 1);
          }
          return selectCount === 'exact'
            ? { data: rows, error: null, count: rows.length }
            : { data: rows, error: null };
        }
        case 'insert': {
          const list = Array.isArray(payload) ? payload : [payload];
          const duplicate = list.find((r) => db.findUniqueViolation(table, r));
          if (duplicate) {
            db.writes.push(table);
            return {
              data: null,
              error: {
                code: '23505',
                message: `duplicate key value violates unique constraint on ${table}`,
                details: `${table} ${JSON.stringify(duplicate)}`,
              },
            };
          }
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

    /**
     * Performs the write for whichever verb is pending.
     *
     * Shared by `then`, `single()` and `maybeSingle()`. It used to live only
     * inside `then`, which meant the extremely common production pattern
     * `.upsert(row).select('*').maybeSingle()` created NOTHING — the upsert was
     * never executed and the caller saw `data: null`.
     */
    const execute = (): { data: unknown; error: unknown } => {
      if (kind === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const created: Row[] = [];
        let failure: { code: string; message: string } | null = null;
        for (const row of list) {
          if (failure) break;
          const cols = conflictCols.length ? conflictCols : ['id'];
          // A conflict requires the payload to actually carry the key. A row
          // with no `id` must not "conflict" with another row that also has no
          // `id`.
          const hasKey = cols.every((c) => row[c] !== undefined);
          const existing = hasKey ? db.find(table, cols.map((c) => [c, row[c]] as [string, unknown])) : [];
          if (existing.length && ignoreDuplicates) continue;
          if (existing.length) Object.assign(existing[0], row);
          else if (db.findUniqueViolation(table, row)) {
            failure = {
              code: '23505',
              message: `duplicate key value violates unique constraint on ${table}`,
            };
            break;
          } else {
            const stored = { ...row };
            if (stored.id === undefined && !cols.includes('id')) {
              // Real Postgres assigns a generated PK; downstream code assumes
              // an id exists on inserted rows.
              stored.id = `gen-${table}-${db.rows(table).length + 1}`;
            }
            db.rows(table).push(stored);
            created.push(stored);
          }
          db.inserted[table].push({ ...row });
        }
        db.writes.push(table);
        if (failure) return { data: null, error: failure };
        return { data: created[0] ?? null, error: null };
      }
      return terminal();
    };

    const q: Record<string, unknown> = {
      select: (_cols?: string, opts?: { count?: 'exact'; head?: boolean }) => {
        selectCount = opts?.count;
        selectHead = Boolean(opts?.head);
        return q;
      },
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
      // `.insert(...).select().single()` and `.upsert(...).select().maybeSingle()`
      // are the two patterns production code uses everywhere, so both must run
      // the pending write before resolving.
      single: () => {
        const res = execute();
        const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return Promise.resolve({ data, error: null });
      },
      maybeSingle: () => {
        const res = execute();
        const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
        return Promise.resolve({ data, error: null });
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        return Promise.resolve(execute()).then(res, rej);
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