import type { ApplicationSession, ApplicationState, FieldFillResult, UnknownFieldInfo } from "../shared/types";

export class SessionManager {
  private sessions: Map<number, ApplicationSession> = new Map();

  getOrCreateSession(tabId: number, tenant: string, url: string): ApplicationSession {
    const existing = this.sessions.get(tabId);
    if (existing && existing.tenant === tenant) {
      return existing;
    }

    const now = new Date().toISOString();
    const session: ApplicationSession = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
      tabId,
      tenant,
      applicationUrl: url,
      currentPage: "Initial Page",
      state: "APPLICATION_DETECTED",
      startedAt: now,
      lastUpdatedAt: now,
      results: [],
      unknownFields: []
    };

    this.sessions.set(tabId, session);
    return session;
  }

  getSession(tabId: number): ApplicationSession | undefined {
    return this.sessions.get(tabId);
  }

  updateSessionState(
    tabId: number,
    state: ApplicationState,
    currentPage?: string,
    results?: FieldFillResult[],
    unknownFields?: UnknownFieldInfo[]
  ): void {
    const session = this.sessions.get(tabId);
    if (!session) return;

    session.state = state;
    session.lastUpdatedAt = new Date().toISOString();
    if (currentPage) session.currentPage = currentPage;
    if (results) session.results = results;
    if (unknownFields) session.unknownFields = unknownFields;
  }

  removeSession(tabId: number): void {
    this.sessions.delete(tabId);
  }
}
