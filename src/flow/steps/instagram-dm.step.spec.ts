import { InstagramDmStep } from './instagram-dm.step';
import { makeContext, makeSnapshot } from './__mocks__/context';
import { mockFetchJson } from './__mocks__/fetch';

function makeStep(config: Record<string, unknown> = {}) {
  return new InstagramDmStep(makeSnapshot('instagram-dm', {
    recipientIdPath: '$.steps.vet.creators[0].recipientId',
    messagePath: '$.steps.agent.text',
    ...config,
  }));
}

describe('InstagramDmStep', () => {
  beforeEach(() => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-token';
    process.env.INSTAGRAM_USER_ID = 'ig-user-123';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_USER_ID;
  });

  it('sends DM and returns sent status', async () => {
    mockFetchJson({ message_id: 'msg-1' });

    const ctx = makeContext({
      steps: {
        vet: { creators: [{ recipientId: 'user-456' }] },
        agent: { text: 'Hey! Love your skincare content. Collab?' },
      },
    });

    const result = await makeStep().execute(ctx) as any;

    expect(result.output.results[0].status).toBe('sent');
    expect(result.output.results[0].recipientId).toBe('user-456');

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('ig-user-123/messages');
    const body = JSON.parse(opts.body);
    expect(body.recipient.id).toBe('user-456');
    expect(body.message.text).toBe('Hey! Love your skincare content. Collab?');
  });

  it('returns failed status on API error without throwing', async () => {
    mockFetchJson({ error: 'rate limited' }, 429);

    const ctx = makeContext({
      steps: {
        vet: { creators: [{ recipientId: 'user-456' }] },
        agent: { text: 'Hey!' },
      },
    });

    const result = await makeStep().execute(ctx) as any;
    expect(result.output.results[0].status).toBe('failed');
    expect(result.output.results[0].error).toContain('429');
  });

  it('throws nonRetryable when INSTAGRAM_ACCESS_TOKEN missing', async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    const ctx = makeContext({ steps: { vet: { creators: [{ recipientId: 'x' }] }, agent: { text: 'hi' } } });
    await expect(makeStep().execute(ctx)).rejects.toThrow('INSTAGRAM_ACCESS_TOKEN not set');
  });

  it('throws nonRetryable when INSTAGRAM_USER_ID missing', async () => {
    delete process.env.INSTAGRAM_USER_ID;
    const ctx = makeContext({ steps: { vet: { creators: [{ recipientId: 'x' }] }, agent: { text: 'hi' } } });
    await expect(makeStep().execute(ctx)).rejects.toThrow('INSTAGRAM_USER_ID not set');
  });
});
