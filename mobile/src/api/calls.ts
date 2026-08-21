import { apiFetch } from "./client";
import type { CallType } from "../types";

export interface ActiveCallSnapshot {
  callType: CallType;
  participantCount: number;
  participantUserIds: string[];
}

export const getActiveCall = async (conversationId: string): Promise<ActiveCallSnapshot | null> => {
  const response = await apiFetch<{
    status: string;
    data?: { active: boolean; call?: ActiveCallSnapshot };
  }>(`/conversations/${conversationId}/call`);

  return response.data?.active ? response.data.call || null : null;
};
