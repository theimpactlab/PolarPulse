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
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/lib/state/auth-store";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setError(null);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={["#00D1A7", "#0D0D0F"]}
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
          style={{ paddingTop: insets.top + 60 }}
          className="flex-1 px-6"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text className="text-4xl font-bold text-white mb-2">
              Welcome back
            </Text>
            <Text className="text-lg text-white/70 mb-10">
              Sign in to sync your fitness data
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            className="bg-surface rounded-2xl p-6"
          >
            {error && (
              <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4">
                <Text className="text-red-400 text-center">{error}</Text>
              </View>
            )}

            {/* Email */}
            <View className="mb-4">
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

            {/* Password */}
            <View className="mb-6">
              <Text className="text-textSecondary text-sm mb-2">Password</Text>
              <View className="flex-row items-center bg-surfaceLight rounded-xl px-4 py-3">
                <Lock size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-textPrimary text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#6B7280"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={20} color="#9CA3AF" />
                  ) : (
                    <Eye size={20} color="#9CA3AF" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Forgot Password */}
            <Pressable
              onPress={() => router.push("/forgot-password")}
              className="mb-6"
            >
              <Text className="text-primary text-center">
                Forgot password?
              </Text>
            </Pressable>

            {/* Login Button */}
            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              className="bg-primary rounded-xl py-4 flex-row items-center justify-center"
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#0D0D0F" />
              ) : (
                <>
                  <Text className="text-background font-semibold text-lg mr-2">
                    Sign In
                  </Text>
                  <ArrowRight size={20} color="#0D0D0F" />
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Sign Up Link */}
          <Animated.View
            entering={FadeInDown.delay(300)}
            className="flex-row justify-center mt-6"
          >
            <Text className="text-textSecondary">
              Don&apos;t have an account?{" "}
            </Text>
            <Pressable onPress={() => router.push("/signup")}>
              <Text className="text-primary font-semibold">Sign Up</Text>
            </Pressable>
          </Animated.View>

          {/* Demo Mode */}
          <Animated.View
            entering={FadeInDown.delay(400)}
            className="mt-auto mb-8"
          >
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              className="py-3"
            >
              <Text className="text-textMuted text-center">
                Continue without account (Demo)
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
