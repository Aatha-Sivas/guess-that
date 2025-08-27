import React, { useEffect, useState } from 'react';
import {
  Text,
  Pressable,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Screen from '../components/Screen';
import { theme } from '../theme';
import { getCount, insertCards } from '../db';
import { drawCards, downloadCards } from '../api';
import type { Difficulty } from '../types';
import { useGame } from '../store/game';

const t = theme('purple');

// current bucket (can be made configurable later)
const LANG = 'de-CH';
const CATEGORY = 'family';
const DIFFICULTY: Difficulty = 'medium';

const MAX_CARDS_PER_REQUEST = 50;

function Stepper({
  label,
  value,
  setValue,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={() => setValue(Math.max(min, value - step))}
          style={{ borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: t.text, fontWeight: '800' }}>−</Text>
        </Pressable>
        <TextInput
          value={String(value)}
          onChangeText={(s) => {
            const count = Number(s.replace(/[^\d]/g, '')) || 0;
            setValue(Math.min(max, Math.max(min, count)));
          }}
          keyboardType="number-pad"
          style={{
            color: t.text,
            borderColor: '#333',
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            minWidth: 90,
            textAlign: 'center',
          }}
        />
        <Pressable
          onPress={() => setValue(Math.min(max, value + step))}
          style={{ borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: t.text, fontWeight: '800' }}>＋</Text>
        </Pressable>
      </View>
      <Text style={{ color: t.muted, marginTop: 4 }}>
        Min {min}, Max {max}
      </Text>
    </View>
  );
}

export default function Setup({ navigation }: any) {
  const { setSettings, startGame, clearUsedTargets, } = useGame();
  const usedCount = useGame((s) => s.usedTargets.size);

  const [localCount, setLocalCount] = useState<number>(0);
  const [nStr, setNStr] = useState<string>('30'); // server fetch size
  const [loadingDraw, setLoadingDraw] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // new: settings UI state
  const [rounds, setRounds] = useState<number>(8);     // 1..20
  const [seconds, setSeconds] = useState<number>(30);  // 30..300

  const refreshCount = async () => {
    const c = await getCount(LANG, CATEGORY, DIFFICULTY);
    setLocalCount(c);
  };

  useEffect(() => {
    refreshCount();
  }, []);

  const parseAmount = () => {
    const count = Math.max(1, Math.min(MAX_CARDS_PER_REQUEST, parseInt(nStr || '0', 10) || 0));
    setNStr(String(count));
    return count;
  };

  const handleAfterInsert = async (before: number) => {
    await refreshCount();
    const after = await getCount(LANG, CATEGORY, DIFFICULTY);
    const added = Math.max(0, after - before);
    setFeedback(added > 0 ? `✅ ${added} neue Karten gespeichert` : 'ℹ️ Keine neuen Karten (bereits vorhanden)');
    await Haptics.notificationAsync(
      added > 0 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
  };

  const onDraw = async () => {
    const count = parseAmount();
    setLoadingDraw(true);
    setFeedback(null);
    try {
      const before = await getCount(LANG, CATEGORY, DIFFICULTY);
      const cards = await drawCards({ lang: LANG, category: CATEGORY, difficulty: DIFFICULTY, count: count });
      await insertCards(cards);
      await handleAfterInsert(before);
    } catch (e: any) {
      Alert.alert('Fehler beim Draw', String(e?.message || e));
    } finally {
      setLoadingDraw(false);
    }
  };

  const onDownload = async () => {
    const count = parseAmount();
    setLoadingDownload(true);
    setFeedback(null);
    try {
      const before = await getCount(LANG, CATEGORY, DIFFICULTY);
      const cards = await downloadCards({ lang: LANG, category: CATEGORY, difficulty: DIFFICULTY, count: count });
      await insertCards(cards);
      await handleAfterInsert(before);
    } catch (e: any) {
      Alert.alert('Fehler beim Download', String(e?.message || e));
    } finally {
      setLoadingDownload(false);
    }
  };

  const onStart = () => {
    // write settings to store, reset game, navigate
    setSettings({ totalRounds: rounds, secondsPerRound: seconds });
    startGame();
    navigation.replace('Cover', { teamIndex: 0 });
  };

  const onClearUsed = () => {
    Alert.alert(
      'Verwendete Zielwörter zurücksetzen',
      `Aktuell markiert: ${usedCount}. Möchtest du sie wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            clearUsedTargets();
            setFeedback('Verwendete Zielwörter wurden zurückgesetzt.');
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginBottom: 6 }}>Schnelleinstellungen</Text>
      <Text style={{ color: t.muted, marginBottom: 12 }}>
        Sprache: {LANG} • Kategorie: {CATEGORY} • Schwierigkeit: {DIFFICULTY}
      </Text>

      {/* NEW: Rounds + Timer steppers */}
      <Stepper label="Runden" value={rounds} setValue={setRounds} min={1} max={20} />
      <Stepper label="Timer (Sekunden)" value={seconds} setValue={setSeconds} min={30} max={300} step={5} />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: t.text, fontWeight: '700' }}>Lokaler Kartenbestand</Text>
        <Text style={{ color: t.muted, marginTop: 0, marginLeft: 12 }}>{localCount} Karten</Text>
        <Pressable
          onPress={refreshCount}
          style={{
            marginLeft: 12,
            borderWidth: 1,
            borderColor: '#444',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: t.text }}>Aktualisieren</Text>
        </Pressable>
      </View>


      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: t.text, marginRight: 10 }}>Anzahl laden (max 50):</Text>
        <TextInput
          value={nStr}
          onChangeText={setNStr}
          keyboardType="number-pad"
          placeholder="z.B. 30"
          placeholderTextColor="#666"
          style={{
            color: t.text,
            borderColor: '#333',
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            minWidth: 90,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Pressable
          onPress={onDraw}
          disabled={loadingDraw}
          style={{
            backgroundColor: loadingDraw ? '#555' : t.primary,
            padding: 14,
            borderRadius: 14,
            flex: 1,
            alignItems: 'center',
          }}
        >
          {loadingDraw ? <ActivityIndicator /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Server: Draw</Text>}
        </Pressable>

        <Pressable
          onPress={onDownload}
          disabled={loadingDownload}
          style={{
            backgroundColor: loadingDownload ? '#555' : t.primaryDark,
            padding: 14,
            borderRadius: 14,
            flex: 1,
            alignItems: 'center',
          }}
        >
          {loadingDownload ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '800' }}>Server: Download</Text>
          )}
        </Pressable>
      </View>

      {feedback ? <Text style={{ color: t.muted, marginTop: 10 }}>{feedback}</Text> : null}

      <View style={{ height: 20 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Pressable
          onPress={onStart}
          style={{ 
            backgroundColor: t.primary, 
            padding: 14, 
            borderRadius: 14,
            flex: 1,
            alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Spiel starten</Text>
        </Pressable>

        <Pressable
          onPress={onClearUsed}
          style={{ 
            backgroundColor: t.danger,
            padding: 14,
            borderRadius: 14, 
            flex: 1,
            alignItems: 'center' }}
        >
         <Text style={{ color: t.text, fontWeight: '700' }}>Zielwörter Zurücksetzen</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
