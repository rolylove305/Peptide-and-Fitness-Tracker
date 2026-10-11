import { useMemo } from 'react';
import { useProgressionRecommendations } from './hooks/useProgressionRecommendations';
import type {
  ProgressionEvidenceSession,
  ProgressionRecommendation,
  ProgressionRecommendationType,
} from './repositories/progressionRepository';

type ProgressionReadiness = 'ready' | 'monitor' | 'recover' | 'learn';
type DataQuality = 'strong' | 'developing' | 'limited';

type ProgressionInsight = {
  recommendation: ProgressionRecommendation;
  readiness: ProgressionReadiness;
  score: number;
  dataQuality: DataQuality;
  nextTarget: string;
  signals: string[];
  priority: number;
};

const typePriority: Record<ProgressionRecommendationType, number> = {
  increase_load: 5,
  increase_reps: 4,
  review_recovery: 3,
  hold: 2,
  insufficient_data: 1,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(
    value,
  );
}

function chronologicalEvidence(
  evidence: ProgressionEvidenceSession[],
): ProgressionEvidenceSession[] {
  return [...evidence].sort(
    (left, right) =>
      new Date(left.performed_at).getTime() -
      new Date(right.performed_at).getTime(),
  );
}

function confidencePoints(
  confidence: ProgressionRecommendation['confidence'],
): number {
  if (confidence === 'high') return 12;
  if (confidence === 'medium') return 5;
  return -5;
}

function baseScore(type: ProgressionRecommendationType): number {
  switch (type) {
    case 'increase_load':
      return 64;
    case 'increase_reps':
      return 58;
    case 'hold':
      return 45;
    case 'review_recovery':
      return 28;
    default:
      return 16;
  }
}

function readinessFor(
  type: ProgressionRecommendationType,
  score: number,
): ProgressionReadiness {
  if (type === 'insufficient_data') return 'learn';
  if (type === 'review_recovery') return 'recover';
  if (score >= 70 && (type === 'increase_load' || type === 'increase_reps'))
    return 'ready';
  return 'monitor';
}

function dataQualityFor(
  recommendation: ProgressionRecommendation,
): DataQuality {
  const rpeSessions = recommendation.evidence.filter(
    (item) => item.average_rpe !== null,
  ).length;
  if (recommendation.sessions_analyzed >= 3 && rpeSessions >= 2)
    return 'strong';
  if (recommendation.sessions_analyzed >= 2) return 'developing';
  return 'limited';
}

function nextTargetFor(recommendation: ProgressionRecommendation): string {
  const minimum = recommendation.target_reps_min;
  const maximum = recommendation.target_reps_max;
  const repRange =
    minimum === null || maximum === null
      ? 'the programmed rep range'
      : minimum === maximum
        ? `${minimum} reps`
        : `${minimum}–${maximum} reps`;

  if (recommendation.recommendation_type === 'increase_load') {
    if (recommendation.latest_weight === null)
      return `Set a repeatable load for ${repRange}`;
    const step = recommendation.weight_unit === 'lb' ? 5 : 2.5;
    return `${formatNumber(recommendation.latest_weight + step)} ${recommendation.weight_unit} · keep ${repRange}`;
  }

  if (recommendation.recommendation_type === 'increase_reps') {
    if (minimum === null || maximum === null)
      return 'Add 1 controlled rep per working set';
    return `${minimum + 1}${minimum === maximum ? '' : `–${maximum + 1}`} reps · keep the current load`;
  }

  if (recommendation.recommendation_type === 'review_recovery') {
    return 'Repeat or reduce stress after reviewing sleep, soreness and technique';
  }

  if (recommendation.recommendation_type === 'hold') {
    return `Repeat ${repRange} and improve consistency or technique`;
  }

  return 'Complete another comparable session before changing the plan';
}

