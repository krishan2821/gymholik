import { apiClient } from './axiosConfig';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { invalidatePaymentQueries } from './payments';

import { components } from './types';


export type Membership = Required<components['schemas']['MembershipResponse']> & {
  discountPaise?: number;
  discountReason?: string;
  promisedDate?: string;
};
export type Member = Omit<Required<components['schemas']['MemberResponse']>, 'currentMembership'> & {
  currentMembership?: Membership;
};

export type MembersResponse = Omit<
  Required<components['schemas']['PagedResponseMemberResponse']>,
  'content'
> & {
  content: Member[];
};

export const fetchMembers = async ({ pageParam = 0, queryKey }: any): Promise<MembersResponse> => {
  const [_key, filters] = queryKey;
  const { data } = await apiClient.get('/api/members', {
    params: {
      page: pageParam,
      size: 20,
      term: filters?.term || undefined,
      status: filters?.status || undefined, // ALL, ACTIVE, EXPIRED, DUE
    },
  });
  return data.data;
};

export const useMembers = (filters: { term?: string; status?: string } = {}) => {
  return useInfiniteQuery({
    queryKey: ['members', filters],
    queryFn: fetchMembers,
    getNextPageParam: (lastPage) => {
      if (lastPage.last) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 0,
  });
};

export const fetchMemberById = async (id: string): Promise<Member> => {
  const { data } = await apiClient.get(`/api/members/${id}`);
  return data.data;
};

export const useMember = (id: string) => {
  return useQuery({
    queryKey: ['members', id],
    queryFn: () => fetchMemberById(id),
    enabled: !!id,
  });
};

export const useAddMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/api/members', payload);
      return data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Member added successfully!' });
      invalidatePaymentQueries(queryClient);
    },
    onError: (error: any) => {
      Toast.show({ 
        type: 'error', 
        text1: 'Failed to add member', 
        text2: error.response?.data?.message || error.message 
      });
    },
  });
};

export const useRenewMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      const { data } = await apiClient.post(`/api/members/${id}/renew`, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      Toast.show({ type: 'success', text1: 'Membership renewed successfully!' });
      invalidatePaymentQueries(queryClient);
    }
  });
};

export const uploadMemberPhoto = async (id: string, imageUri: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as any);

  const { data } = await apiClient.post(`/api/members/${id}/photo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const useApplyDiscount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      membershipId,
      discountPaise,
      reason,
    }: {
      membershipId: string;
      discountPaise: number;
      reason: string;
    }) => {
      const { data } = await apiClient.post(`/api/memberships/${membershipId}/discount`, {
        discountPaise,
        reason,
      });
      return data?.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Discount applied successfully' });
      invalidatePaymentQueries(queryClient);
    },

    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: 'Failed to apply discount',
        text2: error.response?.data?.message || error.message,
      });
    },
  });
};

export const useUpdatePromisedDate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      membershipId,
      promisedDate,
    }: {
      membershipId: string;
      promisedDate: string;
    }) => {
      const { data } = await apiClient.patch(`/api/memberships/${membershipId}/promised-date`, {
        promisedDate,
      });
      return data?.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Promised date updated' });
      invalidatePaymentQueries(queryClient);
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: 'Failed to update promised date',
        text2: error.response?.data?.message || error.message,
      });
    },
  });
};
