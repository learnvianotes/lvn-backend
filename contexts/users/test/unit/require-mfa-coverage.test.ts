import path from 'node:path'
import { platformAdminFields, requireMfaFields } from './require-mfa-scan'

const graphql = path.join(__dirname, '../../src/graphql')

/**
 * Every users-context operation described as platform-admin is marked @RequireMfa().
 * That marker is what blocks a session that has not finished MFA, and what writes the audit row for a mutation.
 */
describe('admin operations require MFA', () => {
  const fields = platformAdminFields(graphql)
  const marked = requireMfaFields(graphql)

  it('finds the admin operations', () => {
    expect(fields).toEqual(expect.arrayContaining(['adminMetrics', 'updateAdminSetting', 'adminDeleteUser', 'setGlobalRole', 'adminRecoverMfa']))
  })

  it.each(fields)('%s is marked @RequireMfa()', (field) => {
    expect(marked.has(field)).toBe(true)
  })
})
