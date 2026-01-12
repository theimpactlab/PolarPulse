import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { polarOAuthService } from '@/lib/services/polar-oauth';
import { useAppStore } from '@/lib/state/app-store';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function PolarCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ polar?: string; error?: string; code?: string }>();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Get store actions
  const setIsPolarConnected = useAppStore((s) => s.connectPolar);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // On web, read from URL params
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const result = polarOAuthService.handleWebCallback(urlParams);

        // Clear the pending state
        polarOAuthService.clearPendingOAuth();

        if (result.success) {
          setStatus('success');
          // Update store to reflect connection
          // Note: The actual token is stored server-side in Supabase
          // We just need to mark as connected locally
          useAppStore.setState({ isPolarConnected: true, isDemoMode: false });

          // Redirect to settings after a short delay
          setTimeout(() => {
            router.replace('/(tabs)/settings');
          }, 2000);
        } else {
          setStatus('error');
          setErrorMessage(result.error || 'Connection failed');

          // Redirect to settings after showing error
          setTimeout(() => {
            router.replace('/(tabs)/settings');
          }, 3000);
        }
      } else {
        // On native, check params passed via deep link
        if (params.error) {
          setStatus('error');
          setErrorMessage(getErrorMessage(params.error));
        } else if (params.polar === 'connected' || params.code) {
          setStatus('success');
          useAppStore.setState({ isPolarConnected: true, isDemoMode: false });
        } else {
          setStatus('error');
          setErrorMessage('Authorization failed');
        }

        // Redirect to settings
        setTimeout(() => {
          router.replace('/(tabs)/settings');
        }, 2000);
      }
    } catch (err) {
      console.error('Callback error:', err);
      setStatus('error');
      setErrorMessage('An unexpected error occurred');

      setTimeout(() => {
        router.replace('/(tabs)/settings');
      }, 3000);
    }
  };

  const getErrorMessage = (code: string): string => {
    switch (code) {
      case 'oauth_denied':
        return 'You denied access to Polar. Please try again if you want to connect.';
      case 'token_exchange':
        return 'Failed to complete authorization. Please try again.';
      case 'invalid_state':
        return 'Security error. Please try again.';
      default:
        return 'Failed to connect to Polar. Please try again.';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        {status === 'processing' && (
          <>
            <ActivityIndicator size="large" color="#00D1A7" />
            <Text className="text-textPrimary text-xl font-semibold mt-6">
              Connecting to Polar...
            </Text>
            <Text className="text-textMuted text-center mt-2">
              Please wait while we complete the authorization
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center">
              <CheckCircle size={48} color="#00D1A7" />
            </View>
            <Text className="text-textPrimary text-xl font-semibold mt-6">
              Successfully Connected!
            </Text>
            <Text className="text-textMuted text-center mt-2">
              Your Polar account is now linked. Redirecting to settings...
            </Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View className="w-20 h-20 rounded-full bg-red-500/20 items-center justify-center">
              <XCircle size={48} color="#FF4757" />
            </View>
            <Text className="text-textPrimary text-xl font-semibold mt-6">
              Connection Failed
            </Text>
            <Text className="text-textMuted text-center mt-2">
              {errorMessage}
            </Text>
            <Text className="text-textMuted text-center mt-4 text-sm">
              Redirecting to settings...
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
