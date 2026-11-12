/**
 * HTTP error type and safe error responses.
 * Internal details (SQL errors, stack traces) are logged server-side and never returned to clients.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage = defaultMessage(status),
    public readonly headers: Record<string, string> = {},
  ) {
    super(publicMessage);
  }
}

function defaultMessage(status: number) {
  switch (status) {
    case 400: return "Invalid request.";
    case 401: return "Authentication required.";
    case 403: return "Forbidden.";
    case 404: return "Not found.";
    case 413: return "Request too large.";
    case 429: return "Too many requests. Please try again later.";
    default: return "Something went wrong. Please try again.";
  }
}

/** Converts any thrown value into a generic JSON response without leaking internals. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.publicMessage }, { status: err.status, headers: err.headers });
  }
  if (err && typeof err === "object" && "issues" in err) {
    return Response.json({ error: "Invalid request." }, { status: 400 }); // zod validation error
  }
  console.error("Unhandled API error", err instanceof Error ? err.message : err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
