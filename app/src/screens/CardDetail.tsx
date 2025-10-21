import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import Screen from '../components/Screen';
import { theme } from '../theme';
import type { Card, Difficulty } from '../types';
import { getCardById, updateCard } from '../db';

const t = theme('purple');

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

export default function CardDetail({ navigation, route }: any) {
  const { cardId } = route.params as { cardId: string };
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [target, setTarget] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [forbiddenText, setForbiddenText] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const c = await getCardById(cardId);
        if (c && active) {
          setCard(c);
          setTarget(c.target);
          setLanguage(c.language);
          setCategory(c.category);
          setDifficulty(c.difficulty);
          setForbiddenText(c.forbidden.join('\n'));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [cardId]);

  const forbiddenList = useMemo(
    () =>
      forbiddenText
        .split(/\r?\n/)
        .map((w) => w.trim())
        .filter(Boolean),
    [forbiddenText]
  );

  const onSave = useCallback(async () => {
    if (!card) return;
    if (!target.trim()) {
      Alert.alert('Validierung', 'Das Zielwort darf nicht leer sein.');
      return;
    }

    const normalizedDifficulty = difficulty.trim().toLowerCase();
    if (!difficulties.includes(normalizedDifficulty as Difficulty)) {
      Alert.alert('Validierung', 'Schwierigkeit muss easy, medium oder hard sein.');
      return;
    }

    setSaving(true);
    try {
      await updateCard({
        id: card.id,
        target: target.trim(),
        language: language.trim() || card.language,
        category: category.trim() || card.category,
        difficulty: normalizedDifficulty as Difficulty,
        forbidden: forbiddenList,
      });
      Alert.alert('Gespeichert', 'Die Karte wurde aktualisiert.', [
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
  }, [card, target, language, category, difficulty, forbiddenList, navigation]);

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
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>Kartendetails</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : card ? (
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
              multiline
              numberOfLines={6}
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
              placeholder="Ein Wort pro Zeile"
              placeholderTextColor="#666"
            />
          </View>

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? '#555' : t.primary,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700' }}>Änderungen speichern</Text>
            )}
          </Pressable>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ color: t.muted }}>Die Karte konnte nicht geladen werden.</Text>
        </View>
      )}
    </Screen>
  );
}
