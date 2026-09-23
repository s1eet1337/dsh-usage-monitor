/**
 * Resolve one provider's API key WITHOUT storing it: first ask the DSH
 * credentials service (the same store the Settings → Models page writes),
 * then fall back to the process environment. Never logs or persists it.
 */
export async function resolveProviderKey(credentials, meta, envNameOverride) {
    const envNames = envNameOverride !== undefined && envNameOverride !== '' ? [envNameOverride] : [...meta.keyEnv];
    if (credentials !== undefined) {
        for (const name of envNames) {
            try {
                const cred = await credentials.resolve(name);
                if (cred !== undefined && typeof cred.value === 'string' && cred.value !== '') {
                    return { value: cred.value, source: 'credentials' };
                }
            }
            catch {
                // credentials service may not know this ref; keep falling back.
            }
        }
    }
    for (const name of envNames) {
        const env = process.env[name];
        if (typeof env === 'string' && env !== '')
            return { value: env, source: 'env' };
    }
    return undefined;
}
