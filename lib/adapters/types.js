export const unsupportedOutcome = (id, docs) => ({
    ok: false,
    code: 'unsupported',
    message: `${id} 官方 API 未提供对 API Key 的余额查询（详见 ${docs}）`,
});
