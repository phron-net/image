// `napi build --target wasm32-wasip1` writes the .wasm without a declaration; workerd (and
// esbuild with the copy loader, as wrangler does) hands the import over as a compiled module.
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
