import { useEffect, useRef, useCallback } from 'react';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export type SyncEventType = 
  | 'vault.created'
  | 'vault.updated'
  | 'vault.deleted'
  | 'blob.uploaded'
  | 'blob.deleted'
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'team.member.added'
  | 'team.member.removed'
  | 'share.created'
  | 'share.revoked';

export interface SyncEvent {
  type: SyncEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface UseSyncEventsOptions {
  enabled?: boolean;
  onEvent?: (event: SyncEvent) => void;
  onVaultChange?: (vaultId: string) => void;
  onTeamChange?: (teamId: string) => void;
  onError?: (error: Error) => void;
}

export function useSyncEvents({
  enabled = true,
  onEvent,
  onVaultChange,
  onTeamChange,
  onError,
}: UseSyncEventsOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    const token = localStorage.getItem('sv.jwt');
    if (!token) {
      console.warn('No JWT token, skipping SSE connection');
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new EventSource with auth header via URL param (standard SSE limitation)
    const url = new URL(`${BASE}/sync/events`, window.location.origin);
    url.searchParams.set('token', token);
    
    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection established');
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SyncEvent;
        console.log('SSE event received:', data);
        
        onEvent?.(data);

        // Route to specific handlers
        if (data.type.startsWith('vault.') && data.payload.vault_id) {
          onVaultChange?.(data.payload.vault_id as string);
        }
        if (data.type.startsWith('team.') && data.payload.team_id) {
          onTeamChange?.(data.payload.team_id as string);
        }
        if (data.type.startsWith('blob.') && data.payload.vault_id) {
          onVaultChange?.(data.payload.vault_id as string);
        }
        if (data.type.startsWith('share.') && data.payload.vault_id) {
          onVaultChange?.(data.payload.vault_id as string);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`SSE reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      } else {
        console.error('SSE max reconnect attempts reached');
        onError?.(new Error('SSE connection failed after max attempts'));
      }
    };
  }, [onEvent, onVaultChange, onTeamChange, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnect: connect,
    disconnect,
  };
}
