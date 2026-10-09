import { apiClient } from './axiosConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/useAuthStore';

export const useAddStaff = () => {
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/api/staff', payload);
      return data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Staff added successfully!' });
    },
    onError: (e: any) => {
      Toast.show({ type: 'error', text1: 'Error', text2: e.response?.data?.message || 'Failed to add staff' });
    }
  });
};

// Mock for Staff List since endpoint isn't fully implemented yet
export const useStaffList = () => {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      // return mock data for now
      return [
        { id: '1', name: 'John Staff', phone: '9876543210', active: true }
      ];
    }
  });
};

// Change Password
export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (payload: { currentPassword?: string; oldPassword?: string; newPassword: string }) => {
      const body = {
        oldPassword: payload.oldPassword || payload.currentPassword,
        newPassword: payload.newPassword,
      };
      const { data } = await apiClient.put('/api/auth/password', body);
      return data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Password changed successfully!' });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Password change failed',
        text2: e.response?.data?.message || 'Failed to update password',
      });
    },
  });
};

export const useGymSettings = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['settings'],
    enabled: isAuthenticated,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/api/gym');
        return {
          gymName: data.data.name || 'Gymholik Fitness',
          ownerName: data.data.ownerName || 'Owner',
          phone: data.data.phone || '',
          gymCode: data.data.gymCode || '',
          address: data.data.address || '',
          allowExpiredCheckin: data.data.allowExpiredCheckin ?? false,
          reminderDays: String(data.data.reminderDaysBefore || 5),
          staffCanSeeFullPhone: data.data.staffCanSeeFullPhone ?? false,
        };
      } catch {
        return {
          gymName: 'Gymholik Fitness',
          ownerName: 'Owner',
          phone: '',
          gymCode: '',
          address: '',
          allowExpiredCheckin: false,
          reminderDays: '5',
          staffCanSeeFullPhone: false,
        };
      }
    },
  });
};

export const useUpdateGymSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      address?: string;
      logoUrl?: string;
      allowExpiredCheckin?: boolean;
      reminderDaysBefore?: number;
      staffCanSeeFullPhone?: boolean;
    }) => {
      const { data } = await apiClient.put('/api/gym', payload);
      return data;
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Settings updated!' });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: e.response?.data?.message || 'Failed to update settings',
      });
    },
  });
};

