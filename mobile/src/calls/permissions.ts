import { PermissionsAndroid, Platform } from "react-native";
import type { CallType } from "../types";

// iOS surfaces its own prompts through getUserMedia; only Android needs an
// explicit runtime request beforehand.
export const requestCallPermissions = async (callType: CallType): Promise<boolean> => {
  if (Platform.OS !== "android") return true;

  const required = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (callType === "video") {
    required.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

  const results = await PermissionsAndroid.requestMultiple(required);
  return required.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
};
