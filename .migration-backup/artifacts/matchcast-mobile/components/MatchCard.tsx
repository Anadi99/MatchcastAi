import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { MatchData } from "@/lib/api";

interface Props {
  match: MatchData;
  active: boolean;
  onPress: () => void;
}

export function MatchCard({ match, active, onPress }: Props) {
  const colors = useColors();

  const isLive = match.status === "live";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {isLive && (
        <View style={[styles.liveBadge, { backgroundColor: colors.live }]}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}
      <Text
        style={[
          styles.teams,
          { color: active ? colors.primaryForeground : colors.foreground },
        ]}
        numberOfLines={1}
      >
        {match.home_team} vs {match.away_team}
      </Text>
      {isLive && (
        <Text
          style={[
            styles.score,
            { color: active ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {match.home_score} – {match.away_score}
        </Text>
      )}
      {match.status === "scheduled" && (
        <Text
          style={[
            styles.time,
            { color: active ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
          ]}
        >
          {new Date(match.kickoff_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      )}
      {match.status === "finished" && (
        <Text
          style={[
            styles.time,
            { color: active ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
          ]}
        >
          FT
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    minWidth: 130,
    gap: 3,
  },
  liveBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginBottom: 2,
  },
  liveText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
  },
  teams: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  score: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
