// ----------------------------------------
// @file   Utils/webrtcPeerManager.ts
// @desc   Mesh WebRTC connection management for a single active call — one
//         RTCPeerConnection per remote participant, all connected directly
//         browser-to-browser. Socket.io only relays the SDP/ICE envelopes
//         this class produces; it never sees media.
//
//         Deliberately a plain class, not a hook: RTCPeerConnection
//         callbacks (onicecandidate/ontrack/onconnectionstatechange) are
//         long-lived and closure-stale-state bugs are the most common
//         WebRTC-in-React failure mode, so this is held in a useRef and
//         driven imperatively from CallContext instead.
//
//         Offerer/answerer roles are deterministic to avoid signaling
//         glare: existing participants always offer to a newcomer (
//         addPeerAsOfferer), a newcomer only ever answers (addPeerAsAnswerer
//         + handleOffer).
// ----------------------------------------

import { ICE_SERVERS } from "../config/iceServers";

export interface CallPeerManagerCallbacks {
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onPeerClosed: (userId: string) => void;
  onIceCandidate: (userId: string, candidate: RTCIceCandidateInit) => void;
  onOffer: (userId: string, sdp: RTCSessionDescriptionInit) => void;
  onAnswer: (userId: string, sdp: RTCSessionDescriptionInit) => void;
  onConnectionStateChange?: (userId: string, state: RTCPeerConnectionState) => void;
}

export class CallPeerManager {
  private readonly localStream: MediaStream;
  private readonly callbacks: CallPeerManagerCallbacks;
  private readonly peers = new Map<string, RTCPeerConnection>();
  // ICE candidates can arrive before the remote description is set
  // (especially the answerer side, since offer/answer round-trips over the
  // network); queue them per-peer and flush once setRemoteDescription lands.
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

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(userId, event.candidate.toJSON());
      }
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.callbacks.onRemoteStream(userId, remoteStream);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange?.(userId, peerConnection.connectionState);
      if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "closed") {
        this.removePeer(userId);
        this.callbacks.onPeerClosed(userId);
      }
    };

    this.peers.set(userId, peerConnection);
    return peerConnection;
  }

  async addPeerAsOfferer(userId: string): Promise<void> {
    const peerConnection = this.peers.get(userId) || this.createPeerConnection(userId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.callbacks.onOffer(userId, offer);
  }

  addPeerAsAnswerer(userId: string): void {
    if (!this.peers.has(userId)) {
      this.createPeerConnection(userId);
    }
  }

  async handleOffer(userId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peers.get(userId) || this.createPeerConnection(userId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushPendingCandidates(userId, peerConnection);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.callbacks.onAnswer(userId, answer);
  }

  async handleAnswer(userId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peers.get(userId);
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
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

  // Local track.enabled toggle only — no renegotiation, so the remote side
  // keeps receiving frames (silence/black) rather than the connection
  // hiccuping, and call:media-state carries the flag for UI indicators.
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
