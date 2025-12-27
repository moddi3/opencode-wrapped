import type { WrappedStats, WeekdayActivity, DataSource } from "../types";
import { formatNumber, formatCost, formatDate } from "../utils/format";
import { ActivityHeatmap } from "./heatmap";
import { getProviderLogoUrl } from "../models";
import { colors, typography, spacing, layout, components } from "./design-tokens";

const SOURCE_DISPLAY: Record<DataSource, { name: string; tagline: string }> = {
  opencode: { name: "OpenCode", tagline: "opencode.ai" },
  claude: { name: "Claude Code", tagline: "Anthropic CLI" },
  codex: { name: "Codex", tagline: "OpenAI CLI" },
  pi: { name: "Pi", tagline: "shittycodingagent.ai" },
};

export function WrappedTemplate({ stats }: { stats: WrappedStats }) {
  return (
    <div
      style={{
        width: layout.canvas.width,
        height: layout.canvas.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.background,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.mono,
        paddingLeft: layout.padding.horizontal,
        paddingRight: layout.padding.horizontal,
        paddingTop: layout.padding.top,
        paddingBottom: layout.padding.bottom,
      }}
    >
      <Header year={stats.year} source={stats.source} />

      <div style={{ marginTop: spacing[12], display: "flex", flexDirection: "row", gap: spacing[16], alignItems: "flex-start" }}>
        <HeroStatItem
          label="Started"
          subtitle={formatDate(stats.firstSessionDate)}
          value={`${stats.daysSinceFirstSession} Days Ago`}
        />
        <HeroStatItem
          label="Most Active Day"
          subtitle={stats.weekdayActivity.mostActiveDayName}
          value={stats.mostActiveDay?.formattedDate ?? "N/A"}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: colors.surface,
            borderRadius: layout.radius.lg,
            padding: spacing[8],
          }}
        >
          <span
            style={{
              fontSize: components.sectionHeader.fontSize,
              fontWeight: components.sectionHeader.fontWeight,
              color: components.sectionHeader.color,
              letterSpacing: components.sectionHeader.letterSpacing,
              textTransform: components.sectionHeader.textTransform,
            }}
          >
            Weekly
          </span>
          <WeeklyBarChart weekdayActivity={stats.weekdayActivity} />
        </div>
      </div>

      <Section title="Activity" marginTop={spacing[10]}>
        <ActivityHeatmap dailyActivity={stats.dailyActivity} year={stats.year} maxStreakDays={stats.maxStreakDays} />
      </Section>

      <div
        style={{
          marginTop: spacing[12],
          display: "flex",
          flexDirection: "row",
          gap: spacing[16],
        }}
      >
        <RankingList
          title="Top Models"
          items={stats.topModels.map((m) => ({
            name: m.name,
          }))}
        />
        <RankingList
          title="Providers"
          items={stats.topProviders.map((p) => ({
            name: p.name,
            logoUrl: getProviderLogoUrl(p.id),
          }))}
        />
      </div>

      <StatsGrid stats={stats} />
      <Footer source={stats.source} />
    </div>
  );
}

function Header({ year, source }: { year: number; source: DataSource }) {
  const display = SOURCE_DISPLAY[source];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      <span
        style={{
          fontSize: typography.size["5xl"],
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          lineHeight: typography.lineHeight.none,
        }}
      >
        {display.name}
      </span>

      <span
        style={{
          fontSize: typography.size["3xl"],
          fontWeight: typography.weight.regular,
          color: colors.text.secondary,
          marginTop: spacing[2],
        }}
      >
        wrapped
        <span
          style={{
            fontWeight: typography.weight.bold,
            marginLeft: spacing[4],
          }}
        >
          {year}
        </span>
      </span>
    </div>
  );
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BAR_HEIGHT = 100;
const BAR_WIDTH = 56;
const BAR_GAP = 12;

const HERO_STAT_CONTENT_HEIGHT = BAR_HEIGHT + spacing[2] + 50;

