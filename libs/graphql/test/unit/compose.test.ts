import { buildSubgraphSchema } from '@apollo/subgraph'
import { parse } from 'graphql'
import { composeSupergraph } from '../../src/compose'

const link = 'extend schema @link(url: "https://specs.apollo.dev/federation/v2.6", import: ["@key"])'
const subgraph = (sdl: string) => buildSubgraphSchema([{ typeDefs: parse(`${link}\n${sdl}`) }])

describe('composeSupergraph', () => {
  it('composes an entity owned by one subgraph and extended by another', () => {
    const sdl = composeSupergraph([
      { name: 'users', schema: subgraph('type User @key(fields: "id") { id: ID! name: String! } type Query { viewer: User }') },
      { name: 'notes', schema: subgraph('type User @key(fields: "id") { id: ID! noteCount: Int! } type Query { notes: [String!]! }') },
    ])
    expect(sdl).toContain('join__Graph')
    expect(sdl).toMatch(/noteCount: Int!.*@join__field\(graph: NOTES\)/)
  })

  it('fails with the composition errors when subgraphs disagree', () => {
    expect(() =>
      composeSupergraph([
        { name: 'a', schema: subgraph('type Query { x: String }') },
        { name: 'b', schema: subgraph('type Query { x: Int }') },
      ]),
    ).toThrow(/Supergraph composition failed/)
  })
})
