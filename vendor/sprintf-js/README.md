# sprintf-js (temporary security vendor)

Vendored copy of `sprintf-js@1.0.3` with a mitigation for
[GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
(`CVE-2026-97058`) until an official patched release is published.

## Mitigation

Precision values for `%e`, `%f`, and `%g` are clamped to the ECMAScript-safe
ranges before calling `toExponential`, `toFixed`, or `toPrecision`, so
unbounded precision no longer throws an uncaught `RangeError`.

## Removal

Replace this override with the official package once a fixed version exists:

```json
"overrides": {
  "sprintf-js": "<patched-version>"
}
```
