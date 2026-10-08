import { apiClient, BASE_URL } from './axiosConfig';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAccessToken } from '../utils/tokenUtils';

import { components } from './types';

export type Payment = Required<components['schemas']['PaymentResponse']>;
export type DueRecord = Required<components['schemas']['MemberDueResponse']>;

export const fetchPayments = async ({ pageParam = 0, queryKey }: any) => {
  const [_key, filters] = queryKey;
  const { data } = await apiClient.get('/api/payments', {
    params: {
      page: pageParam,
      size: 20,
      startDate: filters?.fromDate || undefined,
      endDate: filters?.toDate || undefined,
      mode: filters?.mode || undefined,
    },
  });
  // Backend returns ApiResponse<PaymentListResponse> where data.data.payments has the PagedResponse
  if (data?.data?.payments) {
    return data.data.payments;
  }
  return data?.data;
};

export const usePayments = (filters: { fromDate?: string; toDate?: string; mode?: string }) => {
  return useInfiniteQuery({
    queryKey: ['payments', filters],
    queryFn: fetchPayments,
    getNextPageParam: (lastPage: any) => {
      const paged = lastPage?.payments || lastPage;
      if (!paged || paged.last) return undefined;
      return (paged.page ?? 0) + 1;
    },
    initialPageParam: 0,
  });
};

export const useCollectPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { memberId: string; amount: number; mode: string; notes?: string }) => {
      const { data } = await apiClient.post('/api/payments', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const fetchDues = async (): Promise<DueRecord[]> => {
  const { data } = await apiClient.get('/api/dues');
  if (data?.data?.content && Array.isArray(data.data.content)) {
    return data.data.content;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return [];
};

export const useDues = () => {
  return useQuery({
    queryKey: ['dues'],
    queryFn: fetchDues,
  });
};

export const useReversePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data } = await apiClient.post(`/api/payments/${id}/reverse`, { notes });
      return data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Payment reversed successfully' });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      Toast.show({ type: 'error', text1: 'Reversal failed', text2: error.response?.data?.message || 'Error reversing payment' });
    }
  });
};

export const downloadAndShareReceipt = async (paymentId: string, receiptNumber: string) => {
  try {
    const token = await getAccessToken();
    const url = `${BASE_URL}/api/payments/${paymentId}/receipt`;
    const fileUri = `${(FileSystem as any).documentDirectory || ''}Receipt_${receiptNumber}.pdf`;

    const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (downloadResult.status !== 200) {
      throw new Error('Failed to download PDF');
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Receipt',
      });
    } else {
      Toast.show({ type: 'info', text1: 'Sharing not available on this device' });
    }
  } catch (error) {
    console.error(error);
    Toast.show({ type: 'error', text1: 'Failed to download receipt' });
  }
};
