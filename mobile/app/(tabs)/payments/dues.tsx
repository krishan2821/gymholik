import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Screen } from '../../../src/components/Screen';

export default function DuesListScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role || s.role);

  useEffect(() => {
    if (role === 'TRAINER') {
      router.replace('/(tabs)/members');
    } else {
      router.replace({ pathname: '/(tabs)/payments', params: { tab: 'DUES' } });
    }
  }, [router, role]);

  return <Screen>{null}</Screen>;
}
