import InCallManager from "react-native-incall-manager";
import type { CallType } from "../types";

/**
 * react-native-webrtc does no Android audio-mode management of its own, so
 * without this the OS never switches into communication mode and remote audio
 * is routed to the wrong output (or dropped entirely) while the local mic
 * still captures fine — one-way audio.
 *
 * Video calls default to speakerphone; voice calls start on the earpiece,
 * matching how the mainstream messaging apps behave.
 */
export const startAudioSession = (callType: CallType): void => {
  try {
    InCallManager.start({ media: callType === "video" ? "video" : "audio", auto: true });
    InCallManager.setForceSpeakerphoneOn(callType === "video");
  } catch {
    // Audio routing is best-effort; the call still proceeds without it.
  }
};

export const stopAudioSession = (): void => {
  try {
    InCallManager.setForceSpeakerphoneOn(false);
    InCallManager.stop();
  } catch {
    // Ignore — nothing to tear down if it never started.
  }
};

export const setSpeakerphone = (enabled: boolean): void => {
  try {
    InCallManager.setForceSpeakerphoneOn(enabled);
  } catch {
    // Ignore.
  }
};
