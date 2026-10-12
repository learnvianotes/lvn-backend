import { peopleFilter, topicsFilter, visibleNotesFilter } from '../../src/application/search-filters'
import { quote } from '../../src/infrastructure/typesense'

/** The read predicate as Typesense filters (ADR-0055); the integration test holds them to Postgres on seeded data. */
describe('search filters', () => {
  it('gives a signed-out visitor public notes that are not held, hidden or removed', () => {
    expect(visibleNotesFilter({ viewerId: null, groupIds: ['g1'], classroomIds: [], blockedIds: ['b1'] })).toBe('visibility:=PUBLIC && moderation:=OK')
  })

  it('reaches a signed-in viewer through ownership, the public, shares, groups and classes', () => {
    expect(visibleNotesFilter({ viewerId: 'v1', groupIds: ['g1', 'g2'], classroomIds: ['c1'], blockedIds: [] })).toBe(
      '(ownerId:=`v1` || (visibility:=PUBLIC && moderation:=OK) || (visibility:=[SHARED,PUBLIC] && moderation:=[OK,PENDING_REVIEW] && (sharedUserIds:=`v1` || groupIds:=[`g1`,`g2`] || classroomIds:=[`c1`])))',
    )
  })

  it('leaves out empty memberships and every note of a blocked person', () => {
    const filter = visibleNotesFilter({ viewerId: 'v1', groupIds: [], classroomIds: [], blockedIds: ['b1', 'b2'] })
    expect(filter).not.toContain('groupIds')
    expect(filter).not.toContain('classroomIds')
    expect(filter.endsWith(' && ownerId:!=[`b1`,`b2`]')).toBe(true)
  })

  it('quotes values so none reads as filter syntax', () => {
    expect(quote('a`b || ownerId:=x')).toBe('`a\\`b || ownerId:=x`')
  })

  it('finds people past the consent age today, never across a block', () => {
    expect(peopleFilter(20_000, [])).toBe('adultFromDays:<=20000')
    expect(peopleFilter(20_000, ['b1'])).toBe('adultFromDays:<=20000 && id:!=[`b1`]')
  })

  it('offers curated topics, and the ones the viewer proposed', () => {
    expect(topicsFilter(null)).toBe('origin:=CURATED')
    expect(topicsFilter('v1')).toBe('origin:=CURATED || proposedById:=`v1`')
  })
})
