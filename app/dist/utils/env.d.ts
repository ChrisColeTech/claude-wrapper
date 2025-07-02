/**
 * Environment variable configuration
 * Based on Python main.py environment handling
 */
export interface Config {
    DEBUG_MODE: boolean;
    VERBOSE: boolean;
    PORT: number;
    CORS_ORIGINS: string;
    MAX_TIMEOUT: number;
    API_KEY: string | undefined;
}
export declare const config: Config;
//# sourceMappingURL=env.d.ts.map