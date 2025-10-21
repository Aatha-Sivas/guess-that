import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import Screen from '../components/Screen';
import { theme } from '../theme';
import type { Difficulty } from '../types';
import { createCustomCard } from '../db';

const t = theme('purple');
const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

export default function CreateCard({ navigation }: any) {
  const [target, setTarget] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [forbiddenText, setForbiddenText] = useState('');
  const [saving, setSaving] = useState(false);

  const forbiddenList = useMemo(
    () =>
      forbiddenText
        .split(/\r?\n/)
        .map((word) => word.trim())
        .filter(Boolean),
    [forbiddenText]
  );

  const onCreate = useCallback(async () => {
    if (!target.trim()) {
      Alert.alert('Validierung', 'Das Zielwort darf nicht leer sein.');
      return;
    }

    if (!language.trim()) {
      Alert.alert('Validierung', 'Die Sprache darf nicht leer sein.');
      return;
    }

    if (!category.trim()) {
      Alert.alert('Validierung', 'Die Kategorie darf nicht leer sein.');
      return;
    }

    const normalizedDifficulty = difficulty.trim().toLowerCase();
    if (!difficulties.includes(normalizedDifficulty as Difficulty)) {
      Alert.alert('Validierung', 'Schwierigkeit muss easy, medium oder hard sein.');
      return;
    }

    setSaving(true);
    try {
      await createCustomCard({
        target: target.trim(),
        language: language.trim(),
        category: category.trim(),
        difficulty: normalizedDifficulty as Difficulty,
        forbidden: forbiddenList,
      });

      Alert.alert('Gespeichert', 'Die Karte wurde erstellt.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Fehler', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [target, language, category, difficulty, forbiddenList, navigation]);

  return (
    <Screen style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 0 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#333',
            marginRight: 12,
          }}
        >
          <Text style={{ color: t.text }}>Zurück</Text>
        </Pressable>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>Neue Karte</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16 }}>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>Zielwort</Text>
          <TextInput
            value={target}
            onChangeText={setTarget}
            style={{
              backgroundColor: t.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#333',
              color: t.text,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>Sprache</Text>
          <TextInput
            value={language}
            onChangeText={setLanguage}
            autoCapitalize="none"
            style={{
              backgroundColor: t.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#333',
              color: t.text,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>Kategorie</Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            autoCapitalize="none"
            style={{
              backgroundColor: t.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#333',
              color: t.text,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>Schwierigkeit</Text>
          <TextInput
            value={difficulty}
            onChangeText={(value) => setDifficulty(value as Difficulty)}
            autoCapitalize="none"
            style={{
              backgroundColor: t.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#333',
              color: t.text,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
            placeholder="easy | medium | hard"
            placeholderTextColor="#666"
          />
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Nur easy, medium oder hard sind erlaubt.</Text>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>Tabuwörter (je Zeile eines)</Text>
          <TextInput
            value={forbiddenText}
            onChangeText={setForbiddenText}
            style={{
              backgroundColor: t.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#333',
              color: t.text,
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 140,
              textAlignVertical: 'top',
            }}
            multiline
            placeholder="optional"
            placeholderTextColor="#666"
          />
        </View>

        <Pressable
          onPress={onCreate}
          disabled={saving}
          style={{
            backgroundColor: saving ? '#555' : t.primary,
            padding: 16,
            borderRadius: 14,
            alignItems: 'center',
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '800' }}>Karte erstellen</Text>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}