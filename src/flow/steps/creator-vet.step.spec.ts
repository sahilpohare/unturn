import { CreatorVetStep } from './creator-vet.step';
import { makeContext, makeSnapshot } from './__mocks__/context';
import { mockFetchJson, mockFetchSequence } from './__mocks__/fetch';

const PROFILE = {
  name: 'Jane Doe',
  biography: 'Skincare lover & content creator',
  followers_count: 25000,
  follows_count: 800,
  media_count: 120,
  profile_picture_url: 'https://example.com/pic.jpg',
  is_verified: false,
};

function makeStep(config: Record<string, unknown> = {}) {
  return new CreatorVetStep(makeSnapshot('creator-vet', {
    handlesPath: '$.steps.find-creators.creators',
    minFollowers: 1000,
    topN: 5,
    ...config,
  }));
}

describe('CreatorVetStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns empty creators when handles list is empty', async () => {
    const step = makeStep();
    const ctx = makeContext({ steps: { 'find-creators': { creators: [] } } });
    const result = await step.execute(ctx);
    expect(result.output).toEqual({ creators: [] });
  });

  it('fetches profile via public fallback when no access token', async () => {
    mockFetchJson(PROFILE);

    const step = makeStep();
    const ctx = makeContext({ steps: { 'find-creators': { creators: ['janedoe'] } } });
    const result = await step.execute(ctx) as any;

    expect(result.output.creators).toHaveLength(1);
    expect(result.output.creators[0].handle).toBe('janedoe');
    expect(result.output.creators[0].followerCount).toBe(25000);
  });

  it('filters out creators below minFollowers', async () => {
    mockFetchJson({ ...PROFILE, followers_count: 500 });

    const step = makeStep({ minFollowers: 1000 });
    const ctx = makeContext({ steps: { 'find-creators': { creators: ['tinycreator'] } } });
    const result = await step.execute(ctx) as any;

    expect(result.output.creators).toHaveLength(0);
  });

  it('uses Graph API when INSTAGRAM_ACCESS_TOKEN is set', async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'test-token';
    mockFetchJson(PROFILE);

    const step = makeStep();
    const ctx = makeContext({ steps: { 'find-creators': { creators: ['janedoe'] } } });
    await step.execute(ctx);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('graph.facebook.com');
    expect(url).toContain('test-token');
  });

  it('falls back to public endpoint when Graph API fails', async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'bad-token';
    mockFetchSequence([
      { body: { error: 'invalid token' }, status: 401 },
      { body: PROFILE },
    ]);

    const step = makeStep();
    const ctx = makeContext({ steps: { 'find-creators': { creators: ['janedoe'] } } });
    const result = await step.execute(ctx) as any;

    expect(result.output.creators).toHaveLength(1);
  });

  it('scores and sorts creators by score descending', async () => {
    const highProfile = { ...PROFILE, followers_count: 100000, biography: 'a'.repeat(150) };
    const lowProfile = { ...PROFILE, followers_count: 2000, biography: 'short' };

    mockFetchSequence([
      { body: lowProfile },
      { body: highProfile },
    ]);

    const step = makeStep({ topN: 10 });
    const ctx = makeContext({ steps: { 'find-creators': { creators: ['lowcreator', 'highcreator'] } } });
    const result = await step.execute(ctx) as any;

    expect(result.output.creators[0].handle).toBe('highcreator');
    expect(result.output.creators[0].score).toBeGreaterThan(result.output.creators[1].score);
  });

  it('skips failed profile fetches without throwing', async () => {
    mockFetchSequence([
      { body: 'error', status: 500 },
      { body: PROFILE },
    ]);

    const step = makeStep();
    const ctx = makeContext({ steps: { 'find-creators': { creators: ['broken', 'good'] } } });
    const result = await step.execute(ctx) as any;

    expect(result.output.creators).toHaveLength(1);
    expect(result.output.creators[0].handle).toBe('good');
  });

  it('caps at topN results', async () => {
    mockFetchJson(PROFILE);
    (global.fetch as jest.Mock)
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(PROFILE), text: () => Promise.resolve('') } as any);

    const step = makeStep({ topN: 2 });
    const ctx = makeContext({ steps: { 'find-creators': { creators: ['a', 'b', 'c', 'd'] } } });
    const result = await step.execute(ctx) as any;

    expect(result.output.creators.length).toBeLessThanOrEqual(2);
  });
});
