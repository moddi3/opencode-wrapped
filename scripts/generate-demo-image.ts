#!/usr/bin/env bun

import { generateImage } from "../src/image/generator";
import type { OpenCodeStats } from "../src/types";
import { join } from "node:path";

// Generate realistic sample data
function generateDemoStats(): OpenCodeStats {
  const year = 2025;

  // Generate daily activity data for the whole year
  const dailyActivity = new Map<string, number>();
  const startDate = new Date(year, 6, 1);
  const endDate = new Date(year, 11, 31);

  // Create realistic activity patterns
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = d.getDay();

    // Higher activity on weekdays
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const baseChance = isWeekday ? 0.75 : 0.4;

    if (Math.random() < baseChance) {
      // Generate activity count with realistic distribution
      const count = Math.floor(Math.random() * 25) + 1;
      dailyActivity.set(dateStr, count);
    }
  }

  // Create a streak period (highlight these days)
  const maxStreakDays = new Set<string>();
  const streakStart = new Date(year, 9, 1); // October
  for (let i = 0; i < 21; i++) {
    const d = new Date(streakStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    maxStreakDays.add(dateStr);
  }

  // Weekday activity distribution
  const weekdayCounts: [number, number, number, number, number, number, number] = [
    142, // Sunday
    287, // Monday
    312, // Tuesday
    298, // Wednesday
    305, // Thursday
    276, // Friday
    168, // Saturday
  ];

  const maxWeekdayCount = Math.max(...weekdayCounts);
  const mostActiveWeekday = weekdayCounts.indexOf(maxWeekdayCount);
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return {
    year,
    firstSessionDate: startDate,
    daysSinceFirstSession: Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),

    totalSessions: 1247,
    totalMessages: 18934,
    totalProjects: 23,

    totalInputTokens: 45_200_000,
    totalOutputTokens: 12_800_000,
    totalTokens: 58_000_000,

    totalCost: 127.45,
    hasZenUsage: true,

    topModels: [
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", providerId: "anthropic", count: 4521, percentage: 50.6 },
      { id: "gpt-4o", name: "GPT-4o", providerId: "openai", count: 2134, percentage: 23.9 },
      { id: "claude-opus-4", name: "Claude Opus 4", providerId: "anthropic", count: 1289, percentage: 14.4 },
    ],

    topProviders: [
      { id: "anthropic", name: "Anthropic", count: 5810, percentage: 65.0 },
      { id: "openai", name: "OpenAI", count: 2134, percentage: 23.9 },
      { id: "google", name: "Google", count: 990, percentage: 11.1 },
    ],

    maxStreak: 21,
    currentStreak: 8,
    maxStreakDays,

    dailyActivity,

    mostActiveDay: {
      date: "2025-10-15",
      count: 47,
      formattedDate: "Oct 15",
    },

    weekdayActivity: {
      counts: weekdayCounts,
      mostActiveDay: mostActiveWeekday,
      mostActiveDayName: weekdayNames[mostActiveWeekday],
      maxCount: maxWeekdayCount,
    },
  };
}

async function main() {
  console.log("Generating demo wrapped image...");

  const stats = generateDemoStats();
  const image = await generateImage(stats);

  const outputPath = join(import.meta.dir, "..", "assets", "images", "demo-wrapped.png");
  await Bun.write(outputPath, image.fullSize);

  console.log(`Demo image saved to: ${outputPath}`);
}

main().catch(console.error);
