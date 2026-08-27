/* regex-tester-worker.js — ToolSharp.dev
   Runs regex matching off the main thread so a catastrophic-backtracking
   pattern can be timed out and killed by the caller instead of freezing
   the tab (the main thread has no way to interrupt synchronous JS once
   it starts running). */

self.onmessage = function (e) {
  const { pattern, flags, testStr, findAll } = e.data;
  try {
    const matches = [];
    if (findAll) {
      const globalRe = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      let m;
      while ((m = globalRe.exec(testStr)) !== null) {
        matches.push(serializeMatch(m));
        if (m[0] === '') globalRe.lastIndex++;
      }
    } else {
      const re = new RegExp(pattern, flags);
      const m = re.exec(testStr);
      if (m) matches.push(serializeMatch(m));
    }
    self.postMessage({ ok: true, matches });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};

function serializeMatch(m) {
  return {
    index: m.index,
    value: m[0],
    captures: Array.from(m).slice(1),
    groups: m.groups ? Object.assign({}, m.groups) : null,
  };
}
