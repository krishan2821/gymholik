import { apiClient } from './axiosConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

export interface TrainerType {
  id: string;
  name: string;
  active: boolean;
}

export interface Trainer {
  id: string;
  gymId: string;
  name: string;
  phone: string;
  role: string;
  active: boolean;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'REJECTED';
  trainerTypes: TrainerType[];
  activeAssignmentsCount: number;
  createdAt?: string;
}

export interface TrainerAssignment {
  id: string;
  gymId: string;
  trainerId: string;
  trainerName?: string;
  memberId: string;
  memberName?: string;
  memberCode?: string;
  memberPhone?: string;
  status: 'ACTIVE' | 'ENDED';
  startDate?: string;
  endDate?: string;
  assignedBy?: string;
  endedBy?: string;
  ptFeePaise?: number;
  sessionsTotal?: number;
  notes?: string;
  createdAt?: string;
}

export interface PagedAssignments {
  content: TrainerAssignment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ─── Trainer Queries ──────────────────────────────────────────────────────────

export const useTrainers = (status?: string) => {
  return useQuery<Trainer[]>({
    queryKey: ['trainers', status],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/trainers', {
        params: status ? { status } : undefined,
      });
      return data.data;
    },
  });
};

export const useTrainer = (id: string) => {
  return useQuery<Trainer>({
    queryKey: ['trainers', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/trainers/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
};

// ─── Trainer Mutations ────────────────────────────────────────────────────────

export const useApproveTrainer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, trainerTypeIds }: { id: string; trainerTypeIds: string[] }) => {
      const { data } = await apiClient.post(`/api/trainers/${id}/approve`, { trainerTypeIds });
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Trainer approved successfully' });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Approval failed',
        text2: e.response?.data?.message || 'Could not approve trainer',
      });
    },
  });
};

export const useRejectTrainer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/api/trainers/${id}/reject`);
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Trainer request rejected' });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Action failed',
        text2: e.response?.data?.message || 'Could not reject trainer',
      });
    },
  });
};

export const useUpdateTrainerTypes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, trainerTypeIds }: { id: string; trainerTypeIds: string[] }) => {
      const { data } = await apiClient.put(`/api/trainers/${id}/types`, { trainerTypeIds });
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Specialties updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: e.response?.data?.message || 'Could not update trainer specialties',
      });
    },
  });
};

export const useDeactivateTrainer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put(`/api/trainers/${id}/deactivate`);
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Trainer deactivated' });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
      queryClient.invalidateQueries({ queryKey: ['trainer-assignments'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Deactivation failed',
        text2: e.response?.data?.message || 'Could not deactivate trainer',
      });
    },
  });
};

// ─── Trainer Types ────────────────────────────────────────────────────────────

export const useTrainerTypes = (activeOnly?: boolean) => {
  return useQuery<TrainerType[]>({
    queryKey: ['trainer-types', activeOnly],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/trainer-types', {
        params: activeOnly !== undefined ? { activeOnly } : undefined,
      });
      return data.data;
    },
  });
};

export const useCreateTrainerType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.post('/api/trainer-types', { name });
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Trainer type created' });
      queryClient.invalidateQueries({ queryKey: ['trainer-types'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Failed to create type',
        text2: e.response?.data?.message || 'Error creating trainer type',
      });
    },
  });
};

export const useUpdateTrainerType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await apiClient.put(`/api/trainer-types/${id}`, { name });
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Trainer type updated' });
      queryClient.invalidateQueries({ queryKey: ['trainer-types'] });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: e.response?.data?.message || 'Could not update trainer type',
      });
    },
  });
};

export const useDeactivateTrainerType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/api/trainer-types/${id}`);
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Trainer type deactivated' });
      queryClient.invalidateQueries({ queryKey: ['trainer-types'] });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Deactivation failed',
        text2: e.response?.data?.message || 'Could not deactivate trainer type',
      });
    },
  });
};

// ─── Assignments ──────────────────────────────────────────────────────────────

export const useTrainerAssignments = (params: {
  trainerId?: string;
  memberId?: string;
  status?: string;
  page?: number;
  size?: number;
}) => {
  return useQuery<PagedAssignments>({
    queryKey: ['trainer-assignments', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/trainer-assignments', {
        params: {
          ...params,
          size: params.size ?? 50,
        },
      });
      return data.data;
    },
  });
};

export const useAssignMembers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      trainerId: string;
      memberIds: string[];
      startDate?: string;
      ptFeePaise?: number;
      sessionsTotal?: number;
      notes?: string;
    }) => {
      const { data } = await apiClient.post('/api/trainer-assignments', payload);
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Members assigned successfully' });
      queryClient.invalidateQueries({ queryKey: ['trainer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Assignment failed',
        text2: e.response?.data?.message || 'Could not assign members',
      });
    },
  });
};

export const useEndAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data } = await apiClient.post(`/api/trainer-assignments/${assignmentId}/end`);
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Assignment ended' });
      queryClient.invalidateQueries({ queryKey: ['trainer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Action failed',
        text2: e.response?.data?.message || 'Could not end assignment',
      });
    },
  });
};

export const useReassignTrainer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      fromTrainerId: string;
      toTrainerId: string;
      notes?: string;
    }) => {
      const { data } = await apiClient.post('/api/trainer-assignments/reassign', payload);
      return data.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Members reassigned successfully' });
      queryClient.invalidateQueries({ queryKey: ['trainer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Reassignment failed',
        text2: e.response?.data?.message || 'Could not reassign members',
      });
    },
  });
};
