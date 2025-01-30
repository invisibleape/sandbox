export interface ReownSessionProposal {
  id: number;
  params: {
    proposer: {
      metadata?: {
        walletId?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  pairingTopic?: string;
}

export interface ReownSessionRequest {
  topic: string;
  params: {
    request: {
      method: string;
      params: unknown[];
    };
    [key: string]: unknown;
  };
  id: string;
}

export interface ReownSessionDelete {
  topic: string;
}

export interface ReownSessionAuthenticate {
  id: string;
  params: {
    metadata?: {
      walletId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface ReownEvents {
  session_proposal: (proposal: ReownSessionProposal) => Promise<void>;
  session_request: (request: ReownSessionRequest) => Promise<void>;
  session_delete: (event: ReownSessionDelete) => Promise<void>;
  session_authenticate: (payload: ReownSessionAuthenticate) => Promise<void>;
  pairing: (event: { topic: string; peerMetadata?: { session?: { walletId?: string } } }) => void;
}

export interface ReownKit {
  on<K extends keyof ReownEvents>(event: K, handler: ReownEvents[K]): void;
  pair(options: { uri: string; metadata: Record<string, unknown> }): Promise<void>;
  approveSession(options: {
    id: number;
    namespaces: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  rejectSession(options: {
    id: number;
    reason: { code: number; message: string };
  }): Promise<void>;
  respondSessionRequest(options: {
    topic: string;
    response: {
      id: number;
      jsonrpc: '2.0';
      result?: unknown;
      error?: {
        code: number;
        message: string;
      };
    };
  }): Promise<void>;
  getActiveSessions(): Record<string, { address: string }>;
  formatAuthMessage(options: { chainId: number; address: string }): string;
  approveSessionAuthenticate(options: { id: number; signature: string }): Promise<void>;
  rejectSessionAuthenticate(options: { id: number; reason: string }): Promise<void>;
}