import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MATCHES_URL } from '../config';
import { FavoriteButton } from '../components/FavoriteButton';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { useFavorites } from '../hooks/useFavorites';

type Team = {
  id: string;
  name: string;
  city: string;
};

type Match = {
  id: string;
  startsAt: string | null;
  status: string;
  minute?: number;
  home: Team;
  away: Team;
  score: {
    home: number;
    away: number;
  } | null;
};

type MatchesResponse = {
  round: number;
  matches: Match[];
};

type Filter = 'all' | 'upcoming' | 'finished';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'Все', value: 'all' },
  { label: 'Предстоящие', value: 'upcoming' },
  { label: 'Завершённые', value: 'finished' },
];

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Предстоящий',
  finished: 'Завершён',
  live: 'Идёт',
  postponed: 'Перенесён',
};

function formatDate(value: string | null): string {
  if (!value) return 'Дата уточняется';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Дата уточняется';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStatusLabel(match: Match): string {
  const label = STATUS_LABELS[match.status] ?? 'Статус неизвестен';

  if (match.status === 'live' && match.minute != null) {
    return `${label} · ${match.minute}′`;
  }

  return label;
}

function MatchCard({
  match,
  isFavorite,
  onToggleFavorite,
}: {
  match: Match;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.date}>{formatDate(match.startsAt)}</Text>
        <FavoriteButton
          active={isFavorite}
          onPress={onToggleFavorite}
        />
      </View>

      <View style={styles.teams}>
        <View style={styles.team}>
          <Text style={styles.teamName}>{match.home.name}</Text>
          <Text style={styles.city}>{match.home.city}</Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.score}>
            {match.score
              ? `${match.score.home} : ${match.score.away}`
              : '— : —'}
          </Text>
        </View>

        <View style={[styles.team, styles.awayTeam]}>
          <Text style={styles.teamName}>{match.away.name}</Text>
          <Text style={styles.city}>{match.away.city}</Text>
        </View>
      </View>

      <Text
        style={[
          styles.status,
          match.status === 'live' && styles.liveStatus,
        ]}
      >
        {getStatusLabel(match)}
      </Text>
    </View>
  );
}

// Экран «Матчи тура» — задание в README.md, часть 1.
export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [round, setRound] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isFavorite, toggle } = useFavorites();

  const loadMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch(MATCHES_URL);

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data: MatchesResponse = await response.json();

      if (!data || !Array.isArray(data.matches)) {
        throw new Error('Сервер вернул некорректные данные');
      }

      setMatches(data.matches);
      setRound(data.round ?? null);
      setUpdatedAt(new Date());
    } catch {
      setError('Не удалось загрузить матчи. Проверьте соединение и попробуйте снова.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const filteredMatches = matches.filter((match) => {
    if (filter === 'upcoming') return match.status === 'scheduled';
    if (filter === 'finished') return match.status === 'finished';
    return true;
  });

  if (loading && matches.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.muted}>Загружаем матчи...</Text>
      </View>
    );
  }

  if (error && matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void loadMatches()}
        >
          <Text style={styles.primaryButtonText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>Матчи тура</Text>
          {round != null && (
            <Text style={styles.muted}>Тур {round}</Text>
          )}
        </View>

        <Pressable
          style={styles.refreshButton}
          onPress={() => void loadMatches(true)}
          disabled={refreshing}
        >
          <Text style={styles.refreshText}>
            {refreshing ? 'Обновление...' : 'Обновить'}
          </Text>
        </Pressable>
      </View>

      {updatedAt && <UpdatedAgo since={updatedAt} />}

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setFilter(item.value)}
            style={[
              styles.filterButton,
              filter === item.value && styles.activeFilter,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.value && styles.activeFilterText,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <Pressable
          style={styles.errorBanner}
          onPress={() => void loadMatches(true)}
        >
          <Text style={styles.error}>{error} Нажмите, чтобы повторить.</Text>
        </Pressable>
      )}

      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            isFavorite={isFavorite(item.id)}
            onToggleFavorite={() => toggle(item.id)}
          />
        )}
        contentContainerStyle={
          filteredMatches.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMatches(true)}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {matches.length === 0
              ? 'Матчей пока нет'
              : 'В этой категории матчей нет'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  muted: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
  },
  refreshText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  activeFilter: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 12,
    color: '#374151',
  },
  activeFilterText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: '#6b7280',
    flexShrink: 1,
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  team: {
    flex: 1,
  },
  awayTeam: {
    alignItems: 'flex-end',
  },
  teamName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  city: {
    marginTop: 3,
    fontSize: 12,
    color: '#9ca3af',
  },
  scoreContainer: {
    paddingHorizontal: 12,
  },
  score: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  status: {
    marginTop: 12,
    fontSize: 13,
    color: '#6b7280',
  },
  liveStatus: {
    color: '#dc2626',
    fontWeight: '700',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
  errorBanner: {
    padding: 10,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

