export interface AtsAdapter {
  readonly id: string;
  supports(url: URL): boolean;
  initialize(): Promise<void>;
}

// ATS-specific implementations intentionally begin in a later milestone.
