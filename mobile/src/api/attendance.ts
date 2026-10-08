import { apiClient } from './axiosConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { components } from './types';

export type AttendanceRecord = Required<components['schemas']['AttendanceRecordResponse']>;
export type AbsentRecord = Required<components['schemas']['AbsentMemberResponse']>;

export const fetchTodayAttendance = async (dateStr?: string): Promise<AttendanceRecord[]> => {
  const date = dateStr || new Date().toISOString().split('T')[0];
  const { data } = await apiClient.get('/api/attendance', { params: { date } });
  return data.data.content || [];
};

export const useTodayAttendance = (dateStr?: string) => {
  return useQuery({
    queryKey: ['attendance', 'today', dateStr],
    queryFn: () => fetchTodayAttendance(dateStr),
  });
};

export const fetchAbsentMembers = async (days: number): Promise<AbsentRecord[]> => {
  const { data } = await apiClient.get('/api/attendance/absent', { params: { days } });
  return data.data.content || [];
};

export const useAbsentMembers = (days: number) => {
  return useQuery({
    queryKey: ['attendance', 'absent', days],
    queryFn: () => fetchAbsentMembers(days),
  });
};

export const fetchMemberAttendanceHistory = async (memberId: string): Promise<AttendanceRecord[]> => {
  const { data } = await apiClient.get(`/api/attendance/members/${memberId}`, {
    params: { size: 30 },
  });
  return data.data.content || [];
};

export const useMemberAttendanceHistory = (memberId?: string) => {
  return useQuery({
    queryKey: ['attendance', 'member', memberId],
    queryFn: () => fetchMemberAttendanceHistory(memberId!),
    enabled: Boolean(memberId),
  });
};

export const useCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { memberId?: string; memberCode?: string; method: string }) => {
      const { data } = await apiClient.post('/api/attendance/checkin', payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

