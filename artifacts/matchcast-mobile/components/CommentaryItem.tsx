import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import type { CommentaryUpdate } from "@/lib/api";

interface Props {
  item: CommentaryUpdate;
  index: number;
}

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽",
  yellow_card: "🟨",
  red_card: "🟥",
  substitution: "🔄",
  kickoff: "🏁",
  half_time: "🔔",
  full_time: "🏆",
  sponsor: "📢",
  commentary: "💬",
};

export function CommentaryItem({ item, index }: Props) {
  const colors = useColors();

  const isSponsor = item.eventType === "sponsor";
  const isGoal = item.eventType === "goal";
  const icon = EVENT_ICONS[item.eventType] ?? "💬";

  const bgColor = isSponsor
    ? colors.sponsor
    : isGoal
    ? "rgba(245, 158, 11, 0.08)"
    : colors.card;

  const borderColor = isGoal ? colors.gold : colors.border;

  return (
    <Animated.View
      entering={index === 0 ? FadeInDown.duration(300) : undefined}
      style={[styles.card, { backgroundColor: bgColor, borderColor }]}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        {item.minute !== null && (
          <View style={[styles.minuteBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.minuteText, { color: colors.mutedForeground }]}>
              {item.minute}{'\''}

            </Text>
          </View>
        )}
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <Text style={[styles.text, { color: isSponsor ? colors.mutedForeground : colors.foreground }]}>
        {item.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  minuteBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  minuteText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginLeft: "auto",
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
});
