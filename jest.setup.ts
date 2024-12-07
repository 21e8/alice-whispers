// Make this a module by adding an export
export {};

const mockFetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  redirected: false,
  type: 'basic' as ResponseType,
  url: 'https://mock.url',
  json: async () => ({}),
  text: async () => '',
  clone: () => ({} as Response),
  body: null,
  bodyUsed: false,
  arrayBuffer: async () => new ArrayBuffer(0),
  blob: async () => new Blob(),
  formData: async () => new FormData(),
})) as jest.Mock<Promise<Response>>;

global.fetch = mockFetch;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
