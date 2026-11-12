import { VersionResolver } from '../../src/graphql/version.resolver'

describe('version', () => {
  it('answers the running release to anyone', () => {
    expect(new VersionResolver().version()).toMatch(/^v\d+\.\d+\.\d+\+/)
  })
})
