/**
 * Helpers to mock global fetch in Jest.
 * Call mockFetchJson / mockFetchHtml before the test, restore after.
 */
export function mockFetchJson(body: unknown, status = 200) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

export function mockFetchHtml(html: string, status = 200) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(html),
    json: () => Promise.reject(new Error('not json')),
  } as unknown as Response);
}

export function mockFetchSequence(responses: Array<{ body: unknown; status?: number; html?: boolean }>) {
  const spy = jest.spyOn(global, 'fetch');
  for (const r of responses) {
    const status = r.status ?? 200;
    const ok = status >= 200 && status < 300;
    if (r.html) {
      spy.mockResolvedValueOnce({
        ok, status,
        text: () => Promise.resolve(r.body as string),
        json: () => Promise.reject(new Error('not json')),
      } as unknown as Response);
    } else {
      spy.mockResolvedValueOnce({
        ok, status,
        json: () => Promise.resolve(r.body),
        text: () => Promise.resolve(JSON.stringify(r.body)),
      } as unknown as Response);
    }
  }
  return spy;
}
