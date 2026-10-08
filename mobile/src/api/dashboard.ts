import { apiClient } from './axiosConfig';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';

export interface ExpiringMember {
  memberId: string;
  memberName: string;
  phone: string;
  daysLeft: number;
}

export interface DailyCollection {
  date: string;
  amountPaise: number;
}

export interface DashboardData {
  activeMembers: number;
  todayCollection: number | null;
  monthCollection: number | null;
  expiringSoon: number;
  newJoinings: number;
  todayAttendance: number;
  totalDue: number | null;
  expiringSoonList?: ExpiringMember[];
  last7DaysCollection?: DailyCollection[];
  subscriptionDaysRemaining?: number;
}

export const fetchDashboardData = async (): Promise<DashboardData> => {
  const { data } = await apiClient.get('/api/dashboard');
  return data.data;
};

export const useDashboardData = () => {
  const { gymId, isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ['dashboard', gymId],
    queryFn: fetchDashboardData,
    enabled: !!isAuthenticated && !!gymId,
    staleTime: 60 * 1000, // 60 seconds
  });
};
