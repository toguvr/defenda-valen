import * as z from "./v4/classic/external.js";
export * from "./v4/classic/external.js";
// Aliasing the binding, instead of `export default z`, keeps the default export a
// re-export of `z` rather than a fresh namespace value. Rollup and Webpack can then
// shake `import z from "./index.js"` as they already shake `import { z } from "./index.js"` — without
// this they pull in every locale. See #6050.
export { z, z as default };
