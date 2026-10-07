import { Module } from '@nestjs/common'
import { Query, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { Test } from '@nestjs/testing'
import { UsersModule, usersSubgraph } from '@lvn-backend/users'
import { graphqlModules } from '@lvn-backend/graphql'
import { PrismaModule } from '@lvn-backend/prisma-base'
import { AccessTokenVerifier } from '@lvn-backend/auth-guard'
import { resetDatabase } from '@lvn-backend/testing'
import request from 'supertest'
import { buildRequestContext } from '../../src/graphql/request-context'
import { TOKEN_AUDIENCE } from '../../src/app.module'
import { testConfig } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * A second subgraph that extends `User` the way `notes` and `core` will (Federation 2 entities). Proves that the
 * gateway composes several in-process subgraphs and plans one query across them.
 */
const probeTypeDefs = /* GraphQL */ `
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.6", import: ["@key"])
  scalar UUID
  type User @key(fields: "id") {
    id: UUID!
    noteCount: Int!
  }
  type Query {
    probe: String!
  }
`

@Resolver('User')
class ProbeUserResolver {
  @ResolveReference()
  resolveReference(ref: { id: string }) {
    return { id: ref.id }
  }

  @ResolveField('noteCount')
  noteCount(user: { id: string }): number {
    return user.id.length
  }
}

@Resolver()
class ProbeQueryResolver {
  @Query('probe')
  probe(): string {
    return 'ok'
  }
}

@Module({ providers: [ProbeUserResolver, ProbeQueryResolver] })
class ProbeModule {}

describe('federation across in-process subgraphs', () => {
  it('composes users + a second subgraph and resolves one entity across both', async () => {
    const config = testConfig()
    await resetDatabase(config.DATABASE_URL)
    const moduleRef = await Test.createTestingModule({
      imports: [
        PrismaModule.forRoot(config.DATABASE_URL),
        UsersModule,
        ProbeModule,
        ...graphqlModules({
          subgraphs: [usersSubgraph, { name: 'probe', typeDefs: probeTypeDefs, modules: [ProbeModule] }],
          context: buildRequestContext(new AccessTokenVerifier(config.JWT_PUBLIC_KEY, config.JWT_ISSUER, TOKEN_AUDIENCE)),
          introspection: false,
        }),
      ],
    }).compile()
    const app = moduleRef.createNestApplication({ logger: false })
    await app.init()
    try {
      const user = await seedUser(app)
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('authorization', `Bearer ${tokenFor(config, user.id)}`)
        .send({ query: '{ probe viewer { id displayName noteCount } }' })
      expect(res.body.errors).toBeUndefined()
      expect(res.body.data).toEqual({ probe: 'ok', viewer: { id: user.id, displayName: 'Test User', noteCount: user.id.length } })
    } finally {
      await app.close()
    }
  })
})
