import { apiClient, BASE_URL } from './axiosConfig';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { safeShareAsync, safeIsAvailableAsync } from '../utils/safeSharing';
import { getAccessToken } from '../utils/tokenUtils';

export interface PaymentItem {
  id: string;
  gymId?: string;
  memberId: string;
  memberName?: string;
  memberCode?: string;
  membershipId?: string;
  planName?: string;
  amountPaise: number;
  mode: string;
  paidAt?: string;
  receiptNo: string;
  type: string;
  reversalOfId?: string;
  reason?: string;
  collectedByName?: string;
  referenceNo?: string;
  createdAt?: string;
}

export interface DayTotal {
  date: string;
  totalPaise: number;
}

export interface PaymentListResponse {
  payments: {
    content: PaymentItem[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
  };
  totalsByMode?: Record<string, number>;
  dayTotals?: DayTotal[];
}

export interface ModeSummary {
  paise: number;
  percent: number;
}

export interface PaymentSummaryResponse {
  collectedPaise: number;
  count: number;
  byMode: {
    CASH?: ModeSummary;
    UPI?: ModeSummary;
    CARD?: ModeSummary;
    [key: string]: ModeSummary | undefined;
  };
  previousPeriodPaise?: number | null;
  percentChange?: number | null;
  pendingDuePaise: number;
  pendingMembersCount: number;
}

export interface MembershipSummary {
  id: string;
  planName?: string;
  totalPaise: number;
  discountPaise: number;
  paidPaise: number;
  duePaise: number;
  startDate?: string;
  expiryDate?: string;
  status?: string;
}

export interface PaymentDetailResponse {
  id: string;
  receiptNo: string;
  gymId: string;
  memberId: string;
  memberName: string;
  memberCode?: string;
  membershipId?: string;
  planName?: string;
  amountPaise: number;
  mode: string;
  type: string;
  paidAt?: string;
  createdAt?: string;
  collectedByName?: string;
  collectedByUserId?: string;
  referenceNo?: string;
  reason?: string;
  note?: string;
  membershipSummary?: MembershipSummary;
  reversalOfId?: string;
  reversalOfReceiptNo?: string;
  reversedByPaymentId?: string;
  reversalReceiptNo?: string;
  reversedAt?: string;
}

export interface MembershipDueItem {
  membershipId: string;
  planName: string;
  totalPaise: number;
  discountPaise?: number;
  paidPaise: number;
  duePaise: number;
  startDate?: string;
  expiryDate?: string;
  status?: string;
}

export interface DueItem {
  memberId: string;
  name?: string;
  memberName?: string;
  memberCode?: string;
  phone?: string;
  membershipId?: string;
  planName?: string;
  duePaise: number;
  totalDuePaise?: number;
  totalPaise: number;
  paidPaise: number;
  startDate?: string;
  expiryDate?: string;
  daysOverdue?: number;
  daysToExpiry?: number;
  lastPaymentAt?: string;
  promisedDate?: string;
  promiseBroken?: boolean;
  memberships?: MembershipDueItem[];
}

export interface DuesListResponse {
  items: DueItem[];
  content?: DueItem[];
  totalDuePaise: number;
  count: number;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// Backward compat
export type Payment = PaymentItem;
export type DueRecord = DueItem;

/**
 * Universal invalidate helper for payments, summary, dues, dashboard and member queries.
 */
export const invalidatePaymentQueries = (queryClient: any) => {
  queryClient.invalidateQueries({ queryKey: ['payments'] });
  queryClient.invalidateQueries({ queryKey: ['payments-summary'] });
  queryClient.invalidateQueries({ queryKey: ['dues'] });
  queryClient.invalidateQueries({ queryKey: ['members'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export const fetchPaymentSummary = async (
  period: string = 'MONTH',
  from?: string,
  to?: string
): Promise<PaymentSummaryResponse> => {
  const { data } = await apiClient.get('/api/payments/summary', {
    params: {
      period,
      from: from || undefined,
      to: to || undefined,
    },
  });
  return data?.data;
};

export const usePaymentSummary = (
  period: string = 'MONTH',
  from?: string,
  to?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['payments-summary', period, from, to],
    queryFn: () => fetchPaymentSummary(period, from, to),
    enabled,
    staleTime: 1000 * 30, // 30s cache
  });
};

export const fetchPayments = async ({ pageParam = 0, queryKey }: any): Promise<PaymentListResponse> => {
  const [_key, filters] = queryKey;
  const { data } = await apiClient.get('/api/payments', {
    params: {
      page: pageParam,
      size: 20,
      period: filters?.period || undefined,
      startDate: filters?.startDate || undefined,
      endDate: filters?.endDate || undefined,
      mode: filters?.mode && filters.mode !== 'ALL' ? filters.mode : undefined,
      search: filters?.search?.trim() ? filters.search.trim() : undefined,
      memberId: filters?.memberId || undefined,
    },
  });
  return data?.data;
};

export const usePayments = (filters: {
  period?: string;
  startDate?: string;
  endDate?: string;
  mode?: string;
  search?: string;
  memberId?: string;
}) => {

  return useInfiniteQuery({
    queryKey: ['payments', filters],
    queryFn: fetchPayments,
    getNextPageParam: (lastPage: PaymentListResponse) => {
      const paged = lastPage?.payments;
      if (!paged || paged.last) return undefined;
      return (paged.page ?? 0) + 1;
    },
    initialPageParam: 0,
  });
};

export const fetchPaymentDetail = async (id: string): Promise<PaymentDetailResponse> => {
  const { data } = await apiClient.get(`/api/payments/${id}`);
  return data?.data;
};

export const usePaymentDetail = (id: string | null) => {
  return useQuery({
    queryKey: ['payments', 'detail', id],
    queryFn: () => fetchPaymentDetail(id!),
    enabled: !!id,
  });
};

export const fetchDues = async (
  filter: string = 'ALL',
  search?: string,
  page: number = 0,
  size: number = 50
): Promise<DuesListResponse> => {
  const { data } = await apiClient.get('/api/dues', {
    params: {
      filter,
      search: search?.trim() ? search.trim() : undefined,
      page,
      size,
    },
  });
  return data?.data;
};

export const useDues = (filter: string = 'ALL', search?: string) => {
  return useQuery({
    queryKey: ['dues', filter, search],
    queryFn: () => fetchDues(filter, search),
  });
};

export const useCollectPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      memberId: string;
      membershipId?: string;
      amount?: number;
      amountPaise?: number;
      mode: string;
      notes?: string;
      reason?: string;
      referenceNo?: string;
      receivedAt?: string;
      idempotencyKey?: string;
    }) => {
      const body = {
        memberId: payload.memberId,
        membershipId: payload.membershipId,
        amountPaise: payload.amountPaise ?? payload.amount ?? 0,
        mode: payload.mode,
        reason: payload.reason ?? payload.notes,
        referenceNo: payload.referenceNo,
        receivedAt: payload.receivedAt,
        idempotencyKey: payload.idempotencyKey,
      };
      const headers = payload.idempotencyKey
        ? { 'Idempotency-Key': payload.idempotencyKey }
        : undefined;
      const { data } = await apiClient.post('/api/payments', body, { headers });
      return data?.data;
    },
    onSuccess: () => {
      invalidatePaymentQueries(queryClient);
    },
  });
};


