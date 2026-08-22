// Public STUN only, matching the web client. Calls behind symmetric NAT may
// fail to connect peer-to-peer until a TURN entry is added here.
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
