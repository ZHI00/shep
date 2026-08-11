// Source files import each other without a file extension, which Vite resolves
// but Node's ESM loader does not. Tests import those files directly, so this
// hook fills in the extension the same way the bundler would.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTENSIONS = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const extension of EXTENSIONS) {
      const candidate = new URL(specifier + extension, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
