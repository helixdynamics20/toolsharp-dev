// Shared by every API route that needs a per-IP request cap -- was
// reimplemented independently in contact.mjs and share.mjs (same Upstash
// Redis INCR/EXPIRE pattern, differing only in key prefix/window/limit),
// so the same real bug (a malformed Upstash response silently rejecting a
// legitimate request instead of failing open) had to be fixed twice.
//
// Callers are expected to wrap this in their own try/catch and fail open
// on error -- rate limiting is a defense-in-depth measure, not any route's
// actual job, and a Redis hiccup should never block a legitimate request.
// (Kept as the caller's responsibility rather than swallowed in here, since
// what "fail open" should log differs per route.)
export async function checkRateLimit(url, token, key, windowSeconds, maxRequests) {
  const incrRes = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['INCR', key])
  });
  const { result: count } = await incrRes.json();
  // A malformed/unexpected Upstash response (no `result`, or a non-number)
  // must not silently fall through to `count <= maxRequests` -- undefined/
  // NaN comparisons are always false in JS, which would reject a legitimate
  // request as over the limit with no real violation. Throwing here routes
  // it through the caller's own fail-open handling instead.
  if (typeof count !== 'number') throw new Error(`Unexpected Upstash INCR response: ${JSON.stringify(count)}`);
  if (count === 1) {
    // first request in this window -- start the clock
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EXPIRE', key, windowSeconds])
    });
  }
  return count <= maxRequests;
}
