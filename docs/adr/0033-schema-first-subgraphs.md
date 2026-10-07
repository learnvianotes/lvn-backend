# ADR-0033: Schema-first subgraphs (SDL per context) instead of code-first

- Status: Accepted
- Date: 2026-10-08
- Deciders: Backend agent; owner (standing instruction to follow the spec, deviations recorded as ADRs)
- Spec sections: §2 (Backend), §6, §6.2, §6.5

## Context

§2 pins "code-first Apollo Federation 2 subgraphs composed in-process by Apollo Gateway" and §6.2 "Code-first with
`@nestjs/graphql`". Building the first two subgraphs showed that the two halves of that sentence cannot both hold in
one process: Nest's code-first type registry (`TypeMetadataStorage`) is global to the process, so when a second
context extends an entity — `notes` adding `User.notes`, exactly what federation is for — both subgraphs see both
`User` classes and schema generation fails with "Schema must contain uniquely named types but contains multiple types
named User" (reproduced in `apps/api/test/integration/federation.test.ts` before this change).

The alternatives were a single code-first schema for the whole process (one subgraph, split only at extraction —
the "rewrite" §6.5 warns against) or schema-first subgraphs.

## Decision

- Each context owns its subgraph as **SDL**: `contexts/<ctx>/src/graphql/*.graphql`, Federation 2
  (`extend schema @link(url: "https://specs.apollo.dev/federation/v2.6", …)`). The facade exports
  `<ctx>Subgraph = { name, typeDefs, modules }`; `apps/api` passes them to `graphqlModules()` (libs/graphql), which
  builds one `ApolloFederationDriver` module per context and the Apollo Gateway over them with
  `LocalGraphQLDataSource` — composed and executed in-process, as §6 intends.
- Resolvers stay Nest classes (`@Resolver('User')`, `@Query('viewer')`, `@ResolveField`, `@ResolveReference`) with
  dependency injection, guards and pipes unchanged.
- Type safety comes from the SDL: `scripts/graphql-types.mjs <ctx>` generates `schema.types.ts` (interfaces, enums,
  argument types) from the subgraph built by Apollo's `buildSubgraphSchema`. Each context's build regenerates it;
  `typecheck` fails when the committed file is stale.
- §6.2's export stands: `scripts/export-supergraph.mjs` composes every context's SDL with Apollo's composition rules
  and writes `contracts/graphql/supergraph.graphql` (and the client-facing `schema.graphql`) on every build; CI diffs
  it.
- The Phase 0 hand-written skeleton (`contracts/graphql/schema-skeleton.graphql`) is the agreed shape the SDL files
  implement, part by part, phase by phase.

## Consequences

- Subgraphs are federation-correct from the first commit: a context that is extracted (§6.5 step 4) takes its SDL and
  resolvers as they are; nothing is rewritten.
- Schema changes are reviewed as SDL, which is what clients consume; the generated types keep resolvers honest.
- Writing SDL and resolvers is slightly more typing than code-first decorators.
- If Nest gains per-module type registries, code-first can be reconsidered; the SDL would then be generated, not
  written.
