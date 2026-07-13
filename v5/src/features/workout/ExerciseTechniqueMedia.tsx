import { useEffect, useState } from 'react';
import type { Exercise } from '../../types/database';

type DemoPattern =
  | 'squat'
  | 'lunge'
  | 'press'
  | 'vertical-pull'
  | 'row'
  | 'hinge'
  | 'bridge'
  | 'dead-bug'
  | 'leg-press'
  | 'leg-curl'
  | 'leg-extension'
  | 'lateral-raise'
  | 'calf-raise'
  | 'fly'
  | 'face-pull'
  | 'pushdown'
  | 'curl'
  | 'crunch';

type DemoDefinition = {
  pattern: DemoPattern;
  cue: string;
  avoid: string;
  direction: string;
};

type Point = [number, number];

type Pose = {
  head: Point;
  neck: Point;
  hip: Point;
  leftElbow: Point;
  leftHand: Point;
  rightElbow: Point;
  rightHand: Point;
  leftKnee: Point;
  leftFoot: Point;
  rightKnee: Point;
  rightFoot: Point;
};

const exerciseDemoCatalog: Record<string, DemoDefinition> = {
  'goblet-squat': {
    pattern: 'squat',
    cue: 'Keep the weight close, brace the trunk and drive the floor away.',
    avoid: 'Do not let the knees collapse inward or the heels lift.',
    direction: 'Lower under control, then stand tall.',
  },
  'walking-lunge': {
    pattern: 'lunge',
    cue: 'Take a stable step and lower both knees while keeping the front foot planted.',
    avoid: 'Do not slam the back knee or lose balance through the front foot.',
    direction: 'Step, lower and push through the front leg.',
  },
  'incline-dumbbell-press': {
    pattern: 'press',
    cue: 'Keep the shoulder blades supported and press the dumbbells over the upper chest.',
    avoid: 'Do not flare the elbows straight out or bounce at the bottom.',
    direction: 'Lower to a comfortable depth, then press smoothly.',
  },
  'push-up': {
    pattern: 'press',
    cue: 'Maintain one straight line from head to heels and press the floor away.',
    avoid: 'Do not let the hips sag or the shoulders shrug toward the ears.',
    direction: 'Lower the chest under control, then fully press away.',
  },
  'lat-pulldown': {
    pattern: 'vertical-pull',
    cue: 'Set the shoulders down and pull the bar toward the upper chest.',
    avoid: 'Do not swing backward or pull the bar behind the neck.',
    direction: 'Reach overhead, then pull elbows down.',
  },
  'seated-cable-row': {
    pattern: 'row',
    cue: 'Stay tall and pull the handle toward the lower ribs with the elbows close.',
    avoid: 'Do not round the back or turn the movement into a body swing.',
    direction: 'Reach forward with control, then row to the torso.',
  },
  'single-arm-dumbbell-row': {
    pattern: 'row',
    cue: 'Keep the torso stable and pull the elbow toward the hip.',
    avoid: 'Do not twist the trunk or shrug the working shoulder.',
    direction: 'Let the arm lengthen, then row without rotating.',
  },
  'romanian-deadlift': {
    pattern: 'hinge',
    cue: 'Push the hips back while keeping the load close to the legs.',
    avoid: 'Do not turn it into a squat or round the lower back.',
    direction: 'Hinge until the hamstrings load, then stand by driving the hips forward.',
  },
  'glute-bridge': {
    pattern: 'bridge',
    cue: 'Brace the ribs down and squeeze the glutes to lift the hips.',
    avoid: 'Do not overarch the lower back at the top.',
    direction: 'Lift the hips until the trunk and thighs align.',
  },
  'barbell-hip-thrust': {
    pattern: 'bridge',
    cue: 'Keep the chin tucked and finish with the glutes, not the lower back.',
    avoid: 'Do not hyperextend at the top or let the knees collapse inward.',
    direction: 'Lower the hips under control, then drive upward.',
  },
  'dead-bug': {
    pattern: 'dead-bug',
    cue: 'Press the lower back gently into the floor while extending opposite limbs.',
    avoid: 'Do not let the ribs flare or the lower back lift.',
    direction: 'Extend slowly, return and alternate sides.',
  },
  'leg-press': {
    pattern: 'leg-press',
    cue: 'Keep the whole foot planted and lower until the pelvis remains stable.',
    avoid: 'Do not lock the knees hard or let the lower back roll off the pad.',
    direction: 'Lower the platform with control, then press through the feet.',
  },
  'seated-leg-curl': {
    pattern: 'leg-curl',
    cue: 'Keep the hips against the pad and curl the heels back smoothly.',
    avoid: 'Do not lift the hips or use momentum.',
    direction: 'Straighten under control, then curl through the hamstrings.',
  },
  'leg-extension': {
    pattern: 'leg-extension',
    cue: 'Keep the hips down and extend the knees without swinging.',
    avoid: 'Do not slam into lockout or use a load that changes your posture.',
    direction: 'Lift the pad smoothly, pause and lower with control.',
  },
  'dumbbell-lateral-raise': {
    pattern: 'lateral-raise',
    cue: 'Lead with the elbows and raise only to a comfortable shoulder height.',
    avoid: 'Do not shrug or swing the dumbbells upward.',
    direction: 'Raise out to the sides, then lower slowly.',
  },
  'standing-calf-raise': {
    pattern: 'calf-raise',
    cue: 'Rise through the balls of the feet and pause at the top.',
    avoid: 'Do not bounce or roll the ankles outward.',
    direction: 'Lower the heels fully, then rise as high as control allows.',
  },
  'cable-chest-fly': {
    pattern: 'fly',
    cue: 'Keep a soft elbow bend and bring the hands together in a wide arc.',
    avoid: 'Do not turn the movement into a press or overstretch the shoulders.',
    direction: 'Open with control, then sweep the arms forward.',
  },
  'face-pull': {
    pattern: 'face-pull',
    cue: 'Pull toward eye level and separate the hands as the elbows move back.',
    avoid: 'Do not lean backward or shrug the shoulders.',
    direction: 'Reach forward, then pull toward the face.',
  },
  'triceps-pushdown': {
    pattern: 'pushdown',
    cue: 'Pin the upper arms beside the torso and straighten only at the elbows.',
    avoid: 'Do not rock the body or let the elbows drift forward.',
    direction: 'Control the return, then press the handle down.',
  },
  'overhead-triceps-extension': {
    pattern: 'pushdown',
    cue: 'Keep the upper arms steady and extend through the elbows.',
    avoid: 'Do not flare the ribs or move the shoulders excessively.',
    direction: 'Bend the elbows under control, then fully extend.',
  },
  'hammer-curl': {
    pattern: 'curl',
    cue: 'Keep the palms facing inward and curl without moving the upper arms.',
    avoid: 'Do not swing the torso or let the elbows travel forward.',
    direction: 'Lower fully, then curl with steady elbows.',
  },
  'barbell-curl': {
    pattern: 'curl',
    cue: 'Stand tall and curl the bar while keeping the elbows close to the body.',
    avoid: 'Do not lean backward or shorten the lowering phase.',
    direction: 'Curl without swinging, then lower slowly.',
  },
  'cable-crunch': {
    pattern: 'crunch',
    cue: 'Bring the ribs toward the pelvis while keeping the hips mostly still.',
    avoid: 'Do not pull only with the arms or sit the hips backward.',
    direction: 'Round through the trunk, pause and return under control.',
  },
};

