// Runtime side of @attestly/sdk.
//
// Detector configs are read statically by Attestly's scanner from
// `.attestly/detectors.ts` — we never *execute* this file in production
// (we parse the AST). `defineDetectors` therefore needs to do nothing
// at runtime: it just returns its argument so authors get a fully-typed
// editing experience locally and predictable values if they choose to
// import the file from a script (e.g. for unit tests).
export function defineDetectors(detectors) {
  return detectors;
}

export default defineDetectors;
