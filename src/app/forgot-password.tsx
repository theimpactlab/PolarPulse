import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Mail, ArrowRight, ChevronLeft, CheckCircle } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/lib/state/auth-store";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!email) {
      setError("Please enter your email");
      return;
    }

    setError(null);
    setIsLoading(true);

    const result = await resetPassword(email);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={["#3B82F6", "#0D0D0F"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 300,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          style={{ paddingTop: insets.top + 20 }}
          className="flex-1 px-6"
        >
          {/* Back Button */}
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center mb-6"
          >
            <ChevronLeft size={24} color="white" />
            <Text className="text-white ml-1">Back</Text>
          </Pressable>

          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text className="text-4xl font-bold text-white mb-2">
              Reset password
            </Text>
            <Text className="text-lg text-white/70 mb-10">
              We&apos;ll send you a link to reset it
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            className="bg-surface rounded-2xl p-6"
          >
            {success ? (
              <View className="items-center py-4">
                <CheckCircle size={48} color="#00D1A7" />
                <Text className="text-xl font-semibold text-textPrimary mt-4 text-center">
                  Check your email
                </Text>
                <Text className="text-textSecondary text-center mt-2">
                  We&apos;ve sent a password reset link to {email}
                </Text>
                <Pressable
                  onPress={() => router.push("/login")}
                  className="bg-primary rounded-xl py-4 px-8 mt-6"
                >
                  <Text className="text-background font-semibold text-lg">
                    Back to Login
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                {error && (
                  <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4">
                    <Text className="text-red-400 text-center">{error}</Text>
                  </View>
                )}

                {/* Email */}
                <View className="mb-6">
                  <Text className="text-textSecondary text-sm mb-2">Email</Text>
                  <View className="flex-row items-center bg-surfaceLight rounded-xl px-4 py-3">
                    <Mail size={20} color="#9CA3AF" />
                    <TextInput
                      className="flex-1 ml-3 text-textPrimary text-base"
                      placeholder="your@email.com"
                      placeholderTextColor="#6B7280"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                </View>

                {/* Reset Button */}
                <Pressable
                  onPress={handleReset}
                  disabled={isLoading}
                  className="bg-primary rounded-xl py-4 flex-row items-center justify-center"
                  style={{ opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#0D0D0F" />
                  ) : (
                    <>
                      <Text className="text-background font-semibold text-lg mr-2">
                        Send Reset Link
                      </Text>
                      <ArrowRight size={20} color="#0D0D0F" />
                    </>
                  )}
                </Pressable>
              </>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
