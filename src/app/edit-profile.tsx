import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, User, Mail, Check } from 'lucide-react-native';
import { useAuthStore } from '@/lib/state/auth-store';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function EditProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = fullName !== (profile?.full_name || '');
    setHasChanges(changed);
  }, [fullName, profile?.full_name]);

  const handleSave = async () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateProfile({ full_name: fullName || null });
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        router.back();
      }
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View className="px-5 pt-2 pb-6 flex-row items-center justify-between">
              <Pressable
                onPress={() => router.back()}
                className="flex-row items-center"
              >
                <ChevronLeft size={24} color="#9CA3AF" />
                <Text className="text-textSecondary ml-1">Cancel</Text>
              </Pressable>

              <Text className="text-textPrimary font-semibold text-lg">
                Edit Profile
              </Text>

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className="flex-row items-center"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#00D1A7" />
                ) : (
                  <>
                    <Check size={20} color={hasChanges ? '#00D1A7' : '#6B7280'} />
                    <Text
                      className={`ml-1 font-medium ${hasChanges ? 'text-primary' : 'text-textMuted'}`}
                    >
                      Save
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Avatar */}
            <Animated.View
              entering={FadeInDown.delay(100)}
              className="items-center mb-8"
            >
              <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center mb-3">
                <User size={48} color="#00D1A7" />
              </View>
              <Text className="text-textMuted text-sm">
                Profile photo coming soon
              </Text>
            </Animated.View>

            {/* Form */}
            <Animated.View
              entering={FadeInDown.delay(150)}
              className="px-5"
            >
              {/* Full Name */}
              <View className="mb-6">
                <Text className="text-textSecondary text-sm mb-2 ml-1">
                  Full Name
                </Text>
                <View className="flex-row items-center bg-surface rounded-xl px-4 py-3.5 border border-border">
                  <User size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 ml-3 text-textPrimary text-base"
                    placeholder="Enter your name"
                    placeholderTextColor="#6B7280"
                    autoCapitalize="words"
                    autoComplete="name"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              {/* Email (Read-only) */}
              <View className="mb-6">
                <Text className="text-textSecondary text-sm mb-2 ml-1">
                  Email
                </Text>
                <View className="flex-row items-center bg-surface rounded-xl px-4 py-3.5 border border-border opacity-60">
                  <Mail size={20} color="#6B7280" />
                  <Text className="flex-1 ml-3 text-textMuted text-base">
                    {profile?.email || 'No email'}
                  </Text>
                </View>
                <Text className="text-textMuted text-xs mt-2 ml-1">
                  Email cannot be changed
                </Text>
              </View>
            </Animated.View>

            {/* Account Info */}
            <Animated.View
              entering={FadeInDown.delay(200)}
              className="px-5 mt-auto mb-8"
            >
              <View className="bg-surface rounded-xl p-4">
                <Text className="text-textMuted text-xs mb-2">ACCOUNT STATUS</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-textPrimary font-medium">
                    {profile?.subscription_tier === 'premium' ? 'Premium' : 'Free'}
                  </Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      profile?.subscription_tier === 'premium'
                        ? 'bg-accent/20'
                        : 'bg-surfaceLight'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        profile?.subscription_tier === 'premium'
                          ? 'text-accent'
                          : 'text-textMuted'
                      }`}
                    >
                      {profile?.subscription_tier === 'premium' ? 'Active' : 'All features included'}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
