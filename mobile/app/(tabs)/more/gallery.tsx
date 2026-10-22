import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Sparkles,
  Layers,
  Smartphone,
  Eye,
  Activity,
  Sliders,
  CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useAppearanceStore } from '../../../src/theme/useAppearance';
import {
  Button,
  Input,
  GlassCard,
  Badge,
  Chip,
  SegmentedControl,
  Switch,
  DatePicker,
  Skeleton,
  SkeletonCircle,
  CountUp,
  FilterBottomSheet,
  ConfirmDialog,
  FloatingTabBar,
} from '../../../src/components';
import Toast from 'react-native-toast-message';

export default function ComponentGalleryScreen() {
  const router = useRouter();
  const { colors, fonts, radius, spacing } = useTheme();
  const setAppearanceSetting = useAppearanceStore((s) => s.setSetting);
  const resolvedMode = useAppearanceStore((s) => s.resolvedMode);

  // Gallery interactive controls
  const [galleryPlatform, setGalleryPlatform] = useState<'ios26' | 'ios' | 'android'>('ios26');
  const [simulatedReduceMotion, setSimulatedReduceMotion] = useState(false);
  const [simulatedReduceTransparency, setSimulatedReduceTransparency] = useState(false);

  // Input states
  const [inputValue, setInputValue] = useState('Alex Rivera');
  const [emptyValue, setEmptyValue] = useState('');
  const [errorValue, setErrorValue] = useState('invalid@email');
  const [switchVal, setSwitchVal] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Segmented control state
  const [segmentIndex, setSegmentIndex] = useState(0);

  // Chip state
  const [selectedChip, setSelectedChip] = useState('All');

  // Sheet / dialog / toast states
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showConfirm, setShowConfirm] = useState(false);

  // Tab preview state
  const [tabRole, setTabRole] = useState<'OWNER' | 'STAFF' | 'TRAINER'>('OWNER');

  const toggleThemeMode = () => {
    setAppearanceSetting(resolvedMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { fontFamily: fonts.headingBold, color: colors.text }]}>
            Component Gallery
          </Text>
          <Text style={[styles.headerSubtitle, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            Theme & Platform Adaptive System
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleThemeMode}
          style={[styles.themePill, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 12, color: colors.primary }}>
            {resolvedMode.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Gallery Control Panel */}
        <View style={[styles.controlPanel, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.card }]}>
          <View style={styles.sectionTitleRow}>
            <Sliders size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { fontFamily: fonts.headingBold, color: colors.text }]}>
              Platform Style Simulation
            </Text>
          </View>

          <SegmentedControl
            options={[
              { label: 'iOS 26 (Glass)', value: 'ios26' },
              { label: 'iOS (Solid)', value: 'ios' },
              { label: 'Android (Material)', value: 'android' },
            ]}
            value={galleryPlatform}
            onChange={(_, val) => setGalleryPlatform(val as any)}
            style={{ marginBottom: 14 }}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { fontFamily: fonts.headingMedium, color: colors.text }]}>
                Reduce Motion
              </Text>
              <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 11, color: colors.textSecondary }}>
                Disables springs, shimmers, and scale transitions
              </Text>
            </View>
            <Switch
              value={simulatedReduceMotion}
              onValueChange={setSimulatedReduceMotion}
              platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
            />
          </View>

          <View style={[styles.switchRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { fontFamily: fonts.headingMedium, color: colors.text }]}>
                Reduce Transparency
              </Text>
              <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 11, color: colors.textSecondary }}>
                Degrades all glass surfaces to solid tonal surfaces
              </Text>
            </View>
            <Switch
              value={simulatedReduceTransparency}
              onValueChange={setSimulatedReduceTransparency}
              platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
            />
          </View>
        </View>

        {/* 1. BUTTONS */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            1. Buttons (Capsule Shape)
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            iOS: Spring scale + haptic. Android: android_ripple + light haptic.
          </Text>

          <View style={styles.componentStack}>
            <Button
              title="Primary Capsule Button"
              variant="primary"
              platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
              onPress={() => Toast.show({ type: 'success', text1: 'Primary Pressed' })}
            />

            <Button
              title="Secondary Capsule Button"
              variant="secondary"
              platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
              onPress={() => Toast.show({ type: 'info', text1: 'Secondary Pressed' })}
            />

            <Button
              title="Destructive Capsule Button"
              variant="destructive"
              platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
              onPress={() => Toast.show({ type: 'error', text1: 'Destructive Pressed' })}
            />

            <Button
              title="Ghost Button"
              variant="ghost"
              platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
              onPress={() => {}}
            />

            <View style={styles.rowTwoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Button
                  title="Disabled (4.5:1)"
                  variant="primary"
                  disabled
                  platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Button
                  title="Loading State"
                  variant="primary"
                  loading
                  platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 2. INPUTS & PICKERS & SWITCH */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            2. Inputs, Pickers & Switch
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            Filled style (surfaceRaised), 18 radius, 1px border, floating label, primary focus.
          </Text>

          <Input
            label="Full Name (Filled)"
            value={inputValue}
            onChangeText={setInputValue}
          />

          <Input
            label="Phone Number with Prefix"
            placeholder="98765 43210"
            prefix="+91"
            value={emptyValue}
            onChangeText={setEmptyValue}
          />

          <Input
            label="Email Address (Error State)"
            value={errorValue}
            onChangeText={setErrorValue}
            error="Please enter a valid email address"
          />

          <DatePicker
            label="Date of Admission (Platform Native)"
            value={selectedDate}
            onChange={setSelectedDate}
            platformOverride={galleryPlatform === 'android' ? 'android' : galleryPlatform === 'ios26' ? 'ios' : 'ios'}
          />

          <View style={[styles.switchContainer, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.headingMedium, fontSize: 14, color: colors.text }}>
                Native Platform Switch
              </Text>
              <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textSecondary }}>
                44px accessible touch target
              </Text>
            </View>
            <Switch
              value={switchVal}
              onValueChange={setSwitchVal}
              platformOverride={galleryPlatform === 'android' ? 'android' : 'ios'}
            />
          </View>
        </View>

        {/* 3. CARDS & ROWS */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            3. Cards & Rows (Solid Surfaces)
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            Solid surfaces with border; Android uses tonal elevation. Strictly no glass on cards.
          </Text>

          <GlassCard style={{ marginBottom: 12 }} contentStyle={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.text }}>
                  Premium Annual Plan
                </Text>
                <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  Solid card surface with border
                </Text>
              </View>
              <Badge label="Active" variant="active" />
            </View>
          </GlassCard>

          <GlassCard variant="surfaceRaised" contentStyle={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.text }}>
                  Tonal Surface Raised Card
                </Text>
                <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  Higher surface layer (Android tonal elevation)
                </Text>
              </View>
              <Badge label="Paid" variant="paid" />
            </View>
          </GlassCard>
        </View>

        {/* 4. CHIPS & SEGMENTED CONTROL */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            4. Chips & Segmented Control
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            Sliding selection pill, selected state in primarySoft/primary, accessible at 44px.
          </Text>

          <Text style={{ fontFamily: fonts.headingMedium, fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
            Segmented Control (Sliding Pill):
          </Text>
          <SegmentedControl
            options={['Month', 'Quarter', 'Year']}
            selectedIndex={segmentIndex}
            onChange={(idx) => setSegmentIndex(idx)}
            variant="primarySoft"
            style={{ marginBottom: 14 }}
          />

          <Text style={{ fontFamily: fonts.headingMedium, fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
            Filter Chips (Capsule, 44px Touch Target):
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['All', 'Active', 'Due', 'Expired'].map((filter) => (
              <Chip
                key={filter}
                label={filter}
                selected={selectedChip === filter}
                onPress={() => setSelectedChip(filter)}
                count={filter === 'All' ? 42 : filter === 'Active' ? 38 : 4}
              />
            ))}
          </View>
        </View>

        {/* 5. STATUS BADGES */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            5. Status Badges (Chip Tokens + Icon + Word)
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            Always show an icon plus a word so meaning never depends on colour alone.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Badge label="Active" variant="active" />
            <Badge label="Upcoming" variant="upcoming" />
            <Badge label="Expiring" variant="expiring" />
            <Badge label="Expired" variant="expired" />
            <Badge label="Due" variant="due" />
            <Badge label="Paid" variant="paid" />
          </View>
        </View>

        {/* 6. BOTTOM SHEETS, DIALOGS, TOASTS */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            6. Sheets, Dialogs & Toasts
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            iOS 26 glass; elsewhere solid tonal with 28 radius on top corners and drag handle.
          </Text>

          <View style={{ gap: 10 }}>
            <Button
              title="Open Filter Bottom Sheet (28 Radius + Handle)"
              variant="secondary"
              onPress={() => setShowFilterSheet(true)}
            />

            <Button
              title="Open Confirm Dialog"
              variant="secondary"
              onPress={() => setShowConfirm(true)}
            />

            <View style={styles.rowTwoCol}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Button
                  title="Toast Success"
                  size="sm"
                  variant="secondary"
                  onPress={() => Toast.show({ type: 'success', text1: 'Payment Collected', text2: 'Receipt #GH-1092 sent' })}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Button
                  title="Toast Error"
                  size="sm"
                  variant="destructive"
                  onPress={() => Toast.show({ type: 'error', text1: 'Sync Error', text2: 'Please retry connection' })}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 7. MOTION & COUNT-UP & SKELETON */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            7. Motion: Springs, Shimmer & Count-Up
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            Tabular numbers count-up and continuous skeleton shimmer with Reduce Motion respect.
          </Text>

          <GlassCard style={{ marginBottom: 14 }} contentStyle={{ padding: 18, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.headingMedium, fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
              TOTAL REVENUE (TABULAR COUNT-UP)
            </Text>
            <CountUp
              value={485000}
              prefix="₹"
              formatter={(v) => v.toLocaleString('en-IN')}
              style={{ fontFamily: fonts.headingBold, fontSize: 34, color: colors.text }}
            />
          </GlassCard>

          <Text style={{ fontFamily: fonts.headingMedium, fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
            Skeleton Shimmer Sweep:
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SkeletonCircle size={44} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Skeleton width="80%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="50%" height={12} />
              </View>
            </View>
            <Skeleton width="100%" height={16} />
          </View>
        </View>

        {/* 8. TAB BAR PREVIEW */}
        <View style={[styles.sectionBlock, { marginBottom: 80 }]}>
          <Text style={[styles.sectionHeading, { fontFamily: fonts.headingBold, color: colors.text }]}>
            8. Floating Tab Bar Preview
          </Text>
          <Text style={[styles.sectionSub, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            iOS 26 glass vs Android solid tonal with Material 3 pill active indicator. Raised check-in button.
          </Text>

          <SegmentedControl
            options={['OWNER (5 Tabs)', 'STAFF (5 Tabs)', 'TRAINER (4 Tabs)']}
            selectedIndex={tabRole === 'OWNER' ? 0 : tabRole === 'STAFF' ? 1 : 2}
            onChange={(idx) => setTabRole(idx === 0 ? 'OWNER' : idx === 1 ? 'STAFF' : 'TRAINER')}
            style={{ marginBottom: 16 }}
          />

          <View style={{ height: 100, position: 'relative', width: '100%', justifyContent: 'center' }}>
            <FloatingTabBar
              platformOverride={galleryPlatform}
              roleOverride={tabRole}
              state={{
                index: 0,
                routes: [
                  { key: 'index-1', name: 'index' },
                  { key: 'members-2', name: 'members' },
                  { key: 'attendance-3', name: 'attendance' },
                  { key: 'payments-4', name: 'payments' },
                  { key: 'notes-5', name: 'notes' },
                  { key: 'profile-6', name: 'profile' },
                  { key: 'more-7', name: 'more' },
                ],
              }}
              navigation={{
                emit: () => ({ defaultPrevented: false }),
                navigate: () => {},
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        visible={showFilterSheet}
        title="Filter Members"
        options={[
          { label: 'All Members', value: 'all' },
          { label: 'Active Members Only', value: 'active' },
          { label: 'Expiring This Week', value: 'expiring' },
          { label: 'Due Balances Only', value: 'due' },
        ]}
        selectedValue={selectedFilter}
        onSelect={setSelectedFilter}
        onClose={() => setShowFilterSheet(false)}
        platformOverride={galleryPlatform}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={showConfirm}
        title="Confirm Plan Cancellation"
        message="Are you sure you want to cancel this member's subscription? This action cannot be undone."
        confirmText="Cancel Plan"
        cancelText="Keep Plan"
        isDestructive
        platformOverride={galleryPlatform}
        onConfirm={() => {
          setShowConfirm(false);
          Toast.show({ type: 'success', text1: 'Plan Cancelled' });
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  themePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  controlPanel: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 16,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 12,
    marginBottom: 12,
  },
  componentStack: {
    gap: 10,
  },
  rowTwoCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    marginTop: 4,
  },
});
