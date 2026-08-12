// ----------------------------------------
// @file   config/iceServers.ts
// @desc   WebRTC ICE server list — public STUN only for v1 (no TURN). Calls
//         behind symmetric NAT / strict firewalls may fail to connect
//         peer-to-peer; accepted as a documented v1 limitation. This is the
//         single place to add a TURN entry later without touching call logic.
// ----------------------------------------

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
