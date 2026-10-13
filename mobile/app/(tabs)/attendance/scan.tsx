import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import {
  safeNotificationAsync,
  NotificationFeedbackType,
} from '../../../src/utils/safeHaptics';
import { safeOpenSettings } from '../../../src/utils/safeLinking';
import { X, Flashlight, AlertCircle, CheckCircle } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useCheckIn } from '../../../src/api/attendance';
import { Button } from '../../../src/components/Button';
import { CheckInSuccessModal } from '../../../src/components/CheckInSuccessModal';
import { formatMoney } from '../../../src/utils/formatters';
import { SCANNER, COMMON } from '../../../src/constants/strings';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);

  const [scannedData, setScannedData] = useState<string | null>(null);
  const [resultOverlay, setResultOverlay] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    name?: string;
    photo?: string;
    memberId?: string;
    membershipId?: string;
    duePaise?: number;
  } | null>(null);
  const lastScanTimeRef = useRef(0);
  const lastCodeRef = useRef<string | null>(null);
  const isMounted = useRef(true);

  const checkInMutation = useCheckIn();

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    const isWeb = Platform.OS === 'web';
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>{SCANNER.CAMERA_TITLE}</Text>
        <Text style={styles.permissionDesc}>
          {isWeb
            ? 'Camera access in web browsers requires browser permissions and a secure connection (HTTPS). Please allow camera access in your browser or mark attendance manually.'
            : SCANNER.CAMERA_DESC}
        </Text>
        <View style={{ width: '100%', marginBottom: 12 }}>
          <Button title={COMMON.GRANT_PERMISSION} onPress={requestPermission} size="md" />
        </View>
        <View style={{ width: '100%', marginBottom: 12 }}>
          <Button
            title={COMMON.OPEN_SETTINGS}
            variant="secondary"
            onPress={() => safeOpenSettings()}
            size="md"
          />
        </View>
        <View style={{ width: '100%' }}>
          <Button
            title="Back to Attendance"
            variant="secondary"
            onPress={() => safeBack('/(tabs)/attendance')}
            size="md"
          />
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2000) return;
    if (data === lastCodeRef.current && now - lastScanTimeRef.current < 5000) return;

    lastScanTimeRef.current = now;
    lastCodeRef.current = data;
    setScannedData(data);

    try {
      const res = await checkInMutation.mutateAsync({ memberCode: data, method: 'QR' });

      if (isMounted.current) {
        const hasWarning = res.data?.membershipExpiredWarning || res.data?.hasDue;
        if (hasWarning) {
          safeNotificationAsync(NotificationFeedbackType.Warning).catch(() => {});
          setResultOverlay({
            type: 'warning',
            message: res.data?.membershipExpiredWarning
              ? 'Membership has expired!'
              : 'Pending fee balance',
            name: res.data?.memberName || 'Member',
            memberId: res.data?.memberId,
            membershipId: res.data?.membershipId,
            duePaise: res.data?.duePaise,
          });
          return;
        }

        safeNotificationAsync(NotificationFeedbackType.Success).catch(() => {});
        setResultOverlay({
          type: 'success',
          message: SCANNER.CHECKED_IN,
          name: res.data?.memberName || 'Member',
          photo: res.data?.photoUrl,
        });
      }
    } catch (e: any) {
      if (isMounted.current) {
        safeNotificationAsync(NotificationFeedbackType.Error).catch(() => {});
        const msg = e.response?.data?.message || SCANNER.CHECK_IN_FAILED;
        setResultOverlay({
          type: 'error',
          message: msg,
        });
      }
    }

    setTimeout(() => {
      if (isMounted.current) {
        setResultOverlay(null);
        setScannedData(null);
      }
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scannedData ? undefined : handleBarCodeScanned}
      />
      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        {/* Header controls */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => safeBack('/(tabs)/attendance')}
            accessibilityLabel="Close camera"
          >
            <X color={theme.colors.text} size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setTorch(!torch)}
            accessibilityLabel="Toggle flashlight"
          >
            <Flashlight color={torch ? theme.colors.primary : theme.colors.text} size={22} />
          </TouchableOpacity>
        </View>

        {/* Scanner Guide Frame */}
        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <Text style={styles.helperText}>{SCANNER.AIM_HINT}</Text>
      </View>

      {/* Full-Screen Sage Pulse Check-In Success Modal */}
      <CheckInSuccessModal
        visible={resultOverlay?.type === 'success'}
        memberName={resultOverlay?.name}
        onDismiss={() => {
          setResultOverlay(null);
          setScannedData(null);
        }}
      />

      {/* Warning Card for Expired or Due Check-In */}
      {resultOverlay && resultOverlay.type === 'warning' && (
        <View style={[styles.resultOverlay, styles.resultWarningOverlay]}>
          <View style={styles.warningCard}>
            <View style={styles.warningIconCircle}>
              <AlertCircle color={theme.colors.warning} size={44} />
            </View>
            <Text style={styles.warningTitle}>{resultOverlay.name || 'Member Checked In'}</Text>
            <Text style={styles.warningSubtitle}>{resultOverlay.message}</Text>
            {resultOverlay.duePaise ? (
              <View style={styles.warningDueBox}>
                <Text style={styles.warningDueLabel}>Outstanding Balance</Text>
                <Text style={styles.warningDueAmount}>
                  {formatMoney(resultOverlay.duePaise)}
                </Text>
              </View>
            ) : null}

            <View style={styles.warningActionsCol}>
              <Button
                title="Collect Fee"
                variant="primary"
                size="md"
                onPress={() => {
                  setResultOverlay(null);
                  router.push({
                    pathname: '/(tabs)/payments/collect',
                    params: {
                      memberId: resultOverlay.memberId,
                      membershipId: resultOverlay.membershipId,
                    },
                  });
                }}
              />
              <Button
                title="Renew Now"
                variant="secondary"
                size="md"
                onPress={() => {
                  setResultOverlay(null);
                  router.push(`/(tabs)/members/${resultOverlay.memberId}/renew`);
                }}
              />
              <Button
                title="Dismiss"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setResultOverlay(null);
                  setScannedData(null);
                }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Result Error Overlay */}
      {resultOverlay && resultOverlay.type === 'error' && (
        <View style={[styles.resultOverlay, styles.resultError]}>
          <AlertCircle color={theme.colors.error} size={52} />
          <Text style={styles.resultMessage}>{resultOverlay.message}</Text>
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  permissionTitle: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  permissionDesc: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.65)',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 44,
  },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(11, 43, 38, 0.85)',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: theme.colors.primary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  helperText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 44,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 24,
  },
  resultSuccess: {
    backgroundColor: 'rgba(11, 43, 38, 0.95)',
  },
  resultError: {
    backgroundColor: 'rgba(5, 31, 32, 0.95)',
  },
  resultPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  resultName: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginTop: 8,
  },
  resultMessage: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  resultWarningOverlay: {
    backgroundColor: 'rgba(5, 31, 32, 0.92)',
  },
  warningCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 0, 0.3)',
  },
  warningIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 179, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  warningTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    textAlign: 'center',
  },
  warningSubtitle: {
    ...theme.typography.body,
    color: theme.colors.warning,
    marginTop: 4,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  warningDueBox: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  warningDueLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warningDueAmount: {
    ...theme.typography.h2,
    color: theme.colors.coral,
    marginTop: 2,
  },
  warningActionsCol: {
    width: '100%',
    gap: theme.spacing.sm,
  },
});
