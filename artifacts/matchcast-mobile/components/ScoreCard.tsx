import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { MatchData } from "@/lib/api";

interface Props {
  match: MatchData;
}

export function ScoreCard({ match }: Props) {
  const colors = useColors();

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statusRow}>
        {isLive ? (
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
            <Text style={[styles.statusText, { color: colors.live }]}>LIVE</Text>
          </View>
        ) : isFinished ? (
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>FULL TIME</Text>
        ) : (
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {new Date(match.kickoff_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>

      <View style={styles.scoreRow}>
        <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>
          {match.home_team}
        </Text>

        <View style={styles.scoreBox}>
          <Text style={[styles.score, { color: colors.foreground }]}>
            {isLive || isFinished ? `${match.home_score}` : "–"}
          </Text>
          <Text style={[styles.separator, { color: colors.mutedForeground }]}> : </Text>
          <Text style={[styles.score, { color: colors.foreground }]}>
            {isLive || isFinished ? `${match.away_score}` : "–"}
          </Text>
        </View>

        <Text
          style={[styles.teamName, { color: colors.foreground, textAlign: "right" }]}
          numberOfLines={2}
        >
          {match.away_team}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  statusRow: {
    alignItems: "center",
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  score: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  separator: {
    fontSize: 28,
    fontFamily: "Inter_400Regular",
  },
});
