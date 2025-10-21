import React, { useCallback, useState } from 'react';
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
import { Swipeable } from 'react-native-gesture-handler';

import Screen from '../components/Screen';
import { theme } from '../theme';
import type { Card } from '../types';
import { deleteCard, getAllCards } from '../db';

const t = theme('purple');

type ItemProps = {
  item: Card;
  onPress: (card: Card) => void;
  onDelete: (card: Card, close: () => void) => void;
  deleting: boolean;
};

function CardRow({ item, onPress, onDelete, deleting }: ItemProps) {
  const swipeRef = React.useRef<Swipeable | null>(null);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={80}
      overshootRight={false}
      renderRightActions={() => (
        <View
          style={{
            width: 140,
            marginBottom: 12,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: t.danger,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 14,
            padding: 12,
          }}
        >
          <ActivityIndicator color="#fff" style={{ marginBottom: 8 }} animating />
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
            {deleting ? 'Wird gelöscht…' : 'Zum Löschen ziehen'}
          </Text>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === 'right' && !deleting) {
          onDelete(item, () => swipeRef.current?.close());
        }
      }}
    >
      <Pressable
        onPress={() => onPress(item)}
        disabled={deleting}
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
        <Text style={{ color: t.muted, fontSize: 13 }}>
          Sprache: {item.language} • Kategorie: {item.category} • Schwierigkeit: {item.difficulty}
        </Text>
      </Pressable>
    </Swipeable>
  );
}

export default function CardLibrary({ navigation }: any) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    const data = await getAllCards();
    setCards(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      (async () => {
        try {
          const data = await getAllCards();
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCards();
    } finally {
      setRefreshing(false);
    }
  }, [loadCards]);

  const handlePress = useCallback(
    (card: Card) => {
      navigation.navigate('CardDetail', { cardId: card.id });
    },
    [navigation]
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
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', flex: 1 }}>Meine Karten</Text>
        <Pressable
          onPress={() => navigation.navigate('Trash')}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#333',
          }}
        >
          <Text style={{ color: t.text }}>Papierkorb</Text>
        </Pressable>
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
            <CardRow
              item={item}
              onPress={handlePress}
              deleting={deletingId === item.id}
              onDelete={async (card, close) => {
                if (deletingId) {
                  close();
                  return;
                }
                setDeletingId(card.id);
                try {
                  await deleteCard(card.id);
                  await loadCards();
                } catch (e: any) {
                  Alert.alert('Fehler', String(e?.message || e));
                } finally {
                  close();
                  setDeletingId(null);
                }
              }}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: t.muted }}>Keine Karten gefunden.</Text>
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.text} />}
        />
      )}
    </Screen>
  );
}