function poseFor(pattern: DemoPattern, phase: 'start' | 'finish'): Pose {
  const standing: Pose = {
    head: [150, 42], neck: [150, 66], hip: [150, 132],
    leftElbow: [126, 92], leftHand: [122, 130], rightElbow: [174, 92], rightHand: [178, 130],
    leftKnee: [138, 178], leftFoot: [128, 220], rightKnee: [162, 178], rightFoot: [172, 220],
  };

  switch (pattern) {
    case 'squat':
      return phase === 'start' ? standing : {
        head: [150, 62], neck: [150, 84], hip: [150, 146],
        leftElbow: [126, 108], leftHand: [139, 119], rightElbow: [174, 108], rightHand: [161, 119],
        leftKnee: [120, 174], leftFoot: [104, 218], rightKnee: [180, 174], rightFoot: [196, 218],
      };
    case 'lunge':
      return phase === 'start' ? standing : {
        head: [150, 48], neck: [150, 70], hip: [150, 134],
        leftElbow: [128, 96], leftHand: [126, 134], rightElbow: [172, 96], rightHand: [174, 134],
        leftKnee: [112, 170], leftFoot: [88, 218], rightKnee: [184, 188], rightFoot: [210, 218],
      };
    case 'press':
      return phase === 'start' ? {
        ...standing,
        leftElbow: [118, 96], leftHand: [136, 82], rightElbow: [182, 96], rightHand: [164, 82],
      } : {
        ...standing,
        leftElbow: [136, 58], leftHand: [140, 26], rightElbow: [164, 58], rightHand: [160, 26],
      };
    case 'vertical-pull':
      return phase === 'start' ? {
        ...standing,
        leftElbow: [126, 48], leftHand: [112, 22], rightElbow: [174, 48], rightHand: [188, 22],
      } : {
        ...standing,
        leftElbow: [116, 92], leftHand: [134, 78], rightElbow: [184, 92], rightHand: [166, 78],
      };
    case 'row':
      return phase === 'start' ? {
        ...standing,
        leftElbow: [126, 104], leftHand: [104, 118], rightElbow: [174, 104], rightHand: [196, 118],
      } : {
        ...standing,
        leftElbow: [118, 102], leftHand: [140, 112], rightElbow: [182, 102], rightHand: [160, 112],
      };
    case 'hinge':
      return phase === 'start' ? standing : {
        head: [190, 84], neck: [174, 94], hip: [142, 132],
        leftElbow: [166, 122], leftHand: [164, 164], rightElbow: [182, 116], rightHand: [180, 158],
        leftKnee: [134, 176], leftFoot: [126, 220], rightKnee: [158, 176], rightFoot: [170, 220],
      };
    case 'bridge':
      return phase === 'start' ? {
        head: [82, 166], neck: [104, 170], hip: [158, 190],
        leftElbow: [106, 194], leftHand: [88, 204], rightElbow: [126, 194], rightHand: [112, 210],
        leftKnee: [200, 170], leftFoot: [226, 214], rightKnee: [218, 174], rightFoot: [244, 218],
      } : {
        head: [82, 166], neck: [104, 164], hip: [164, 134],
        leftElbow: [108, 190], leftHand: [88, 204], rightElbow: [130, 188], rightHand: [112, 210],
        leftKnee: [204, 160], leftFoot: [226, 214], rightKnee: [220, 164], rightFoot: [244, 218],
      };
    case 'dead-bug':
      return phase === 'start' ? {
        head: [86, 176], neck: [108, 174], hip: [158, 176],
        leftElbow: [112, 136], leftHand: [114, 102], rightElbow: [132, 136], rightHand: [134, 102],
        leftKnee: [188, 136], leftFoot: [212, 140], rightKnee: [198, 162], rightFoot: [222, 166],
      } : {
        head: [86, 176], neck: [108, 174], hip: [158, 176],
        leftElbow: [116, 132], leftHand: [94, 104], rightElbow: [146, 158], rightHand: [178, 176],
        leftKnee: [188, 138], leftFoot: [214, 142], rightKnee: [194, 188], rightFoot: [232, 214],
      };
    case 'leg-press':
      return phase === 'start' ? {
        head: [86, 116], neck: [106, 128], hip: [144, 164],
        leftElbow: [112, 154], leftHand: [98, 174], rightElbow: [128, 150], rightHand: [114, 172],
        leftKnee: [190, 142], leftFoot: [226, 116], rightKnee: [196, 166], rightFoot: [234, 146],
      } : {
        head: [86, 116], neck: [106, 128], hip: [144, 164],
        leftElbow: [112, 154], leftHand: [98, 174], rightElbow: [128, 150], rightHand: [114, 172],
        leftKnee: [216, 130], leftFoot: [258, 104], rightKnee: [222, 150], rightFoot: [264, 128],
      };
    case 'leg-curl':
      return phase === 'start' ? standing : { ...standing, leftKnee: [138, 174], leftFoot: [118, 194], rightKnee: [162, 174], rightFoot: [182, 194] };
    case 'leg-extension':
      return phase === 'start' ? { ...standing, leftKnee: [138, 174], leftFoot: [128, 214], rightKnee: [162, 174], rightFoot: [172, 214] } : { ...standing, leftKnee: [140, 172], leftFoot: [112, 172], rightKnee: [160, 172], rightFoot: [188, 172] };
    case 'lateral-raise':
      return phase === 'start' ? standing : { ...standing, leftElbow: [108, 76], leftHand: [76, 76], rightElbow: [192, 76], rightHand: [224, 76] };
    case 'calf-raise':
      return phase === 'start' ? standing : { ...standing, hip: [150, 126], leftKnee: [138, 172], leftFoot: [130, 210], rightKnee: [162, 172], rightFoot: [170, 210] };
    case 'fly':
      return phase === 'start' ? { ...standing, leftElbow: [110, 82], leftHand: [78, 92], rightElbow: [190, 82], rightHand: [222, 92] } : { ...standing, leftElbow: [132, 90], leftHand: [145, 104], rightElbow: [168, 90], rightHand: [155, 104] };
    case 'face-pull':
      return phase === 'start' ? { ...standing, leftElbow: [128, 102], leftHand: [106, 112], rightElbow: [172, 102], rightHand: [194, 112] } : { ...standing, leftElbow: [112, 78], leftHand: [138, 70], rightElbow: [188, 78], rightHand: [162, 70] };
    case 'pushdown':
      return phase === 'start' ? { ...standing, leftElbow: [130, 96], leftHand: [140, 118], rightElbow: [170, 96], rightHand: [160, 118] } : { ...standing, leftElbow: [132, 94], leftHand: [126, 142], rightElbow: [168, 94], rightHand: [174, 142] };
    case 'curl':
      return phase === 'start' ? standing : { ...standing, leftElbow: [128, 96], leftHand: [138, 78], rightElbow: [172, 96], rightHand: [162, 78] };
    case 'crunch':
      return phase === 'start' ? standing : { ...standing, head: [150, 76], neck: [150, 94], hip: [150, 140], leftElbow: [126, 104], leftHand: [138, 92], rightElbow: [174, 104], rightHand: [162, 92] };
  }
}

