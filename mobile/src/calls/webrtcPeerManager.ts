import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";
import { ICE_SERVERS } from "./iceServers";

export interface CallPeerManagerCallbacks {
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onPeerClosed: (userId: string) => void;
  onIceCandidate: (userId: string, candidate: RTCIceCandidateInit) => void;
  onOffer: (userId: string, sdp: RTCSessionDescriptionInit) => void;
  onAnswer: (userId: string, sdp: RTCSessionDescriptionInit) => void;
}

// react-native-webrtc ships its own EventTarget typing, so handlers are
// attached through the on* setters with a cast rather than addEventListener.
type PeerEventHandler = NonNullable<RTCPeerConnection["onicecandidate"]>;

const asHandler = (handler: (event: never) => void): PeerEventHandler =>
  handler as unknown as PeerEventHandler;

// The library requires a concrete sdp string where the DOM type allows
// undefined; signaling payloads always carry one in practice.
const toSessionDescription = (sdp: RTCSessionDescriptionInit) =>
  new RTCSessionDescription({ type: sdp.type as "offer" | "answer", sdp: sdp.sdp ?? "" });

/**
 * Mesh WebRTC connection management for one active call — a peer connection
 * per remote participant. Ported from the web client's peer manager.
 *
 * Offerer/answerer roles stay deterministic to avoid signaling glare: existing
 * participants offer to a newcomer, a newcomer only ever answers.
 */
export class CallPeerManager {
  private readonly localStream: MediaStream;
  private readonly callbacks: CallPeerManagerCallbacks;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  constructor(localStream: MediaStream, callbacks: CallPeerManagerCallbacks) {
    this.localStream = localStream;
    this.callbacks = callbacks;
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, this.localStream);
    });

    peerConnection.onicecandidate = asHandler((event: { candidate: RTCIceCandidate | null }) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(userId, event.candidate.toJSON());
      }
    });

    peerConnection.ontrack = asHandler((event: { streams: MediaStream[] }) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.callbacks.onRemoteStream(userId, remoteStream);
      }
    });

    peerConnection.onconnectionstatechange = asHandler(() => {
      const state = peerConnection.connectionState;
      if (state === "failed" || state === "closed") {
        this.removePeer(userId);
        this.callbacks.onPeerClosed(userId);
      }
    });

    this.peers.set(userId, peerConnection);
    return peerConnection;
  }

  async addPeerAsOfferer(userId: string): Promise<void> {
    const peerConnection = this.peers.get(userId) || this.createPeerConnection(userId);
    const offer = await peerConnection.createOffer({});
    await peerConnection.setLocalDescription(offer);
    this.callbacks.onOffer(userId, offer as RTCSessionDescriptionInit);
  }

  addPeerAsAnswerer(userId: string): void {
    if (!this.peers.has(userId)) {
      this.createPeerConnection(userId);
    }
  }

  async handleOffer(userId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peers.get(userId) || this.createPeerConnection(userId);
    await peerConnection.setRemoteDescription(toSessionDescription(sdp));
    await this.flushPendingCandidates(userId, peerConnection);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.callbacks.onAnswer(userId, answer as RTCSessionDescriptionInit);
  }

  async handleAnswer(userId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peers.get(userId);
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(toSessionDescription(sdp));
    await this.flushPendingCandidates(userId, peerConnection);
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peers.get(userId);
    if (!peerConnection || !peerConnection.remoteDescription) {
      const queued = this.pendingCandidates.get(userId) || [];
      queued.push(candidate);
      this.pendingCandidates.set(userId, queued);
      return;
    }
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushPendingCandidates(userId: string, peerConnection: RTCPeerConnection): Promise<void> {
    const queued = this.pendingCandidates.get(userId);
    if (!queued || queued.length === 0) return;
    this.pendingCandidates.delete(userId);
    for (const candidate of queued) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  setMuted(muted: boolean): void {
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  setCameraOff(off: boolean): void {
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !off;
    });
  }

  switchCamera(): void {
    this.localStream.getVideoTracks().forEach((track) => {
      track._switchCamera();
    });
  }

  removePeer(userId: string): void {
    const peerConnection = this.peers.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peers.delete(userId);
    }
    this.pendingCandidates.delete(userId);
  }

  destroy(): void {
    this.peers.forEach((peerConnection) => peerConnection.close());
    this.peers.clear();
    this.pendingCandidates.clear();
    this.localStream.getTracks().forEach((track) => track.stop());
  }
}
