export class MockResponse implements Response {
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly type:
    | 'basic'
    | 'cors'
    | 'default'
    | 'error'
    | 'opaque'
    | 'opaqueredirect';
  readonly url: string;
  readonly body: ReadableStream | null;
  readonly bodyUsed: boolean;

  constructor(private data: any = {}) {
    this.headers = new Headers();
    this.ok = data.ok ?? true;
    this.redirected = false;
    this.status = (data.error_code || data.status) ?? 200;
    this.statusText = data.statusText ?? 'OK';
    this.type = 'basic';
    this.url = data.url ?? '';
    this.body = data.body ?? null;
    this.bodyUsed = false;
  }

  json() {
    return Promise.resolve(this.data);
  }
  text() {
    return Promise.resolve('');
  }
  blob() {
    return Promise.resolve(new Blob([]));
  }
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }
  formData() {
    return Promise.resolve(new FormData());
  }
  clone(): Response {
    return new MockResponse(this.data);
  }
}

describe('MockResponse', () => {
  it('should create a mock response', () => {
    const response = new MockResponse();
    expect(response).toBeDefined();
  });
});

it('should initialize with default values', () => {
  const response = new MockResponse();
  expect(response.ok).toBe(true);
  expect(response.redirected).toBe(false);
  expect(response.status).toBe(200);
  expect(response.statusText).toBe('OK');
  expect(response.type).toBe('basic');
  expect(response.url).toBe('');
  expect(response.body).toBe(null);
  expect(response.bodyUsed).toBe(false);
  expect(response.headers).toBeInstanceOf(Headers);
});

it('should initialize with custom data', () => {
  const data = {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    url: 'https://test.com',
    body: new ReadableStream(),
  };
  const response = new MockResponse(data);
  expect(response.ok).toBe(false);
  expect(response.status).toBe(404);
  expect(response.statusText).toBe('Not Found');
  expect(response.url).toBe('https://test.com');
  expect(response.body).toBe(data.body);
});

it('should handle error_code in data', () => {
  const response = new MockResponse({ error_code: 400 });
  expect(response.status).toBe(400);
});

it('should return data as JSON', async () => {
  const data = { message: 'test' };
  const response = new MockResponse(data);
  const result = await response.json();
  expect(result).toEqual(data);
});

it('should return empty string for text()', async () => {
  const response = new MockResponse();
  const result = await response.text();
  expect(result).toBe('');
});

it('should return empty Blob for blob()', async () => {
  const response = new MockResponse();
  const result = await response.blob();
  expect(result).toBeInstanceOf(Blob);
  expect(result.size).toBe(0);
});

it('should return empty ArrayBuffer for arrayBuffer()', async () => {
  const response = new MockResponse();
  const result = await response.arrayBuffer();
  expect(result).toBeInstanceOf(ArrayBuffer);
  expect(result.byteLength).toBe(0);
});

it('should return empty FormData for formData()', async () => {
  const response = new MockResponse();
  const result = await response.formData();
  expect(result).toBeInstanceOf(FormData);
});

it('should create clone with same data', () => {
  const data = { message: 'test' };
  const response = new MockResponse(data);
  const clone = response.clone();

  expect(clone).toBeInstanceOf(MockResponse);
  expect(clone.ok).toBe(response.ok);
  expect(clone.status).toBe(response.status);
  expect(clone.statusText).toBe(response.statusText);
});
