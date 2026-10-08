import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { apiClient, classifyError } from './axiosConfig';

export type NoteType = 'WORKOUT' | 'DIET' | 'PROGRESS' | 'GENERAL';

export interface MemberNote {
  id: string;
  memberId: string;
  trainerId: string;
  trainerName?: string;
  type: NoteType;
  text: string;
  weightKg?: number | null;
  bodyMeasurements?: Record<string, any> | null;
  createdAt: string;
}

export interface CreateNotePayload {
  type: NoteType;
  text: string;
  weightKg?: number | null;
  bodyMeasurements?: Record<string, any> | null;
}

export interface UpdateNotePayload {
  type: NoteType;
  text: string;
  weightKg?: number | null;
  bodyMeasurements?: Record<string, any> | null;
}

export const getMemberNotes = async (memberId: string): Promise<MemberNote[]> => {
  const { data } = await apiClient.get(`/api/members/${memberId}/notes`);
  return data.data || [];
};

export const createMemberNote = async (
  memberId: string,
  payload: CreateNotePayload
): Promise<MemberNote> => {
  const { data } = await apiClient.post(`/api/members/${memberId}/notes`, payload);
  return data.data;
};

export const updateMemberNote = async (
  memberId: string,
  noteId: string,
  payload: UpdateNotePayload
): Promise<MemberNote> => {
  const { data } = await apiClient.put(`/api/members/${memberId}/notes/${noteId}`, payload);
  return data.data;
};

export const useMemberNotes = (memberId?: string) => {
  return useQuery({
    queryKey: ['member-notes', memberId],
    queryFn: () => getMemberNotes(memberId!),
    enabled: Boolean(memberId),
  });
};

export const useCreateMemberNote = (memberId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNotePayload) => createMemberNote(memberId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-notes', memberId] });
      Toast.show({
        type: 'success',
        text1: 'Note added',
        text2: 'Note has been saved successfully.',
      });
    },
    onError: (error) => {
      const classified = classifyError(error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: classified.message,
      });
    },
  });
};

export const useUpdateMemberNote = (memberId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, payload }: { noteId: string; payload: UpdateNotePayload }) =>
      updateMemberNote(memberId, noteId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-notes', memberId] });
      Toast.show({
        type: 'success',
        text1: 'Note updated',
        text2: 'Note has been updated successfully.',
      });
    },
    onError: (error) => {
      const classified = classifyError(error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: classified.message,
      });
    },
  });
};
