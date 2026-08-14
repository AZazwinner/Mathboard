import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness.js";
import * as syncProtocol from "y-protocols/sync.js";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const MIN_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 30000;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * A minimal Yjs WebSocket provider pointed at Mathboard's own FastAPI
 * `/ws/docs/{doc_id}` endpoint, speaking the standard y-protocols sync +
 * awareness wire format (see src/db/modules/liveshare/ydoc_room.py).
 *
 * Deliberately not y-websocket's own provider: we relay through the
 * existing FastAPI route rather than standing up a separate Node server.
 */
export class YjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;

  private url: string;
  private ws: WebSocket | null = null;
  private shouldReconnect = true;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  constructor(url: string, doc: Y.Doc) {
    this.url = url;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);

    this.doc.on("update", this.handleLocalUpdate);
    this.awareness.on("update", this.handleLocalAwarenessUpdate);

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.handleUnload);
    }

    this.connect();
  }

  onStatus(fn: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(status: ConnectionStatus) {
    this.statusListeners.forEach((fn) => fn(status));
  }

  private connect() {
    this.setStatus("connecting");

    const ws = new WebSocket(this.url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus("connected");

      // client-initiated half of the sync handshake - the server sends its
      // own SYNC_STEP1 immediately on accept, so this covers both directions
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      ws.send(encoding.toUint8Array(encoder));

      const localState = this.awareness.getLocalState();
      if (localState !== null) {
        this.sendAwarenessUpdate([this.doc.clientID]);
      }
    };

    ws.onmessage = (event) => {
      this.handleMessage(new Uint8Array(event.data as ArrayBuffer));
    };

    ws.onclose = () => {
      this.ws = null;
      this.setStatus("disconnected");
      // mark remote peers as offline locally until we resync - avoids stale
      // cursors lingering after a drop with no signal (the old client had no
      // onclose handling at all, so this never happened before)
      const remoteIds = Array.from(this.awareness.getStates().keys()).filter(
        (id) => id !== this.doc.clientID
      );
      if (remoteIds.length > 0) {
        awarenessProtocol.removeAwarenessStates(this.awareness, remoteIds, "connection-close");
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    const backoff = Math.min(
      MAX_RECONNECT_DELAY_MS,
      MIN_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt
    );
    const jitter = Math.random() * 0.3 * backoff;
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), backoff + jitter);
  }

  private handleMessage(message: Uint8Array) {
    const decoder = decoding.createDecoder(message);
    const encoder = encoding.createEncoder();
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC: {
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
        // readSyncMessage only wrote a reply if there's actually something to
        // send back (e.g. a SYNC_STEP1 needs a STEP2 reply; an UPDATE doesn't)
        if (encoding.length(encoder) > 1) {
          this.ws?.send(encoding.toUint8Array(encoder));
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          this
        );
        break;
      }
    }
  }

  private handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
    // updates applied by handleMessage (origin === this) came from the server -
    // don't echo them straight back, or reconnect/re-sync would loop forever
    if (origin === this) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  };

  private handleLocalAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    // same rule as handleLocalUpdate: changes applied by handleMessage
    // (origin === this) came from the server, so echoing them back would
    // have every peer re-broadcast every other peer's awareness update
    if (origin === this) return;
    this.sendAwarenessUpdate(added.concat(updated, removed));
  };

  private sendAwarenessUpdate(clientIds: number[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (clientIds.length === 0) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds)
    );
    this.ws.send(encoding.toUint8Array(encoder));
  }

  private handleUnload = () => {
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "window-unload");
  };

  destroy() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.handleUnload);
    }

    this.doc.off("update", this.handleLocalUpdate);
    this.awareness.off("update", this.handleLocalAwarenessUpdate);
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "destroy");

    this.ws?.close();
    this.ws = null;
  }
}
