import { identityFromGoogleClaims } from '../../src/application/providers'

const verified = {
  uid: 'firebase-uid-1',
  email: '  Person@Gmail.com ',
  email_verified: true,
  name: 'Person',
  firebase: { sign_in_provider: 'google.com' },
}

describe('identityFromGoogleClaims', () => {
  it('accepts a Google token whose email is verified', () => {
    expect(identityFromGoogleClaims(verified)).toEqual({
      provider: 'GOOGLE',
      providerSubject: 'firebase-uid-1',
      email: '  Person@Gmail.com ',
      emailVerified: true,
      name: 'Person',
    })
  })

  it.each([
    ['email_verified is false', { email_verified: false }],
    ['email_verified is missing', { email_verified: undefined }],
    ['the provider is not Google', { firebase: { sign_in_provider: 'password' } }],
    ['there is no email', { email: '   ' }],
    ['the email is missing', { email: undefined }],
  ])('rejects a token when %s', (_label, over) => {
    expect(identityFromGoogleClaims({ ...verified, ...over })).toBeNull()
  })
})
