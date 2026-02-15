import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/protocol.ts",
    "src/verification.ts",
    "src/settlement.ts",
    "src/errors/index.ts"
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022"
});
