import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { MatchCard } from "@/components/MatchCard";
import { ScoreCard } from "@/components/ScoreCard";
import { LanguagePicker } from "@/components/LanguagePicker";
import { CommentaryItem } from "@/components/CommentaryItem";
import { fetchMatches, fetchCommentary } from "@/lib/api";
import type { MatchData, CommentaryUpdate } from "@/lib/api";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [activeMatchId, setActiveMatchId] = useState<string>("");
  const [language, setLanguage] = useState("hi");

  const {
    data: matches = [],
    isLoading: matchesLoading,
    refetch: refetchMatches,
    isRefetching,
  } = useQuery<MatchData[]>({
    queryKey: ["matches"],
    queryFn: async () => {
      const data = await fetchMatches();
      return data;
    },
    refetchInterval: 30_000,
  });

  // Auto-select first live match (or first match) when matches load
  React.useEffect(() => {
    if (matches.length > 0 && !activeMatchId) {
      const live = matches.find((m) => m.status === "live");
      setActiveMatchId((live ?? matches[0]).id);
    }
  }, [matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? matches[0];

  const { data: commentary = [], isLoading: commentaryLoading } = useQuery<
    CommentaryUpdate[]
  >({
    queryKey: ["commentary", activeMatchId, language],
    queryFn: () => fetchCommentary(activeMatchId, language),
    enabled: !!activeMatchId,
    refetchInterval: 5_000,
  });

  const onRefresh = useCallback(() => {
    refetchMatches();
  }, [refetchMatches]);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  if (matchesLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Loading matches…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + webTopPad + 12,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Ionicons name="trophy" size={22} color={colors.gold} />
          <Text style={[styles.appName, { color: colors.foreground }]}>
            MatchCast AI
          </Text>
        </View>
      </View>

      {/* Language picker */}
      <LanguagePicker selected={language} onSelect={setLanguage} />

      {/* Match selector */}
      {matches.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.matchRowContent}
          style={styles.matchScroll}
        >
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              active={m.id === activeMatchId}
              onPress={() => setActiveMatchId(m.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noMatchContainer}>
          <Ionicons name="football-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.noMatchTitle, { color: colors.foreground }]}>
            No matches today
          </Text>
          <Text style={[styles.noMatchSub, { color: colors.mutedForeground }]}>
            Check back before the next fixture.
          </Text>
        </View>
      )}

      {/* Commentary feed */}
      {matches.length > 0 && (
        <FlatList
          data={commentary}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <CommentaryItem item={item} index={index} />
          )}
          contentContainerStyle={[
            styles.feedContent,
            { paddingBottom: insets.bottom + webBottomPad + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!commentary.length}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            activeMatch ? (
              <>
                <ScoreCard match={activeMatch} />
                <View style={[styles.feedHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.feedTitle, { color: colors.mutedForeground }]}>
                    Live Commentary
                  </Text>
                </View>
              </>
            ) : null
          }
          ListEmptyComponent={
            commentaryLoading && activeMatchId ? (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyFeed}>
                <Ionicons name="time-outline" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Waiting for match events…
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  matchScroll: {
    flexGrow: 0,
  },
  matchRowContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noMatchContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  noMatchTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  noMatchSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  feedContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  feedHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  feedTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  emptyFeed: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
