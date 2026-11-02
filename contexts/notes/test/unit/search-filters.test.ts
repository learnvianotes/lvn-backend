import { classroomsFilter, groupsFilter, noteFiltersFilter, peopleFilter, topicsFilter, visibleNotesFilter } from '../../src/application/search-filters'
import { quote } from '../../src/infrastructure/typesense'

/** The read predicate as Typesense filters (ADR-0055); the integration test holds them to Postgres on seeded data. */
describe('search filters', () => {
  it('gives a signed-out visitor public notes that are not held, hidden or removed', () => {
    expect(visibleNotesFilter({ viewerId: null, groupIds: ['g1'], classroomIds: [], blockedIds: ['b1'] })).toBe('visibility:=PUBLIC && moderation:=OK')
  })

  it('reaches a signed-in viewer through ownership, the public, shares, groups and classes', () => {
    expect(visibleNotesFilter({ viewerId: 'v1', groupIds: ['g1', 'g2'], classroomIds: ['c1'], blockedIds: [] })).toBe(
      '(ownerId:=`v1` || (visibility:=PUBLIC && moderation:=OK) || (visibility:=[SHARED,UNLISTED,PUBLIC] && moderation:=[OK,PENDING_REVIEW] && (sharedUserIds:=`v1` || groupIds:=[`g1`,`g2`] || classroomIds:=[`c1`])))',
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

  it('offers curated topics, and the ones the viewer proposed, of a subject when asked', () => {
    expect(topicsFilter(null)).toBe('origin:=CURATED')
    expect(topicsFilter('v1')).toBe('(origin:=CURATED || proposedById:=`v1`)')
    expect(topicsFilter('v1', 's1')).toBe('(origin:=CURATED || proposedById:=`v1`) && subjectId:=`s1`')
  })

  it('finds public groups, private ones only for their members, and classes only for theirs (ADR-0056)', () => {
    expect(groupsFilter([])).toBe('privacy:=PUBLIC')
    expect(groupsFilter(['g1'])).toBe('privacy:=PUBLIC || id:=[`g1`]')
    expect(classroomsFilter([])).toBeNull()
    expect(classroomsFilter(['c1', 'c2'])).toBe('id:=[`c1`,`c2`]')
  })

  describe('filters (ADR-0056)', () => {
    const viewer = { viewerId: 'v1', groupIds: ['g1'], classroomIds: [], blockedIds: [] }
    it('narrows by kind, subject, topic and author', () => {
      expect(noteFiltersFilter({}, viewer)).toBe('')
      expect(noteFiltersFilter({ kinds: ['BLOG', 'POST'], subjectId: 's1', topicId: 't1', authorId: 'a1' }, viewer)).toBe('kind:=[BLOG,POST] && subjectIds:=`s1` && topicIds:=`t1` && ownerId:=`a1`')
      // Any of several topics (an exam's, ADR-0076).
      expect(noteFiltersFilter({ topicIds: ['t1', 't2'] }, viewer)).toBe('topicIds:=[`t1`,`t2`]')
    })
    it('tells own, shared and public notes apart', () => {
      expect(noteFiltersFilter({ sources: ['MINE'] }, viewer)).toBe('(ownerId:=`v1`)')
      expect(noteFiltersFilter({ sources: ['SHARED', 'PUBLIC'] }, viewer)).toBe('((ownerId:!=`v1` && (sharedUserIds:=`v1` || groupIds:=[`g1`])) || (ownerId:!=`v1` && visibility:=PUBLIC))')
    })
    it('gives a signed-out visitor public notes only, and nothing when they ask for none', () => {
      const anonymous = { viewerId: null, groupIds: [], classroomIds: [], blockedIds: [] }
      expect(noteFiltersFilter({ sources: ['MINE', 'PUBLIC'] }, anonymous)).toBe('(visibility:=PUBLIC)')
      expect(noteFiltersFilter({ sources: ['MINE', 'SHARED'] }, anonymous)).toBeNull()
    })
  })
})