function analyzeRecommendation(
  recommendation: ProgressionRecommendation,
): ProgressionInsight {
  const evidence = chronologicalEvidence(recommendation.evidence);
  const oldest = evidence[0] ?? null;
  const latest = evidence[evidence.length - 1] ?? null;
  const repDelta =
    oldest && latest ? latest.average_reps - oldest.average_reps : 0;
  const loadDelta =
    oldest?.maximum_weight !== null &&
    oldest?.maximum_weight !== undefined &&
    latest?.maximum_weight !== null &&
    latest?.maximum_weight !== undefined
      ? latest.maximum_weight - oldest.maximum_weight
      : null;
  const rpeDelta =
    oldest?.average_rpe !== null &&
    oldest?.average_rpe !== undefined &&
    latest?.average_rpe !== null &&
    latest?.average_rpe !== undefined
      ? latest.average_rpe - oldest.average_rpe
      : null;

  let score = baseScore(recommendation.recommendation_type);
  score += confidencePoints(recommendation.confidence);
  score += Math.min(9, recommendation.sessions_analyzed * 3);
  if (repDelta >= 1) score += 6;
  if (repDelta <= -1) score -= 8;
  if (loadDelta !== null && loadDelta > 0) score += 4;
  if (recommendation.latest_average_rpe !== null) {
    if (recommendation.latest_average_rpe <= 8) score += 7;
    else if (recommendation.latest_average_rpe <= 9) score += 1;
    else score -= 15;
  }
  if (rpeDelta !== null && rpeDelta >= 1) score -= 5;
  if (recommendation.recommendation_type === 'review_recovery')
    score = Math.min(score, 42);
  if (recommendation.recommendation_type === 'insufficient_data')
    score = Math.min(score, 28);
  score = clamp(Math.round(score), 5, 98);

  const signals: string[] = [];
  if (recommendation.sessions_analyzed > 0) {
    signals.push(
      `${recommendation.sessions_analyzed} comparable session${recommendation.sessions_analyzed === 1 ? '' : 's'} analyzed`,
    );
  }
  if (repDelta >= 0.5)
    signals.push(`Average reps improved by ${formatNumber(repDelta)}`);
  else if (repDelta <= -0.5)
    signals.push(
      `Average reps declined by ${formatNumber(Math.abs(repDelta))}`,
    );
  else if (recommendation.sessions_analyzed >= 2)
    signals.push('Average repetitions are stable');

  if (loadDelta !== null && loadDelta > 0) {
    signals.push(
      `Top load increased by ${formatNumber(loadDelta)} ${recommendation.weight_unit}`,
    );
  } else if (loadDelta === 0 && recommendation.sessions_analyzed >= 2) {
    signals.push('Load stayed comparable across sessions');
  }

  if (recommendation.latest_average_rpe === null) {
    signals.push('RPE coverage is missing; confidence is more conservative');
  } else if (recommendation.latest_average_rpe <= 8) {
    signals.push(
      `Latest average effort was controlled at RPE ${formatNumber(recommendation.latest_average_rpe)}`,
    );
  } else if (recommendation.latest_average_rpe > 9) {
    signals.push(
      `Latest average effort was very high at RPE ${formatNumber(recommendation.latest_average_rpe)}`,
    );
  } else {
    signals.push(
      `Latest average effort was RPE ${formatNumber(recommendation.latest_average_rpe)}`,
    );
  }

  return {
    recommendation,
    readiness: readinessFor(recommendation.recommendation_type, score),
    score,
    dataQuality: dataQualityFor(recommendation),
    nextTarget: nextTargetFor(recommendation),
    signals: signals.slice(0, 3),
    priority: typePriority[recommendation.recommendation_type] * 100 + score,
  };
}

function readinessLabel(readiness: ProgressionReadiness): string {
  switch (readiness) {
    case 'ready':
      return 'Ready to review';
    case 'recover':
      return 'Recovery check';
    case 'learn':
      return 'Collect more data';
    default:
      return 'Monitor';
  }
}

function coachHeadline(insights: ProgressionInsight[]): string {
  const ready = insights.filter((item) => item.readiness === 'ready').length;
  const recovery = insights.filter(
    (item) => item.readiness === 'recover',
  ).length;
  if (ready > 0 && recovery === 0) {
    return `${ready} progression ${ready === 1 ? 'opportunity is' : 'opportunities are'} ready for your review.`;
  }
  if (ready > 0 && recovery > 0) {
    return `${ready} progression ${ready === 1 ? 'opportunity' : 'opportunities'} and ${recovery} recovery ${recovery === 1 ? 'signal' : 'signals'} need attention.`;
  }
  if (recovery > 0) {
    return 'Recovery signals should be reviewed before increasing training stress.';
  }
  return 'BioTrack is building a stronger evidence baseline before recommending changes.';
}

