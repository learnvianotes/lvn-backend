import { reportedFailureTags } from '../../src/queues'

describe('reportedFailureTags', () => {
  it('passes the file owner through when the error carries a user id', () => {
    const err = Object.assign(new Error('scan service did not return a verdict'), { userId: '01920000-0000-7000-8000-000000000001' })
    expect(reportedFailureTags(err, { queue: 'notes.media', jobId: 'job-1', job: 'process-file' })).toEqual({
      queue: 'notes.media',
      jobId: 'job-1',
      job: 'process-file',
      userId: '01920000-0000-7000-8000-000000000001',
    })
  })

  it('omits a user id the error does not have', () => {
    expect(reportedFailureTags(new Error('boom'), { queue: 'notes.media' }).userId).toBeUndefined()
    expect(reportedFailureTags(Object.assign(new Error('boom'), { userId: '' }), { queue: 'notes.media' }).userId).toBeUndefined()
  })
})
