import { useEffect, useRef, useCallback } from 'react';
import { post } from '@/lib/api';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export type SyncEventKind =
  | 'vault_create'
  | 'blob_upload'
  | 'team_create'
  | 'team_invite'
  | 'team_invite_accept'
  | 'team_update'
  | 'team_delete'
  | 'team_role_update'
  | 'team_member_remove'
  | 'vault_share'
  | 'notification'
  | 'heartbeat';

export interface SyncEvent {
  t: number;
  type: SyncEventKind;
  vault_id?: string;
  team_id?: string;
  member_id?: string;
  actor_user_id?: string;
  target_user_id?: string;
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
  // Bumped on every connect/disconnect so a ticket request that resolves late is ignored.
  const generationRef = useRef(0);

  const connect = useCallback(async () => {
    const generation = ++generationRef.current;
    const token = localStorage.getItem('sv.jwt');
    if (!token) {
      console.warn('No JWT token, skipping SSE connection');
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // EventSource cannot send headers: exchange the JWT (sent as a header) for a
    // short-lived single-use ticket, so the JWT never appears in a URL or log.
    const ticketRes = await post<{ ticket?: string }>('/sync/ticket', {});
    const ticket = ticketRes.body?.ticket;
    if (generation !== generationRef.current) return; // disconnected or reconnected meanwhile
    if (!ticketRes.ok || !ticket) {
      console.warn('Could not obtain a sync ticket', ticketRes.status);
      return;
    }
    const url = new URL(`${BASE}/sync/events`, window.location.origin);
    url.searchParams.set('ticket', ticket);
    
    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection established');
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SyncEvent;
        onEvent?.(data);
        if (data.type === 'heartbeat') return;
        if (data.vault_id) onVaultChange?.(data.vault_id);
        if (data.team_id) onTeamChange?.(data.team_id);
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
          void connect();
        }, delay);
      } else {
        console.error('SSE max reconnect attempts reached');
        onError?.(new Error('SSE connection failed after max attempts'));
      }
    };
  }, [onEvent, onVaultChange, onTeamChange, onError]);

  const disconnect = useCallback(() => {
    generationRef.current++;
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
      void connect();
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