function Skeleton({ pose, pattern }: { pose: Pose; pattern: DemoPattern }) {
  const stroke = 'currentColor';
  const limb = { stroke, strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const dumbbellPatterns: DemoPattern[] = ['squat', 'press', 'hinge', 'lateral-raise', 'curl'];

  return (
    <g className="technique-skeleton">
      <circle cx={pose.head[0]} cy={pose.head[1]} r="15" fill="none" stroke={stroke} strokeWidth="7" />
      <path d={`M ${pose.neck[0]} ${pose.neck[1]} L ${pose.hip[0]} ${pose.hip[1]}`} {...limb} />
      <path d={`M ${pose.neck[0]} ${pose.neck[1]} L ${pose.leftElbow[0]} ${pose.leftElbow[1]} L ${pose.leftHand[0]} ${pose.leftHand[1]}`} fill="none" {...limb} />
      <path d={`M ${pose.neck[0]} ${pose.neck[1]} L ${pose.rightElbow[0]} ${pose.rightElbow[1]} L ${pose.rightHand[0]} ${pose.rightHand[1]}`} fill="none" {...limb} />
      <path d={`M ${pose.hip[0]} ${pose.hip[1]} L ${pose.leftKnee[0]} ${pose.leftKnee[1]} L ${pose.leftFoot[0]} ${pose.leftFoot[1]}`} fill="none" {...limb} />
      <path d={`M ${pose.hip[0]} ${pose.hip[1]} L ${pose.rightKnee[0]} ${pose.rightKnee[1]} L ${pose.rightFoot[0]} ${pose.rightFoot[1]}`} fill="none" {...limb} />
      {dumbbellPatterns.includes(pattern) ? (
        <>
          <rect x={pose.leftHand[0] - 8} y={pose.leftHand[1] - 5} width="16" height="10" rx="3" className="technique-equipment" />
          <rect x={pose.rightHand[0] - 8} y={pose.rightHand[1] - 5} width="16" height="10" rx="3" className="technique-equipment" />
        </>
      ) : null}
    </g>
  );
}

function Equipment({ pattern, phase }: { pattern: DemoPattern; phase: 'start' | 'finish' }) {
  if (pattern === 'vertical-pull') {
    return <><line x1="92" y1="18" x2="208" y2="18" className="technique-equipment-line" /><line x1="150" y1="18" x2="150" y2={phase === 'start' ? 34 : 72} className="technique-cable" /></>;
  }
  if (pattern === 'row' || pattern === 'face-pull' || pattern === 'fly' || pattern === 'pushdown' || pattern === 'crunch') {
    return <><circle cx="270" cy="92" r="8" className="technique-equipment" /><line x1="270" y1="92" x2="190" y2="110" className="technique-cable" /></>;
  }
  if (pattern === 'leg-press') {
    return <><path d="M 55 105 L 132 184" className="technique-machine" /><path d="M 230 70 L 278 126" className="technique-machine" /></>;
  }
  if (pattern === 'bridge' || pattern === 'dead-bug') {
    return <line x1="45" y1="220" x2="266" y2="220" className="technique-floor" />;
  }
  if (pattern === 'leg-curl' || pattern === 'leg-extension') {
    return <><rect x="112" y="124" width="76" height="18" rx="8" className="technique-machine" /><line x1="150" y1="142" x2="150" y2="188" className="technique-machine" /></>;
  }
  return <line x1="45" y1="222" x2="255" y2="222" className="technique-floor" />;
}

export function getBuiltInExerciseDemo(slug: string): DemoDefinition | null {
  return exerciseDemoCatalog[slug] ?? null;
}

export function exerciseHasTechniqueMedia(exercise: Pick<Exercise, 'slug' | 'media_url'>): boolean {
  return Boolean(exercise.media_url || getBuiltInExerciseDemo(exercise.slug));
}

function BuiltInTechniqueVisual({ exercise, expanded }: { exercise: Pick<Exercise, 'slug' | 'name'>; expanded: boolean }) {
  const demo = getBuiltInExerciseDemo(exercise.slug);
  if (!demo) return null;

  return (
    <div className={expanded ? 'built-in-technique built-in-technique--expanded' : 'built-in-technique'}>
      <svg viewBox="0 0 640 290" role="img" aria-label={`${exercise.name} start and finish positions`}>
        <defs>
          <linearGradient id={`demo-bg-${exercise.slug}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(69, 200, 255, 0.14)" />
            <stop offset="1" stopColor="rgba(72, 214, 165, 0.08)" />
          </linearGradient>
          <marker id={`demo-arrow-${exercise.slug}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" className="technique-arrow-head" />
          </marker>
        </defs>
        <rect x="4" y="4" width="632" height="282" rx="24" fill={`url(#demo-bg-${exercise.slug})`} className="technique-frame" />
        <g transform="translate(8 24)">
          <rect x="12" y="18" width="284" height="226" rx="18" className="technique-panel" />
          <text x="32" y="48" className="technique-phase-label">START</text>
          <Equipment pattern={demo.pattern} phase="start" />
          <Skeleton pose={poseFor(demo.pattern, 'start')} pattern={demo.pattern} />
        </g>
        <g transform="translate(328 24)">
          <rect x="12" y="18" width="284" height="226" rx="18" className="technique-panel" />
          <text x="32" y="48" className="technique-phase-label">FINISH</text>
          <Equipment pattern={demo.pattern} phase="finish" />
          <Skeleton pose={poseFor(demo.pattern, 'finish')} pattern={demo.pattern} />
        </g>
        <path d="M 296 145 C 306 130, 326 130, 338 145" className="technique-motion-arrow" markerEnd={`url(#demo-arrow-${exercise.slug})`} />
      </svg>
      {expanded ? (
        <div className="technique-cue-grid">
          <article><span>Movement</span><p>{demo.direction}</p></article>
          <article><span>Key cue</span><p>{demo.cue}</p></article>
          <article className="technique-cue--avoid"><span>Avoid</span><p>{demo.avoid}</p></article>
        </div>
      ) : null}
    </div>
  );
}

export function ExerciseTechniqueMedia({ exercise, expanded = false }: { exercise: Exercise; expanded?: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [exercise.id, exercise.media_url]);

  if (exercise.media_url && !failed) {
    if (exercise.media_type === 'video') {
      return (
        <video
          className={expanded ? 'exercise-media-image exercise-media-image--expanded' : 'exercise-media-image'}
          src={exercise.media_url}
          controls
          playsInline
          preload="metadata"
          aria-label={`${exercise.name} demonstration`}
          onError={() => setFailed(true)}
        />
      );
    }

    return (
      <img
        className={expanded ? 'exercise-media-image exercise-media-image--expanded' : 'exercise-media-image'}
        src={exercise.media_url}
        alt={`${exercise.name} demonstration`}
        loading={expanded ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
    );
  }

  if (getBuiltInExerciseDemo(exercise.slug)) {
    return <BuiltInTechniqueVisual exercise={exercise} expanded={expanded} />;
  }

  return (
    <div
      className={expanded ? 'exercise-media-placeholder exercise-media-placeholder--expanded' : 'exercise-media-placeholder'}
      aria-label="Exercise demonstration not yet available"
    >
      <span aria-hidden="true">{exercise.primary_muscle_group.slice(0, 1)}</span>
      <small>Technique guide</small>
    </div>
  );
}

export function ExerciseTechniqueSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const demo = getBuiltInExerciseDemo(exercise.slug);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="active-technique-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="active-technique-sheet" role="dialog" aria-modal="true" aria-labelledby="active-technique-title">
        <header>
          <div>
            <p>{exercise.primary_muscle_group}</p>
            <h2 id="active-technique-title">{exercise.name}</h2>
          </div>
          <button type="button" aria-label="Close technique guide" onClick={onClose}>×</button>
        </header>
        <div className="active-technique-scroll">
          <ExerciseTechniqueMedia exercise={exercise} expanded />
          <section>
            <span className="overview-kicker">Step by step</span>
            <ol>
              {exercise.instructions.length > 0 ? exercise.instructions.map((instruction, index) => (
                <li key={`${exercise.id}-active-guide-${index}`}><span>{index + 1}</span><p>{instruction}</p></li>
              )) : <li><span>1</span><p>Use the visual positions and move through a comfortable, controlled range.</p></li>}
            </ol>
          </section>
          <aside>
            <strong>Technique reminder</strong>
            <p>{demo?.cue ?? 'Use a controlled range of motion and stop if you feel sharp pain.'}</p>
          </aside>
        </div>
      </section>
    </div>
  );
}
