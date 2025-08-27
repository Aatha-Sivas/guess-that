import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import Screen from '../components/Screen';
import { theme } from '../theme';
import { useGame } from '../store/game';
import { drawForTurn } from '../repo/CardRepository';

const t = theme('purple');

export default function Turn({ route, navigation }: any) {
  const teamIndex = (route.params?.teamIndex ?? 0) as 0 | 1;
  const { scores, currentCard, setCards, correct, skip, settings, currentRound } = useGame();
  const [timeLeft, setTimeLeft] = useState(settings.secondsPerRound);

  useEffect(() => {
    (async () => {
      const cards = await drawForTurn(100);
      setCards(cards);
    })();
  }, [setCards]);

  const retried = useRef(false);
  useEffect(() => {
    if (!currentCard && !retried.current) {
      retried.current = true;
      (async () => {
        const more = await drawForTurn(100);
        setCards(more);
      })();
    }
  }, [currentCard, setCards]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timer.current = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, []);
  useEffect(() => {
    if (timeLeft <= 0) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      navigation.replace('RoundEnd', { teamIndex });
    }
  }, [timeLeft, navigation, teamIndex]);

  const forbidden = currentCard?.forbidden ?? [];

  return (
    <Screen style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: t.text, fontWeight: '800' }}>{teamIndex === 0 ? 'Team A' : 'Team B'}</Text>
        <Text style={{ color: t.text }}>⏱ {timeLeft}s</Text>
        <Text style={{ color: t.text }}>Runde {currentRound}/{settings.totalRounds}</Text>
      </View>

      <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 24, padding: 20 }}>
        <Text style={{ color: t.text, fontSize: 50, fontWeight: '900', textAlign: 'center' }}>
          {currentCard?.target ?? 'Lade Karten…'}
        </Text>
        <FlatList
          style={{ marginTop: 60 }}
          data={forbidden}
          keyExtractor={(w, i) => w + i}
          renderItem={({ item }) => (
            <Text style={{ color: t.muted, fontSize: 30, marginVertical: 20, alignSelf: 'center'}}>{item}</Text>
          )}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginTop: 14 }}>
        <Pressable onPress={skip} style={{ backgroundColor: t.danger, padding: 14, borderRadius: 16 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Tabu/Pass</Text>
        </Pressable>
        <Pressable onPress={correct} style={{ backgroundColor: t.success, padding: 14, borderRadius: 16 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Richtig</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.replace('Cover', { teamIndex: (teamIndex + 1) % 2 })}
          style={{ borderWidth: 1, borderColor: '#444', padding: 14, borderRadius: 16 }}
        >
          <Text style={{ color: t.text, fontWeight: '700' }}>Weitergeben</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