export type ReversalReasonCode = 'WRONG_ENTRY' | 'DUPLICATE' | 'REFUND' | 'OTHER';

export const useReversePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      reasonCode,
      note,
      notes,
    }: {
      id: string;
      reasonCode?: ReversalReasonCode;
      note?: string;
      notes?: string;
    }) => {
      const body = {
        reasonCode: reasonCode || 'OTHER',
        note: note || notes || 'Reversal requested',
      };
      const { data } = await apiClient.post(`/api/payments/${id}/reverse`, body);
      return data?.data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Payment reversed successfully' });
      invalidatePaymentQueries(queryClient);
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: 'Reversal failed',
        text2: error.response?.data?.message || 'Error reversing payment',
      });
    },
  });
};

export const downloadAndShareReceipt = async (paymentId: string, receiptNumber: string) => {
  try {
    const token = await getAccessToken();
    const url = `${BASE_URL}/api/payments/${paymentId}/receipt`;

    if (Platform.OS === 'web') {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      await safeShareAsync(blobUrl, {
        mimeType: 'application/pdf',
        dialogTitle: `Receipt_${receiptNumber}`,
      });
      return;
    }

    const fileUri = `${(FileSystem as any).documentDirectory || ''}Receipt_${receiptNumber}.pdf`;

    const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (downloadResult.status !== 200) {
      throw new Error('Failed to download PDF');
    }

    if (await safeIsAvailableAsync()) {
      await safeShareAsync(downloadResult.uri, {
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

export interface StaffBreakdownItem {
  userId: string;
  name: string;
  role: string;
  amountPaise: number;
}

export interface DayCloseReport {
  date: string;
  totalCollectedPaise: number;
  count: number;
  reversalsCount: number;
  reversalsPaise: number;
  byMode: Record<string, number>;
  expectedCashPaise: number;
  staffBreakdown: StaffBreakdownItem[];
  isClosed: boolean;
  dayClose?: {
    id: string;
    gymId: string;
    date: string;
    countedCashPaise: number;
    differencePaise: number;
    note?: string;
    createdAt?: string;
  };
}

export const fetchDayCloseReport = async (date?: string): Promise<DayCloseReport> => {
  const { data } = await apiClient.get('/api/payments/day-close', {
    params: date ? { date } : undefined,
  });
  return data?.data;
};

export const useDayCloseReport = (date?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['day-close', date],
    queryFn: () => fetchDayCloseReport(date),
    enabled,
  });
};

export const useSubmitDayClose = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      countedCashPaise,
      note,
    }: {
      date: string;
      countedCashPaise: number;
      note?: string;
    }) => {
      const { data } = await apiClient.post('/api/payments/day-close', {
        date,
        countedCashPaise,
        note,
      });
      return data?.data;
    },
    onSuccess: (_, variables) => {
      Toast.show({ type: 'success', text1: 'Day close submitted successfully' });
      queryClient.invalidateQueries({ queryKey: ['day-close', variables.date] });
      invalidatePaymentQueries(queryClient);
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: 'Day close failed',
        text2: error.response?.data?.message || 'Error submitting day close',
      });
    },
  });
};

export interface MemberPaymentContextResponse {
  memberId: string;
  memberName: string;
  totalDuePaise: number;
  memberships: MembershipDueItem[];
}

export const fetchMemberPaymentContext = async (memberId: string): Promise<MemberPaymentContextResponse> => {
  const { data } = await apiClient.get(`/api/members/${memberId}/payment-context`);
  return data?.data;
};

export const useMemberPaymentContext = (memberId?: string) => {
  return useQuery({
    queryKey: ['member-payment-context', memberId],
    queryFn: () => fetchMemberPaymentContext(memberId!),
    enabled: Boolean(memberId),
  });
};
