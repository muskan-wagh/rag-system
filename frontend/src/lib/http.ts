import type { ApiResponse } from "./types"

/**
 * Shared response handling for every backend call.
 *
 * Why this module exists
 * ----------------------
 * The frontend used to call `res.json()` unconditionally. That throws a raw
 * `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` the
 * moment a response is not JSON — which happens whenever an API route is not
 * deployed (Express answers unknown routes with an HTML 404 page), when a proxy
 * or hosting platform returns an HTML error, or when the body is empty.
 *
 * Those crashes were unrecoverable for callers: they surface as an unhandled
 * parse error with no status code, no endpoint, and nothing to branch on, so a
 * screen can sit on a skeleton forever.
 *
 * `readApiResponse` instead:
 *   1. checks HTTP status,
 *   2. checks the declared content type,
 *   3. only parses JSON when the body really is JSON,
 *   4. and always produces either a well-formed `ApiResponse` or an
 *      `ApiRequestError` that names the status and the endpoint.
 */

/** An HTTP failure we can describe, rather than an opaque parser crash. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly endpoint: string
  readonly contentType: string | null
  /** First few hundred characters of the body, for diagnostics only. */
  readonly bodySnippet: string | null

  constructor(
    message: string,
    options: {
      status: number
      endpoint: string
      contentType?: string | null
      bodySnippet?: string | null
    },
  ) {
    super(message)
    this.name = "ApiRequestError"
    this.status = options.status
    this.endpoint = options.endpoint
    this.contentType = options.contentType ?? null
    this.bodySnippet = options.bodySnippet ?? null
  }
}

const SNIPPET_LENGTH = 200

function snippet(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  return trimmed.length > SNIPPET_LENGTH ? `${trimmed.slice(0, SNIPPET_LENGTH)}…` : trimmed
}

/**
 * A human-readable explanation for a response that was never the JSON we asked
 * for. HTML from the backend means an unmatched route (or a proxy error page);
 * anything else is reported as-is rather than guessed at.
 */
function describeUnexpectedBody(
  status: number,
  contentType: string | null,
  body: string,
  endpoint: string,
): string {
  const statusLabel = status ? ` (HTTP ${status})` : ""
  if (contentType?.includes("text/html") || /^\s*<(!doctype|html)/i.test(body)) {
    return (
      `The server returned an HTML page instead of JSON${statusLabel}. ` +
      `This happens when the API route "${endpoint}" is not deployed. ` +
      `Check that the backend has been redeployed from the current branch.`
    )
  }
  const kind = contentType ? contentType.split(";")[0] : "an empty response"
  return `The server returned ${kind} instead of JSON${statusLabel} for "${endpoint}".`
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const value = contentType.toLowerCase()
  return value.includes("application/json") || value.includes("+json")
}

/**
 * Turn any `Response` into an `ApiResponse`, or throw a descriptive
 * `ApiRequestError`. Never throws a bare `SyntaxError`.
 */
export async function readApiResponse<T>(res: Response, endpoint: string): Promise<ApiResponse<T>> {
  const contentType = res.headers.get("content-type")

  // 204 and HEAD legitimately have no body.
  if (res.status === 204 || res.status === 205) {
    if (!res.ok) {
      throw new ApiRequestError(`${endpoint} failed (HTTP ${res.status})`, {
        status: res.status,
        endpoint,
        contentType,
      })
    }
    return { success: true }
  }

  if (!isJsonContentType(contentType)) {
    const body = await res.text().catch(() => "")
    if (!res.ok || !body.trim()) {
      throw new ApiRequestError(
        describeUnexpectedBody(res.status, contentType, body, endpoint),
        { status: res.status, endpoint, contentType, bodySnippet: snippet(body) },
      )
    }
    // A 2xx with a non-JSON body is still a contract violation; treat it as a
    // failure rather than handing callers `undefined` data.
    throw new ApiRequestError(describeUnexpectedBody(res.status, contentType, body, endpoint), {
      status: res.status,
      endpoint,
      contentType,
      bodySnippet: snippet(body),
    })
  }

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    throw new ApiRequestError(
      `The server claimed JSON for "${endpoint}" but the body could not be parsed (HTTP ${res.status}).`,
      { status: res.status, endpoint, contentType },
    )
  }

  if (parsed && typeof parsed === "object" && "success" in (parsed as Record<string, unknown>)) {
    return parsed as ApiResponse<T>
  }

  // Valid JSON, but not our envelope. Only tolerate it on a success status.
  if (res.ok) return { success: true, data: parsed as T }

  throw new ApiRequestError(`${endpoint} failed (HTTP ${res.status})`, {
    status: res.status,
    endpoint,
    contentType,
    bodySnippet: snippet(JSON.stringify(parsed)),
  })
}

/** Normalise a thrown value (network error, abort, unexpected body) for display. */
export function toReadableError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) {
    if (error.name === "AbortError") return "The request timed out. Check your connection and try again."
    return error.message || fallback
  }
  return fallback
}