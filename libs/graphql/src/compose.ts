import { composeServices } from '@apollo/composition'
import { printSubgraphSchema } from '@apollo/subgraph'
import { parse, type GraphQLSchema } from 'graphql'

/**
 * Composes subgraph schemas into a supergraph SDL with Apollo's composition rules — the same step Apollo Router
 * performs after a context is extracted (§6.5 step 4). Throws with every composition error.
 */
export function composeSupergraph(subgraphs: { name: string; schema: GraphQLSchema }[]): string {
  const result = composeServices(
    subgraphs.map(({ name, schema }) => ({ name, url: `local://${name}`, typeDefs: parse(printSubgraphSchema(schema)) })),
  )
  if (result.errors?.length || !result.supergraphSdl) {
    throw new Error(`Supergraph composition failed:\n${(result.errors ?? []).map((e) => `  ${e.message}`).join('\n')}`)
  }
  return result.supergraphSdl
}
