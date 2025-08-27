// Cover.tsx
import React, { useEffect } from 'react';
import { Text, Pressable } from 'react-native';
import Screen from '../components/Screen';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { theme } from '../theme';

const t = theme('purple');

export default function Cover({ route, navigation }: any) {
  const teamIndex = route.params?.teamIndex ?? 0;
  const team = teamIndex === 0 ? 'Team A' : 'Team B';

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <Screen style={{ flex:1, backgroundColor:t.card, alignItems:'center', justifyContent:'center' }}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(120)}
        style={{ alignItems:'center', gap:14 }}
      >
        <Text style={{ color:t.muted }}>Reiche das Handy an</Text>
        <Text style={{ color:t.text, fontSize:36, fontWeight:'900' }}>{team}</Text>
        <Pressable
          onPress={() => navigation.replace('Turn', { teamIndex })}
          style={{ backgroundColor:t.primary, padding:14, borderRadius:18 }}>
          <Text style={{ color:'#fff', fontWeight:'800' }}>Bereit</Text>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}
