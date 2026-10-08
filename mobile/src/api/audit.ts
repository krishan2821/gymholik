import { apiClient } from './axiosConfig';
import { useQuery } from '@tanstack/react-query';

export interface AuditLogItem {
  id: string;
  gymId: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetId?: string;
  details?: string;
  timestamp: string;
}

export interface PagedAuditLogs {
  content: AuditLogItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export const useAuditLogs = (params: {
  action?: string;
  actorId?: string;
  page?: number;
  size?: number;
}) => {
  return useQuery<PagedAuditLogs>({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/audit-logs', {
        params: {
          ...params,
          page: params.page ?? 0,
          size: params.size ?? 20,
        },
      });
      return data.data;
    },
  });
};
