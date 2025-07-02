/**
 * Session service - To be implemented in Phase 5
 * Business logic layer for session management
 * Uses in-memory storage matching Python approach exactly
 */
export declare class SessionService {
    private sessions;
    createSession(_sessionId: string): Promise<any>;
    getSession(sessionId: string): Promise<any>;
    updateSession(_sessionId: string, _data: any): Promise<any>;
    deleteSession(sessionId: string): Promise<boolean>;
    cleanupExpiredSessions(): Promise<number>;
}
//# sourceMappingURL=session-service.d.ts.map