function scrollToRecommendations(): void {
  document
    .querySelector<HTMLElement>('.progression-dashboard')
    ?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
}

export function ProgressionCoach() {
  const progression = useProgressionRecommendations();

  const insights = useMemo(
    () =>
      progression.recommendations
        .map(analyzeRecommendation)
        .sort((left, right) => right.priority - left.priority),
    [progression.recommendations],
  );

  const summary = useMemo(() => {
    const ready = insights.filter((item) => item.readiness === 'ready').length;
    const recovery = insights.filter(
      (item) => item.readiness === 'recover',
    ).length;
    const strongEvidence = insights.filter(
      (item) => item.dataQuality === 'strong',
    ).length;
    const rpeCoverage = insights.filter(
      (item) => item.recommendation.latest_average_rpe !== null,
    ).length;
    return { ready, recovery, strongEvidence, rpeCoverage };
  }, [insights]);

  if (progression.status === 'loading') {
    return (
      <section
        className="progression-coach progression-coach--state"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="progression-coach-mark" aria-hidden="true">
          AI
        </div>
        <div>
          <strong>Analyzing progression signals…</strong>
          <span>
            Comparing load, repetitions, effort and session consistency.
          </span>
        </div>
      </section>
    );
  }

  if (progression.status === 'error') return null;

  if (insights.length === 0) {
    return (
      <section className="progression-coach progression-coach--empty">
        <div className="progression-coach-mark" aria-hidden="true">
          AI
        </div>
        <div>
          <p className="eyebrow">Progression AI</p>
          <h2>Training model is still learning</h2>
          <p>
            Complete at least two comparable sessions and record RPE when
            practical. No target will change automatically.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="progression-coach"
      aria-labelledby="progression-coach-heading"
    >
      <header className="progression-coach-header">
        <div className="progression-coach-title">
          <div className="progression-coach-mark" aria-hidden="true">
            AI
          </div>
          <div>
            <p className="eyebrow">Progression AI</p>
            <h2 id="progression-coach-heading">Your next training decisions</h2>
            <p>{coachHeadline(insights)}</p>
          </div>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={scrollToRecommendations}
        >
          Review full evidence
        </button>
      </header>

      <div className="progression-coach-metrics">
        <article>
          <span>Ready to review</span>
          <strong>{summary.ready}</strong>
        </article>
        <article>
          <span>Recovery checks</span>
          <strong>{summary.recovery}</strong>
        </article>
        <article>
          <span>Strong evidence</span>
          <strong>{summary.strongEvidence}</strong>
        </article>
        <article>
          <span>RPE coverage</span>
          <strong>
            {summary.rpeCoverage}/{insights.length}
          </strong>
        </article>
      </div>

      <div className="progression-priority-list">
        {insights.slice(0, 3).map((insight) => (
          <article
            className={`progression-priority-card progression-priority-card--${insight.readiness}`}
            key={`${insight.recommendation.exercise_id}:${insight.recommendation.weight_unit}:${insight.recommendation.target_reps_min}:${insight.recommendation.target_reps_max}`}
          >
            <div
              className="progression-readiness-score"
              aria-label={`${insight.score} out of 100 readiness score`}
            >
              <strong>{insight.score}</strong>
              <span>/100</span>
            </div>
            <div className="progression-priority-content">
              <div className="progression-priority-heading">
                <div>
                  <span>{insight.recommendation.primary_muscle_group}</span>
                  <h3>{insight.recommendation.exercise_name}</h3>
                </div>
                <div className="progression-priority-badges">
                  <span>{readinessLabel(insight.readiness)}</span>
                  <span>{insight.dataQuality} evidence</span>
                </div>
              </div>
              <div className="progression-next-target">
                <span>Suggested next target</span>
                <strong>{insight.nextTarget}</strong>
              </div>
              <ul>
                {insight.signals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <footer className="progression-coach-footer">
        <strong>Approval remains mandatory.</strong>
        <span>
          This layer prioritizes and explains the existing evidence. It never
          edits a routine or replaces recovery judgment.
        </span>
      </footer>
    </section>
  );
}
