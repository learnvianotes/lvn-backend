import { ResendAudienceClient, type ResendContactsApi, type ResendResult } from '../../src/audience/resend-contacts'

function ok<T>(data: T): ResendResult<T> {
  return { data, error: null }
}

function fail(statusCode: number, name: string, message: string): ResendResult<never> {
  return { data: null, error: { statusCode, name, message } }
}

describe('ResendAudienceClient', () => {
  const contact = { email: 'asha@college.edu', firstName: 'Asha', lastName: 'Rao', unsubscribed: false }

  it('creates a contact, and updates the same email when it already exists', async () => {
    const calls: string[] = []
    const api: ResendContactsApi = {
      create: async () => {
        calls.push('create')
        return fail(409, 'validation_error', 'Contact already exists')
      },
      update: async () => {
        calls.push('update')
        return ok({ id: 'contact-1' })
      },
      remove: async () => ok({ deleted: true }),
    }
    await new ResendAudienceClient('aud-1', api).upsert(contact)
    expect(calls).toEqual(['create', 'update'])
  })

  it('removes a contact and treats a missing one as done', async () => {
    const api: ResendContactsApi = {
      create: async () => ok({ id: 'x' }),
      update: async () => ok({ id: 'x' }),
      remove: async () => fail(404, 'not_found', 'Contact not found'),
    }
    await expect(new ResendAudienceClient('aud-1', api).remove(contact.email)).resolves.toBeUndefined()
  })

  it('sets unsubscribed without repeating the address in an error', async () => {
    const seen: unknown[] = []
    const api: ResendContactsApi = {
      create: async () => ok({ id: 'x' }),
      update: async (input) => {
        seen.push(input)
        return fail(500, 'internal_server_error', `failed for ${contact.email}`)
      },
      remove: async () => ok({ deleted: true }),
    }
    const client = new ResendAudienceClient('aud-1', api)
    await expect(client.setUnsubscribed(contact.email, true)).rejects.toThrow(/internal_server_error/)
    await expect(client.setUnsubscribed(contact.email, true)).rejects.not.toThrow(/asha@college.edu/)
    expect(seen[0]).toMatchObject({ audienceId: 'aud-1', email: contact.email, unsubscribed: true })
  })
})
