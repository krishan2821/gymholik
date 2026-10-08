import { apiClient } from './axiosConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { components } from './types';

export type Plan = Required<components['schemas']['PlanResponse']>;
export type PlanRequest = Required<components['schemas']['PlanRequest']>;

export const fetchActivePlans = async (): Promise<Plan[]> => {
  const { data } = await apiClient.get('/api/plans', { params: { activeOnly: true } });
  return data.data; // assuming API returns ApiResponse with data field
};

export const fetchAllPlans = async (): Promise<Plan[]> => {
  const { data } = await apiClient.get('/api/plans'); // all plans
  return data.data;
};

export const usePlans = (activeOnly: boolean = true) => {
  return useQuery({
    queryKey: ['plans', activeOnly],
    queryFn: activeOnly ? fetchActivePlans : fetchAllPlans,
  });
};

export const useAddPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PlanRequest) => {
      const { data } = await apiClient.post('/api/plans', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    }
  });
};

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      const { data } = await apiClient.put(`/api/plans/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    }
  });
};
