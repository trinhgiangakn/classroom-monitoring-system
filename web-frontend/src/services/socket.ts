import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../lib/api'

export type RealtimeConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface RealtimeEnvelope<T = unknown> {
  room_id?: string
  occurred_at?: string
  data: T
}

export const ALERT_REALTIME_EVENTS = [
  'alert:new',
  'new_alert',
  'alert:updated',
  'alert:dismissed',
  'alert:restored',
  'alert:deleted',
] as const
export const SYSTEM_REALTIME_EVENTS = [
  'sensor:update',
  'telemetry_update',
  'node:status',
  'gateway:status',
  'system:resource-update',
  'device:state-changed',
  'device_state_changed',
] as const

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api$/, '')).replace(/\/$/, '')
const connectionListeners = new Set<(state: RealtimeConnectionState) => void>()
let connectionState: RealtimeConnectionState = 'disconnected'
let socket: Socket | null = null
let subscriberCount = 0

function setConnectionState(nextState: RealtimeConnectionState) {
  connectionState = nextState
  connectionListeners.forEach(listener => listener(nextState))
}

function ensureSocket() {
  if (socket) return socket
  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token: localStorage.getItem('accessToken') || undefined },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    transports: ['websocket', 'polling'],
  })
  socket.on('connect', () => setConnectionState('connected'))
  socket.on('disconnect', () => setConnectionState('disconnected'))
  socket.on('connect_error', () => setConnectionState('error'))
  socket.io.on('reconnect_attempt', () => setConnectionState('connecting'))
  return socket
}

export function connectRealtime() {
  const client = ensureSocket()
  client.auth = { token: localStorage.getItem('accessToken') || undefined }
  if (!client.connected) {
    setConnectionState('connecting')
    client.connect()
  }
  return client
}

export function subscribeToConnection(listener: (state: RealtimeConnectionState) => void) {
  subscriberCount += 1
  connectionListeners.add(listener)
  listener(connectionState)
  connectRealtime()
  return () => {
    connectionListeners.delete(listener)
    releaseSubscription()
  }
}

export function subscribeToRealtime(
  events: readonly string[],
  listener: (payload: RealtimeEnvelope) => void,
) {
  subscriberCount += 1
  const client = connectRealtime()
  events.forEach(event => client.on(event, listener))
  return () => {
    events.forEach(event => client.off(event, listener))
    releaseSubscription()
  }
}

function releaseSubscription() {
  subscriberCount = Math.max(0, subscriberCount - 1)
  if (subscriberCount === 0 && socket) {
    socket.disconnect()
    setConnectionState('disconnected')
  }
}
