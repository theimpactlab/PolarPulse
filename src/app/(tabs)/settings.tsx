import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Link2,
  Unlink,
  RefreshCw,
  Download,
  Trash2,
  ChevronRight,
  Moon,
  Clock,
  Shield,
  HelpCircle,
  ExternalLink,
  User,
  LogOut,
  LogIn,
  Heart,
  Pencil,
} from 'lucide-react-native';
import { useAppStore, type UserSettings } from '@/lib/state/app-store';
import { useAuthStore } from '@/lib/state/auth-store';
import Animated, { useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { X, Check } from 'lucide-react-native';

const SLEEP_GOAL_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export default function SettingsScreen() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingHealth, setIsSyncingHealth] = useState(false);
  const [showSleepGoalPicker, setShowSleepGoalPicker] = useState(false);

  // App store - Polar
  const isPolarConnected = useAppStore((s): boolean => s.isPolarConnected);
  const lastSyncDate = useAppStore((s): string | undefined => s.lastSyncDate);
  const userSettings = useAppStore((s): UserSettings => s.userSettings);
  const connectPolar = useAppStore((s) => s.connectPolar);
  const disconnectPolar = useAppStore((s) => s.disconnectPolar);
  const syncData = useAppStore((s) => s.syncData);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const exportData = useAppStore((s) => s.exportData);
  const updateSettings = useAppStore((s) => s.updateSettings);

  // App store - Apple Health
  const isAppleHealthConnected = useAppStore((s): boolean => s.isAppleHealthConnected);
  const isAppleHealthAvailable = useAppStore((s): boolean => s.isAppleHealthAvailable);
  const lastAppleHealthSyncDate = useAppStore((s): string | undefined => s.lastAppleHealthSyncDate);
  const connectAppleHealth = useAppStore((s) => s.connectAppleHealth);
  const disconnectAppleHealth = useAppStore((s) => s.disconnectAppleHealth);
  const syncAppleHealth = useAppStore((s) => s.syncAppleHealth);

  // Auth store
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  const handleConnectPolar = async () => {
    const result = await connectPolar();
    if (!result.success) {
      Alert.alert('Connection Failed', result.error || 'Unable to connect to Polar Flow');
    }
  };

  const handleDisconnectPolar = () => {
    Alert.alert(
      'Disconnect Polar',
      'This will disconnect your Polar account. Your historical data will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => disconnectPolar() },
      ]
    );
  };

  const handleSyncPolar = async () => {
    setIsSyncing(true);
    try {
      const result = await syncData();
      if (result.success) {
        Alert.alert('Sync Complete', `Synced ${result.synced ?? 0} records from Polar`);
      } else {
        Alert.alert('Sync Failed', result.error || 'Unable to sync data');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectAppleHealth = async () => {
    const result = await connectAppleHealth();
    if (!result.success) {
      Alert.alert('Connection Failed', result.error || 'Unable to connect to Apple Health');
    } else {
      // Auto-sync after connecting
      handleSyncAppleHealth();
    }
  };

  const handleDisconnectAppleHealth = () => {
    Alert.alert(
      'Disconnect Apple Health',
      'This will stop syncing from Apple Health. Your historical data will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: disconnectAppleHealth },
      ]
    );
  };

  const handleSyncAppleHealth = async () => {
    setIsSyncingHealth(true);
    try {
      const result = await syncAppleHealth();
      if (result.success) {
        Alert.alert('Sync Complete', `Synced ${result.synced} records from Apple Health`);
      } else {
        Alert.alert('Sync Failed', result.error || 'Unable to sync data');
      }
    } finally {
      setIsSyncingHealth(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportData();
      Alert.alert('Export Ready', 'Your data has been exported to CSV format.');
    } catch {
      Alert.alert('Export Failed', 'Unable to export data. Please try again.');
    }
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your fitness, recovery, and sleep data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            clearAllData();
            Alert.alert('Data Deleted', 'All your data has been removed.');
          }
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          }
        },
      ]
    );
  };

  const handleSleepGoalChange = (hours: number) => {
    updateSettings({ sleepGoalHours: hours });
    setShowSleepGoalPicker(false);
  };

  const polarSpinStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: isSyncing
            ? withRepeat(
                withTiming('360deg', { duration: 1000, easing: Easing.linear }),
                -1,
                false
              )
            : '0deg',
        },
      ],
    };
  });

  const healthSpinStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: isSyncingHealth
            ? withRepeat(
                withTiming('360deg', { duration: 1000, easing: Easing.linear }),
                -1,
                false
              )
            : '0deg',
        },
      ],
    };
  });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-3xl font-bold text-textPrimary">Settings</Text>
        </View>

        {/* Account Section */}
        <View className="mx-5 mt-4">
          <Text className="text-textMuted text-xs font-semibold mb-3 ml-1">ACCOUNT</Text>
          <View className="bg-surface rounded-2xl overflow-hidden">
            {isAuthenticated ? (
              <>
                {/* Profile */}
                <Pressable
                  onPress={() => router.push('/edit-profile')}
                  className="p-4 border-b border-border active:bg-surfaceLight"
                >
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                      <User size={24} color="#00D1A7" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-textPrimary font-semibold">
                        {profile?.full_name || profile?.email || 'User'}
                      </Text>
                      <Text className="text-textMuted text-sm">{profile?.email}</Text>
                    </View>
                    <Pencil size={18} color="#6B7280" />
                  </View>
                </Pressable>

                {/* Sign Out */}
                <Pressable
                  onPress={handleSignOut}
                  className="p-4 flex-row items-center active:bg-surfaceLight"
                >
                  <LogOut size={20} color="#FF4757" />
                  <Text className="text-recovery-low ml-3">Sign Out</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => router.push('/login')}
                className="p-4 flex-row items-center justify-between active:bg-surfaceLight"
              >
                <View className="flex-row items-center">
                  <LogIn size={20} color="#00D1A7" />
                  <View className="ml-3">
                    <Text className="text-textPrimary font-medium">Sign In</Text>
                    <Text className="text-textMuted text-sm">
                      Sync data across devices
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#6B7280" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Data Sources Section */}
        <View className="mx-5 mt-6">
          <Text className="text-textMuted text-xs font-semibold mb-3 ml-1">DATA SOURCES</Text>
          <View className="bg-surface rounded-2xl overflow-hidden">

            {/* Apple Health */}
            <View className="p-4 border-b border-border">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center ${isAppleHealthConnected ? 'bg-red-500/20' : 'bg-surfaceLight'}`}>
                    <Heart size={20} color={isAppleHealthConnected ? '#FF3B30' : '#6B7280'} />
                  </View>
                  <View className="ml-3">
                    <Text className="text-textPrimary font-semibold">Apple Health</Text>
                    <Text className={`text-sm ${isAppleHealthConnected ? 'text-red-400' : 'text-textMuted'}`}>
                      {Platform.OS !== 'ios'
                        ? 'iOS only'
                        : isAppleHealthConnected
                          ? 'Connected'
                          : 'Not connected'}
                    </Text>
                  </View>
                </View>

                {Platform.OS === 'ios' ? (
                  isAppleHealthConnected ? (
                    <Pressable
                      onPress={handleDisconnectAppleHealth}
                      className="px-4 py-2 bg-surfaceLight rounded-lg active:opacity-70"
                    >
                      <Text className="text-recovery-low text-sm font-medium">Disconnect</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleConnectAppleHealth}
                      className="px-4 py-2 bg-red-500 rounded-lg active:opacity-70"
                    >
                      <Text className="text-white text-sm font-semibold">Connect</Text>
                    </Pressable>
                  )
                ) : (
                  <View className="px-4 py-2 bg-surfaceLight rounded-lg opacity-50">
                    <Text className="text-textMuted text-sm font-medium">iOS Only</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Apple Health Sync */}
            {isAppleHealthConnected && (
              <Pressable
                onPress={handleSyncAppleHealth}
                disabled={isSyncingHealth}
                className="p-4 flex-row items-center justify-between border-b border-border active:bg-surfaceLight"
              >
                <View className="flex-row items-center">
                  <Animated.View style={healthSpinStyle}>
                    <RefreshCw size={20} color="#9CA3AF" />
                  </Animated.View>
                  <View className="ml-3">
                    <Text className="text-textPrimary font-medium">Sync Apple Health</Text>
                    {lastAppleHealthSyncDate && (
                      <Text className="text-textMuted text-sm">
                        Last synced: {new Date(lastAppleHealthSyncDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
                <Text className="text-red-400 text-sm font-medium">
                  {isSyncingHealth ? 'Syncing...' : 'Sync Now'}
                </Text>
              </Pressable>
            )}

            {/* Polar Flow */}
            <View className="p-4 border-b border-border">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center ${isPolarConnected ? 'bg-primary/20' : 'bg-surfaceLight'}`}>
                    {isPolarConnected ? (
                      <Link2 size={20} color="#00D1A7" />
                    ) : (
                      <Unlink size={20} color="#6B7280" />
                    )}
                  </View>
                  <View className="ml-3">
                    <Text className="text-textPrimary font-semibold">Polar Flow</Text>
                    <Text className={`text-sm ${isPolarConnected ? 'text-primary' : 'text-textMuted'}`}>
                      {isPolarConnected ? 'Connected' : 'Not connected'}
                    </Text>
                  </View>
                </View>

                {isPolarConnected ? (
                  <Pressable
                    onPress={handleDisconnectPolar}
                    className="px-4 py-2 bg-surfaceLight rounded-lg active:opacity-70"
                  >
                    <Text className="text-recovery-low text-sm font-medium">Disconnect</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleConnectPolar}
                    className="px-4 py-2 bg-primary rounded-lg active:opacity-70"
                  >
                    <Text className="text-background text-sm font-semibold">Connect</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Polar Sync Status */}
            {isPolarConnected && (
              <Pressable
                onPress={handleSyncPolar}
                disabled={isSyncing}
                className="p-4 flex-row items-center justify-between active:bg-surfaceLight"
              >
                <View className="flex-row items-center">
                  <Animated.View style={polarSpinStyle}>
                    <RefreshCw size={20} color="#9CA3AF" />
                  </Animated.View>
                  <View className="ml-3">
                    <Text className="text-textPrimary font-medium">Sync Polar Data</Text>
                    {lastSyncDate && (
                      <Text className="text-textMuted text-sm">
                        Last synced: {new Date(lastSyncDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
                <Text className="text-primary text-sm font-medium">
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <View className="mx-5 mt-6">
          <Text className="text-textMuted text-xs font-semibold mb-3 ml-1">PREFERENCES</Text>
          <View className="bg-surface rounded-2xl overflow-hidden">
            {/* Sleep Goal */}
            <Pressable
              onPress={() => setShowSleepGoalPicker(true)}
              className="p-4 flex-row items-center justify-between border-b border-border active:bg-surfaceLight"
            >
              <View className="flex-row items-center">
                <Moon size={20} color="#9CA3AF" />
                <Text className="text-textPrimary ml-3">Sleep Goal</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-textSecondary mr-2">{userSettings?.sleepGoalHours ?? 8} hours</Text>
                <ChevronRight size={18} color="#6B7280" />
              </View>
            </Pressable>

            {/* Units */}
            <Pressable className="p-4 flex-row items-center justify-between active:bg-surfaceLight">
              <View className="flex-row items-center">
                <Clock size={20} color="#9CA3AF" />
                <Text className="text-textPrimary ml-3">Units</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-textSecondary mr-2">{userSettings?.units ?? 'Metric'}</Text>
                <ChevronRight size={18} color="#6B7280" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Data Section */}
        <View className="mx-5 mt-6">
          <Text className="text-textMuted text-xs font-semibold mb-3 ml-1">YOUR DATA</Text>
          <View className="bg-surface rounded-2xl overflow-hidden">
            {/* Export Data */}
            <Pressable
              onPress={handleExport}
              className="p-4 flex-row items-center justify-between border-b border-border active:bg-surfaceLight"
            >
              <View className="flex-row items-center">
                <Download size={20} color="#9CA3AF" />
                <Text className="text-textPrimary ml-3">Export Data (CSV)</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </Pressable>

            {/* Delete Data */}
            <Pressable
              onPress={handleDeleteData}
              className="p-4 flex-row items-center justify-between active:bg-surfaceLight"
            >
              <View className="flex-row items-center">
                <Trash2 size={20} color="#FF4757" />
                <Text className="text-recovery-low ml-3">Delete All Data</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </Pressable>
          </View>
        </View>

        {/* About Section */}
        <View className="mx-5 mt-6">
          <Text className="text-textMuted text-xs font-semibold mb-3 ml-1">ABOUT</Text>
          <View className="bg-surface rounded-2xl overflow-hidden">
            {/* Privacy */}
            <Pressable className="p-4 flex-row items-center justify-between border-b border-border active:bg-surfaceLight">
              <View className="flex-row items-center">
                <Shield size={20} color="#9CA3AF" />
                <Text className="text-textPrimary ml-3">Privacy Policy</Text>
              </View>
              <ExternalLink size={18} color="#6B7280" />
            </Pressable>

            {/* Help */}
            <Pressable className="p-4 flex-row items-center justify-between active:bg-surfaceLight">
              <View className="flex-row items-center">
                <HelpCircle size={20} color="#9CA3AF" />
                <Text className="text-textPrimary ml-3">Help & Support</Text>
              </View>
              <ExternalLink size={18} color="#6B7280" />
            </Pressable>
          </View>
        </View>

        {/* Version */}
        <View className="items-center mt-8 mb-8">
          <Text className="text-textMuted text-xs">Version 1.0.0</Text>
          <Text className="text-textMuted text-xs mt-1">Polar + Apple Health</Text>
        </View>
      </ScrollView>

      {/* Sleep Goal Picker Modal */}
      <Modal
        visible={showSleepGoalPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSleepGoalPicker(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setShowSleepGoalPicker(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-surface rounded-t-3xl"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Pressable
                onPress={() => setShowSleepGoalPicker(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <X size={24} color="#9CA3AF" />
              </Pressable>
              <Text className="text-textPrimary font-semibold text-lg">Sleep Goal</Text>
              <View className="w-10" />
            </View>

            {/* Options */}
            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              {SLEEP_GOAL_OPTIONS.map((hours) => {
                const isSelected = (userSettings?.sleepGoalHours ?? 8) === hours;
                return (
                  <Pressable
                    key={hours}
                    onPress={() => handleSleepGoalChange(hours)}
                    className={`p-4 flex-row items-center justify-between border-b border-border active:bg-surfaceLight ${isSelected ? 'bg-primary/10' : ''}`}
                  >
                    <Text className={`text-base ${isSelected ? 'text-primary font-semibold' : 'text-textPrimary'}`}>
                      {hours} hours
                    </Text>
                    {isSelected && <Check size={20} color="#00D1A7" />}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Bottom safe area */}
            <View className="h-8" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
