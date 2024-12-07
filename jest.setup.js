// Mock fetch globally
if (!global.fetch) {
    global.fetch = jest.fn(function () {
        return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Map(),
            json: function () { return Promise.resolve({}); },
            text: function () { return Promise.resolve(''); }
        });
    });
}
