// Patches global.crypto (and global.Buffer) with react-native-quick-crypto's
// native implementation, so the ported crypto.ts (which calls crypto.subtle.*
// exactly like the web app does) can run unmodified. Must be imported once,
// before anything else touches `crypto`, hence the import at the very top of
// app/_layout.tsx.
import { install } from "react-native-quick-crypto";

install();

const globalScope = globalThis as typeof globalThis & {
  btoa?: (input: string) => string;
  atob?: (input: string) => string;
  Buffer: typeof import("@craftzdog/react-native-buffer").Buffer;
};

// Hermes doesn't guarantee btoa/atob are defined. quick-crypto's install()
// doesn't polyfill these (they're unrelated to crypto.subtle), so provide a
// minimal fallback backed by the now-patched global Buffer if missing.
if (typeof globalScope.btoa !== "function") {
  globalScope.btoa = (input: string) => globalScope.Buffer.from(input, "binary").toString("base64");
}

if (typeof globalScope.atob !== "function") {
  globalScope.atob = (input: string) => globalScope.Buffer.from(input, "base64").toString("binary");
}
