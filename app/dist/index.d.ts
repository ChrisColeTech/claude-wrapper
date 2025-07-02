/**
 * Claude Code OpenAI Wrapper - Server Logic
 * Main server functionality
 *
 * Based on Python implementation main.py
 */
export interface ServerOptions {
    port?: number;
    verbose?: boolean;
    debug?: boolean;
    interactive?: boolean;
}
export declare function startServer(options?: ServerOptions): Promise<void>;
//# sourceMappingURL=index.d.ts.map