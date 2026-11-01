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

  it('keeps an unverified Google email as an identity so it is not treated as a forged token', () => {
    expect(identityFromGoogleClaims({ ...verified, email_verified: false })).toMatchObject({ emailVerified: false, email: verified.email })
    expect(identityFromGoogleClaims({ ...verified, email_verified: undefined })).toMatchObject({ emailVerified: false })
    expect(identityFromGoogleClaims({ ...verified, email_verified: 'true' as unknown as boolean })!.emailVerified).toBe(false)
  })

  it('uses firebase.identities.email when the top-level email is missing', () => {
    expect(identityFromGoogleClaims({ ...verified, email: undefined, firebase: { sign_in_provider: 'google.com', identities: { email: ['person@gmail.com'] } } })).toMatchObject({
      email: 'person@gmail.com',
      emailVerified: true,
    })
  })

  it.each([
    ['the provider is not Google', { firebase: { sign_in_provider: 'password' } }],
    ['there is no email', { email: '   ' }],
    ['the email is missing', { email: undefined }],
  ])('rejects a token when %s', (_label, over) => {
    expect(identityFromGoogleClaims({ ...verified, ...over })).toBeNull()
  })
})
