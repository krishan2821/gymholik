import { apiClient } from './axiosConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/useAuthStore';
import { saveUserProfile } from '../utils/tokenUtils';

export interface StaffMember {
  id: string;
  gymId: string;
  name: string;
  phone: string;
  role: string;
  active: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export interface CreateStaffPayload {
  name: string;
  phone: string;
}

export interface UpdateStaffPayload {
  name?: string;
  phone?: string;
  active?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}

export const useStaffList = (options?: { enabled?: boolean }) => {
  return useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/staff');
      return data.data;
    },
    ...options,
  });
};

export const useAddStaff = () => {
  const queryClient = useQueryClient();
  return useMutation<StaffMember, any, CreateStaffPayload>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post('/api/staff', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
};

export const useUpdateStaff = () => {
  const queryClient = useQueryClient();
  return useMutation<StaffMember, any, { id: string; payload: UpdateStaffPayload }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await apiClient.patch(`/api/staff/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
};

export const useGymSettings = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['settings'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data } = await apiClient.get('/api/gym');
      return {
        gymName: data.data.name || 'Gymholik Fitness',
        ownerName: data.data.ownerName || 'Owner',
        phone: data.data.phone || '',
        address: data.data.address || '',
        allowExpiredCheckin: data.data.allowExpiredCheckin ?? false,
        reminderDays: String(data.data.reminderDaysBefore || 5),
        staffCanSeeFullPhone: data.data.staffCanSeeFullPhone ?? false,
      };
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
      return data.data;
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

export interface GymAddress {
  line1: string;
  line2?: string;
  state: string;
  district: string;
  pincode: string;
}

export type GymType =
  | 'COMMERCIAL'
  | 'BOUTIQUE_STUDIO'
  | 'CROSSFIT_BOX'
  | 'BODYBUILDING_POWERLIFTING'
  | 'PREMIUM_LUXURY'
  | 'WOMEN_ONLY'
  | 'HOME_GYM';

export type LegalIdType = 'UDYAM' | 'GSTIN' | 'NIC';

export interface GymProfile {
  id: string;
  name: string;
  gymCode?: string;
  gymType?: GymType;
  status?: string;
  subscriptionValidTill?: string;
  daysRemaining?: number;
  legalIdVerified: boolean;
  legalIdType?: LegalIdType;
  legalIdNumber?: string;
  address?: GymAddress;
  logoUrl?: string;
  allowExpiredCheckin?: boolean;
  reminderDaysBefore?: number;
  staffCanSeeFullPhone?: boolean;
}

export interface UpdateGymProfilePayload {
  name: string;
  gymType: GymType;
  legalIdType?: LegalIdType | null;
  legalIdNumber?: string | null;
  address: GymAddress;
}

export const useGymProfile = (options?: { reveal?: boolean; enabled?: boolean }) => {
  const reveal = options?.reveal ?? false;
  return useQuery<GymProfile>({
    queryKey: ['gymProfile', { reveal }],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/gym/profile', {
        params: reveal ? { reveal: true } : undefined,
      });
      return data.data;
    },
    enabled: options?.enabled !== false,
  });
};

export const useUpdateGymProfile = () => {
  const queryClient = useQueryClient();
  const { setUser, user } = useAuthStore();
  return useMutation<GymProfile, any, UpdateGymProfilePayload>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.put('/api/gym/profile', payload);
      return data.data;
    },
    onSuccess: (updated) => {
      Toast.show({ type: 'success', text1: 'Gym profile updated!' });
      queryClient.invalidateQueries({ queryKey: ['gymProfile'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      if (user) {
        const updatedUser = {
          ...user,
          gymId: user.gymId || null,
          gymName: updated.name,
          gymType: updated.gymType || user.gymType || null,
        };
        setUser(updatedUser);
        saveUserProfile(updatedUser).catch(() => {});
      }
    },
    onError: (e: any) => {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: e.response?.data?.message || 'Failed to update gym profile',
      });
    },
  });
};

