/**
 * Boundary rules (spec §3, §6.5 step 1). A violation fails CI.
 * Contexts are the future microservices: they never import each other, and nothing but the composition
 * roots (apps/*) imports a context. Shared libs and contracts stay business-free.
 */
const CONTEXTS = ['users', 'notes', 'core', 'ai', 'communication']

module.exports = {
  forbidden: [
    ...CONTEXTS.map((ctx) => ({
      name: `no-cross-context-${ctx}`,
      comment: `Only apps/* may import the ${ctx} context; other contexts use its facade interface from libs/.`,
      severity: 'error',
      from: { path: '^(contexts|libs|contracts)/', pathNot: `^contexts/${ctx}/` },
      to: { path: [`^contexts/${ctx}/`, `node_modules/@lvn-backend/${ctx}/`] },
    })),
    {
      name: 'libs-are-business-free',
      comment: 'libs/ must not depend on any context.',
      severity: 'error',
      from: { path: '^libs/' },
      to: { path: '^contexts/' },
    },
    {
      name: 'contracts-are-standalone',
      comment: '@lvn/contracts is published to clients; it imports nothing from this repo.',
      severity: 'error',
      from: { path: '^contracts/src/' },
      to: { path: '^(apps|contexts|libs)/' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(apps|contexts|libs)/[^/]+/(dist|coverage)/|^contracts/(dist|coverage)/|^libs/prisma-base/src/generated/|\\.test\\.ts$' },
    preserveSymlinks: true,
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['require', 'node', 'default'], mainFields: ['main', 'types'] },
  },
}