function HeroStatItem({ label, subtitle, value }: { label: string; subtitle?: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: colors.surface,
        borderRadius: layout.radius.lg,
        padding: spacing[8],
        height: HERO_STAT_CONTENT_HEIGHT + spacing[8] * 2,
      }}
    >
      <span
        style={{
          fontSize: components.sectionHeader.fontSize,
          fontWeight: components.sectionHeader.fontWeight,
          color: components.sectionHeader.color,
          letterSpacing: components.sectionHeader.letterSpacing,
          textTransform: components.sectionHeader.textTransform,
        }}
      >
        {label}
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: typography.size['xl'],
            fontWeight: typography.weight.medium,
            color: colors.text.tertiary,
          }}
        >
          {subtitle}
        </span>
      )}
      <span
        style={{
          fontSize: typography.size["4xl"],
          fontWeight: typography.weight.medium,
          color: colors.text.primary,
          lineHeight: typography.lineHeight.none,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function WeeklyBarChart({ weekdayActivity }: { weekdayActivity: WeekdayActivity }) {
  const { counts, mostActiveDay, maxCount } = weekdayActivity;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: BAR_GAP,
          height: BAR_HEIGHT,
        }}
      >
        {counts.map((count, i) => {
          const heightPercent = maxCount > 0 ? count / maxCount : 0;
          const barHeight = Math.max(8, Math.round(heightPercent * BAR_HEIGHT));
          const isHighlighted = i === mostActiveDay;

          return (
            <div
              key={i}
              style={{
                width: BAR_WIDTH,
                height: barHeight,
                backgroundColor: isHighlighted ? colors.accent.primary : colors.heatmap.level2,
                borderRadius: 4,
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: BAR_GAP,
        }}
      >
        {WEEKDAY_LABELS.map((label, i) => {
          const isHighlighted = i === mostActiveDay;
          return (
            <div
              key={i}
              style={{
                width: BAR_WIDTH,
                display: "flex",
                justifyContent: "center",
                fontSize: typography.size.sm,
                fontWeight: isHighlighted ? typography.weight.bold : typography.weight.regular,
                color: isHighlighted ? colors.accent.primary : colors.text.muted,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, marginTop = 0, children }: { title: string; marginTop?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop,
        display: "flex",
        flexDirection: "column",
        gap: spacing[4],
      }}
    >
      <span
        style={{
          fontSize: components.sectionHeader.fontSize,
          fontWeight: components.sectionHeader.fontWeight,
          color: components.sectionHeader.color,
          letterSpacing: components.sectionHeader.letterSpacing,
          textTransform: components.sectionHeader.textTransform,
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

interface RankingItem {
  name: string;
  logoUrl?: string;
}

function RankingList({ title, items }: { title: string; items: RankingItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[5],
        flex: 1,
      }}
    >
      <span
        style={{
          fontSize: components.sectionHeader.fontSize,
          fontWeight: components.sectionHeader.fontWeight,
          color: components.sectionHeader.color,
          letterSpacing: components.sectionHeader.letterSpacing,
          textTransform: components.sectionHeader.textTransform,
        }}
      >
        {title}
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[4],
        }}
      >
        {items.map((item, i) => (
          <RankingItemRow key={i} rank={i + 1} name={item.name} logoUrl={item.logoUrl} />
        ))}
      </div>
    </div>
  );
}

interface RankingItemRowProps {
  rank: number;
  name: string;
  logoUrl?: string;
}

function RankingItemRow({ rank, name, logoUrl }: RankingItemRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[4],
      }}
    >
      <span
        style={{
          fontSize: components.ranking.numberSize,
          fontWeight: typography.weight.bold,
          color: colors.text.tertiary,
          width: components.ranking.numberWidth,
          textAlign: "right",
        }}
      >
        {rank}
      </span>

      {logoUrl && (
        <img
          src={logoUrl}
          width={components.ranking.logoSize}
          height={components.ranking.logoSize}
          style={{
            borderRadius: components.ranking.logoBorderRadius,
            background: "#ffffff",
          }}
        />
      )}

      <span
        style={{
          fontSize: components.ranking.itemSize,
          fontWeight: typography.weight.medium,
          color: colors.text.primary,
        }}
      >
        {name}
      </span>
    </div>
  );
}

function StatsGrid({ stats }: { stats: WrappedStats }) {
  const hasCost = stats.totalCost > 0;

  return (
    <div
      style={{
        marginTop: "auto",
        display: "flex",
        flexDirection: "column",
        gap: spacing[5],
      }}
    >
      {hasCost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>
          <div style={{ display: "flex", gap: spacing[5] }}>
            <StatBox label="Sessions" value={formatNumber(stats.totalSessions)} />
            <StatBox label="Messages" value={formatNumber(stats.totalMessages)} />
            <StatBox label="Total Tokens" value={formatNumber(stats.totalTokens)} />
          </div>

          <div style={{ display: "flex", gap: spacing[5] }}>
            <StatBox label="Projects" value={formatNumber(stats.totalProjects)} />
            <StatBox label="Streak" value={`${stats.maxStreak}d`} />
            <StatBox label="Cost" value={formatCost(stats.totalCost)} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>
          <div style={{ display: "flex", gap: spacing[5] }}>
            <StatBox label="Sessions" value={formatNumber(stats.totalSessions)} />
            <StatBox label="Messages" value={formatNumber(stats.totalMessages)} />
            <StatBox label="Tokens" value={formatNumber(stats.totalTokens)} />
          </div>

          <div style={{ display: "flex", gap: spacing[5] }}>
            <StatBox label="Projects" value={formatNumber(stats.totalProjects)} />
            <StatBox label="Streak" value={`${stats.maxStreak}d`} />
          </div>
        </div>
      )}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
}

function StatBox({ label, value }: StatBoxProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: components.statBox.background,
        paddingTop: components.statBox.padding.y,
        paddingBottom: components.statBox.padding.y,
        paddingLeft: components.statBox.padding.x,
        paddingRight: components.statBox.padding.x,
        gap: components.statBox.gap,
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: components.statBox.borderRadius,
      }}
    >
      <span
        style={{
          fontSize: typography.size.lg,
          fontWeight: typography.weight.medium,
          color: colors.text.tertiary,
          textTransform: "uppercase",
          letterSpacing: typography.letterSpacing.wide,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: typography.size["2xl"],
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          lineHeight: typography.lineHeight.none,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Footer({ source }: { source: DataSource }) {
  const display = SOURCE_DISPLAY[source];

  return (
    <div
      style={{
        marginTop: spacing[12],
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: typography.size.lg,
          fontWeight: typography.weight.medium,
          color: colors.text.muted,
          letterSpacing: typography.letterSpacing.normal,
        }}
      >
        {display.tagline}
      </span>
    </div>
  );
}
