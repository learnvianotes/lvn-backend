import { domainAndParents, domainOf, isAcademic, isPersonalOrDisposable } from '../../src/domain/email-domains'

describe('institutional email domains (ADR-0017)', () => {
  it('takes the domain after the last @, lower-cased', () => {
    expect(domainOf('A.Rao@CSE.IITB.AC.IN')).toBe('cse.iitb.ac.in')
  })

  it.each(['gmail.com', 'outlook.com', 'yahoo.co.in', 'icloud.com', 'proton.me', 'rediffmail.com', 'mailinator.com', 'yopmail.com'])('refuses %s', (d) => {
    expect(isPersonalOrDisposable(d)).toBe(true)
  })

  it.each(['iitb.ac.in', 'cse.iitm.ac.in', 'stanford.edu', 'ox.ac.uk', 'unimelb.edu.au', 'iisc.ernet.in'])('recognises %s as academic', (d) => {
    expect(isAcademic(d)).toBe(true)
  })

  it.each(['acme.com', 'edu', 'ac.in', 'notedu.com', 'education.org'])('does not treat %s as academic', (d) => {
    expect(isAcademic(d)).toBe(false)
  })

  it('lists the domain and its parents for organisation matching', () => {
    expect(domainAndParents('cse.iitb.ac.in')).toEqual(['cse.iitb.ac.in', 'iitb.ac.in', 'ac.in'])
    expect(domainAndParents('acme.com')).toEqual(['acme.com'])
  })
})
