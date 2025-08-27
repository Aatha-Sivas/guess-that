import React from 'react';
import { Text, Pressable, View } from 'react-native';
import Screen from '../components/Screen';
import { theme } from '../theme';
import { useGame } from '../store/game';

const t = theme('purple');

export default function RoundEnd({ route, navigation }: any) {
  const { scores, currentRound, settings, nextRound, resetAll } = useGame();
  const lastTeamIndex = (route.params?.teamIndex ?? 0) as 0 | 1;

  const isFinal = currentRound >= settings.totalRounds;

  return (
    <Screen style={{  flex: 1, backgroundColor:t.bg, alignItems:'center', justifyContent:'center', padding:20  }}>
      <Text style={{ color: t.text, fontSize: 28, fontWeight: '900' }}>
        {isFinal ? 'Spielende' : 'Rundenende'}
      </Text>
      <View style={{ height: 8 }} />
      <Text style={{ color: t.text, fontSize: 18 }}>Team A: {scores[0]}   •   Team B: {scores[1]}</Text>
      <View style={{ height: 16 }} />

      {isFinal ? (
        <Pressable
          onPress={() => { resetAll(); navigation.replace('Setup'); }}
          style={{ backgroundColor: t.primary, padding: 14, borderRadius: 18 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Neues Spiel</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            nextRound();
            navigation.replace('Cover', { teamIndex: (lastTeamIndex + 1) % 2 });
          }}
          style={{ backgroundColor: t.primary, padding: 14, borderRadius: 18 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Nächste Runde</Text>
        </Pressable>
      )}
    </Screen>
  );
}
