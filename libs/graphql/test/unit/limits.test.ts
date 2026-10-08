import { getIntrospectionQuery, parse } from 'graphql'
import { isIntrospectionOnly, MAX_DEPTH, queryDepth } from '../../src/limits'

describe('queryDepth', () => {
  it('counts field nesting', () => {
    expect(queryDepth(parse('{ a }'))).toBe(1)
    expect(queryDepth(parse('{ a { b { c } } d }'))).toBe(3)
  })

  it('follows fragments and inline fragments', () => {
    const doc = parse('query Q { a { ...F } } fragment F on T { b { ... on U { c { d } } } }')
    expect(queryDepth(doc, 'Q')).toBe(4)
  })

  it('does not loop on recursive fragments', () => {
    const doc = parse('{ a { ...F } } fragment F on T { b { ...F } }')
    expect(queryDepth(doc)).toBe(2)
  })

  it('measures the named operation only', () => {
    const doc = parse('query Shallow { a } query Deep { a { b { c } } }')
    expect(queryDepth(doc, 'Shallow')).toBe(1)
    expect(queryDepth(doc, 'Deep')).toBe(3)
  })

  it('has the limit from the spec', () => {
    expect(MAX_DEPTH).toBe(8)
  })
})

describe('isIntrospectionOnly', () => {
  it('exempts the standard introspection query, which nests deeper than the limit', () => {
    const doc = parse(getIntrospectionQuery())
    expect(queryDepth(doc)).toBeGreaterThan(MAX_DEPTH)
    expect(isIntrospectionOnly(doc)).toBe(true)
  })

  it('does not exempt an operation that also selects real fields', () => {
    expect(isIntrospectionOnly(parse('{ __typename termsVersion }'))).toBe(false)
    expect(isIntrospectionOnly(parse('query A { __typename } query B { viewer { id } }'), 'B')).toBe(false)
    expect(isIntrospectionOnly(parse('query A { __typename } query B { viewer { id } }'), 'A')).toBe(true)
  })
})
