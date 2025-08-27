import React from 'react';
import { Text, Pressable } from 'react-native';
import Screen from '../components/Screen';
import { theme } from '../theme';

const t = theme('purple');

export default function Home({ navigation }: any) {
  return (
    <Screen style={{ flex:1, backgroundColor:t.bg, alignItems:'center', justifyContent:'center', padding:24 }}>
      <Text style={{ color: t.text, fontSize: 32, fontWeight: '900', marginBottom: 8 }}>Guess That</Text>
      <Text style={{ color: t.muted, marginBottom: 24 }}>Pass-and-Play • 30s Runden • Familienfreundlich</Text>
      <Pressable onPress={() => navigation.navigate('Setup')}
        style={{ backgroundColor: t.primary, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 18 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Schnelles Spiel</Text>
      </Pressable>
    </Screen>
  );
}
