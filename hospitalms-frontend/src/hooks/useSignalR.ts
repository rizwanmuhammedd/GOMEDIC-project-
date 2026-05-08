// import { useEffect, useRef, useCallback } from 'react';
// import * as signalR from '@microsoft/signalr';

// const HUB_URL = 'http://localhost:5004/hubs/hospital';

// export interface SignalREvent {
//   event: string;
//   handler: (...args: unknown[]) => void;
// }

// export const useSignalR = (events: SignalREvent[], enabled = true) => {
//   const connectionRef = useRef<signalR.HubConnection | null>(null);

//   const connect = useCallback(async () => {
//     const token = localStorage.getItem('hms_token');
//     if (!token || !enabled) return;

//     const connection = new signalR.HubConnectionBuilder()
//       .withUrl(`${HUB_URL}?access_token=${token}`, {
//         transport: signalR.HttpTransportType.WebSockets,
//         skipNegotiation: true,
//       })
//       .withAutomaticReconnect([0, 2000, 5000, 10000])
//       .configureLogging(signalR.LogLevel.Warning)
//       .build();

//     events.forEach(({ event, handler }) => {
//       connection.on(event, handler);
//     });

//     try {
//       await connection.start();
//       connectionRef.current = connection;
//     } catch (err) {
//       console.warn('SignalR connection failed:', err);
//     }
//   }, [enabled]);

//   useEffect(() => {
//     connect();
//     return () => {
//       if (connectionRef.current) connectionRef.current.stop();
//     };
//   }, [connect]);

//   return connectionRef;
// };





// src/hooks/useSignalR.ts
import { useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

// Direct link to Notification Service to avoid Ocelot WebSocket issues
const HUB_URL = 'http://localhost:5004/hubs/hospital';

export interface SignalREvent {
  event: string;
  handler: (...args: unknown[]) => void;
}

export const useSignalR = (events: SignalREvent[], enabled = true) => {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const eventsRef = useRef(events);
  const isConnectingRef = useRef(false);

  // Update eventsRef when events change
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const connect = useCallback(async () => {
    const token = localStorage.getItem('hms_token');
    if (!token || !enabled || connectionRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Bind events using a proxy handler that always uses the latest eventsRef
    eventsRef.current.forEach(({ event }) => {
      // Clear any existing listeners for this event to prevent duplicates
      connection.off(event);
      connection.on(event, (...args: any[]) => {
        const currentEvent = eventsRef.current.find(e => e.event === event);
        if (currentEvent) currentEvent.handler(...args);
      });
    });

    try {
      await connection.start();
      console.log('SignalR connected successfully');
      connectionRef.current = connection;
    } catch (err) {
      console.warn('SignalR connection failed:', err);
      setTimeout(() => {
        isConnectingRef.current = false;
        connect();
      }, 5000);
    } finally {
      isConnectingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
    };
  }, [connect, enabled]);

  return connectionRef;
};