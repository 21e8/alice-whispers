// Mock fetch globally
if (!global.fetch) {
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('')
    })
  ) as unknown as typeof fetch;
} 
