import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  ChevronLeft,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/lib/state/auth-store";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError(null);
    const result = await signUp(email, password);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={["#8B5CF6", "#0D0D0F"]}
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
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
                Create account
              </Text>
              <Text className="text-lg text-white/70 mb-8">
                Start tracking your fitness journey
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

              {/* Name */}
              <View className="mb-4">
                <Text className="text-textSecondary text-sm mb-2">Name</Text>
                <View className="flex-row items-center bg-surfaceLight rounded-xl px-4 py-3">
                  <User size={20} color="#9CA3AF" />
                  <TextInput
                    className="flex-1 ml-3 text-textPrimary text-base"
                    placeholder="Your name"
                    placeholderTextColor="#6B7280"
                    autoCapitalize="words"
                    autoComplete="name"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>

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
              <View className="mb-4">
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

              {/* Confirm Password */}
              <View className="mb-6">
                <Text className="text-textSecondary text-sm mb-2">
                  Confirm Password
                </Text>
                <View className="flex-row items-center bg-surfaceLight rounded-xl px-4 py-3">
                  <Lock size={20} color="#9CA3AF" />
                  <TextInput
                    className="flex-1 ml-3 text-textPrimary text-base"
                    placeholder="••••••••"
                    placeholderTextColor="#6B7280"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>

              {/* Signup Button */}
              <Pressable
                onPress={handleSignup}
                disabled={isLoading}
                className="bg-accent rounded-xl py-4 flex-row items-center justify-center"
                style={{ opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text className="text-white font-semibold text-lg mr-2">
                      Create Account
                    </Text>
                    <ArrowRight size={20} color="#ffffff" />
                  </>
                )}
              </Pressable>
            </Animated.View>

            {/* Terms */}
            <Animated.View entering={FadeInDown.delay(300)} className="mt-6">
              <Text className="text-textMuted text-center text-sm px-4">
                By creating an account, you agree to our Terms of Service and
                Privacy Policy
              </Text>
            </Animated.View>

            {/* Sign In Link */}
            <Animated.View
              entering={FadeInDown.delay(400)}
              className="flex-row justify-center mt-6 pb-8"
            >
              <Text className="text-textSecondary">
                Already have an account?{" "}
              </Text>
              <Pressable onPress={() => router.push("/login")}>
                <Text className="text-primary font-semibold">Sign In</Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
