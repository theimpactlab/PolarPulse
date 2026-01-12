import React from 'react';
import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { Home, Activity, Heart, Moon, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabBarIcon({ Icon, color, focused }: { Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>; color: string; focused: boolean }) {
  return (
    <View className="items-center justify-center">
      <Icon size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // On web (especially iOS Safari), we need to respect the safe area for the home indicator
  const bottomPadding = Platform.OS === 'web'
    ? Math.max(insets.bottom, 20) + 8
    : 28;
  const tabBarHeight = Platform.OS === 'web'
    ? 57 + Math.max(insets.bottom, 20) + 8
    : 85;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D0D0F',
          borderTopColor: '#2E2E33',
          borderTopWidth: 0.5,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarActiveTintColor: '#00D1A7',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Home} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="fitness"
        options={{
          title: 'Fitness',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Activity} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="recovery"
        options={{
          title: 'Recovery',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Heart} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sleep"
        options={{
          title: 'Sleep',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Moon} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon Icon={Settings} color={color} focused={focused} />
          ),
        }}
      />
      {/* Hide the old two screen */}
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
