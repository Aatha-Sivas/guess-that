import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/Screen';
import { theme } from '../theme';
import type { TrashCard } from '../types';
import { getTrashCards, restoreCard } from '../db';

const t = theme('purple');
const TTL_MS = 60 * 60 * 1000;

type TrashRowProps = {
  item: TrashCard;
  now: number;
  onRestore: (card: TrashCard) => void;
  restoring: boolean;
  disabled: boolean;
};

function TrashRow({ item, now, onRestore, restoring, disabled }: TrashRowProps) {
  const expiresAt = item.deletedAt * 1000 + TTL_MS;
  const remainingMs = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const formatted = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 14,
        backgroundColor: t.card,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#262626',
      }}
    >
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>
        {item.target}
      </Text>
      <Text style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>
        Sprache: {item.language} • Kategorie: {item.category} • Schwierigkeit: {item.difficulty}
      </Text>
      <Text style={{ color: t.warning, fontSize: 12 }}>
        Löscht sich automatisch in {formatted} Minuten
      </Text>
      <Pressable
        onPress={() => onRestore(item)}
        disabled={disabled}
        style={{
          marginTop: 12,
          paddingVertical: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.primary,
          alignItems: 'center',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {restoring ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={t.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: t.primary, fontWeight: '600' }}>Wird wiederhergestellt…</Text>
          </View>
        ) : (
          <Text style={{ color: t.primary, fontWeight: '600' }}>Wiederherstellen</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function Trash({ navigation }: any) {
  const [cards, setCards] = useState<TrashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    const data = await getTrashCards();
    setCards(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      (async () => {
        try {
          const data = await getTrashCards();
          if (active) {
            setCards(data);
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
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCards();
    } finally {
      setRefreshing(false);
    }
  }, [loadCards]);

  const handleRestore = useCallback(
    async (card: TrashCard) => {
      if (restoringId) {
        return;
      }
      setRestoringId(card.id);
      try {
        await restoreCard(card.id);
        await loadCards();
      } catch (e: any) {
        Alert.alert('Fehler', String(e?.message || e));
      } finally {
        setRestoringId(null);
      }
    },
    [loadCards, restoringId]
  );

  return (
    <Screen style={{ flex: 1, backgroundColor: t.bg, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
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
        <Text
          style={{
            color: t.text,
            fontSize: 22,
            fontWeight: '800',
            flex: 1,
          }}
        >
          Papierkorb
        </Text>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>
          Gelöschte Karten bleiben hier für kurze Zeit erhalten. Nach Ablauf der Frist werden sie
          dauerhaft entfernt.
        </Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>Karten werden nach 60 Minuten entfernt.</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrashRow
              item={item}
              now={now}
              onRestore={handleRestore}
              restoring={restoringId === item.id}
              disabled={!!restoringId}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: t.muted }}>Der Papierkorb ist leer.</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.text} />
          }
        />
      )}
    </Screen>
  );
}