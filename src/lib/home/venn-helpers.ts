/**
 * Shared pure helpers and structured content for the Venn diagram homepage.
 * Used by both Astro SSR frontmatter and client-side interactivity in index.astro.
 */

export interface BirthDateParts {
  year: number;
  month: number; // 0-indexed (0 = Jan)
  day: number;
}

export interface TwoCircleCard {
  period?: string;
  role?: string;
  title: string;
  desc?: string;
  bullets?: string[];
  bgImage?: string;
}

export interface TwoCircleSection {
  title: string;
  left: TwoCircleCard;
  right: TwoCircleCard;
}

export type TwoCircleSectionKey = 'experience' | 'project';

export const DEFAULT_BIRTHDAY: BirthDateParts = {
  year: 2004,
  month: 0,
  day: 13,
};

/**
 * Formats elapsed age as "<years>y <days>d <minutesInDay>m" from a birth date.
 */
export function computeAgeString(
  now: Date = new Date(),
  birth: BirthDateParts = DEFAULT_BIRTHDAY
): string {
  let years = now.getFullYear() - birth.year;
  let lastBirthday = new Date(now.getFullYear(), birth.month, birth.day);
  if (now < lastBirthday) {
    years -= 1;
    lastBirthday = new Date(now.getFullYear() - 1, birth.month, birth.day);
  }
  const days = Math.floor((now.getTime() - lastBirthday.getTime()) / (1000 * 60 * 60 * 24));
  const minutesInDay = now.getHours() * 60 + now.getMinutes();
  return `${years}y ${days}d ${minutesInDay}m`;
}

/**
 * Spring-like easeOutBack easing curve for arc-sliding animations.
 */
export function easeOutBack(t: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Interpolates between two percentage values and formats to 2 decimal places.
 */
export function interpolatePercent(from: number, to: number, eased: number): string {
  return `${(from + (to - from) * eased).toFixed(2)}%`;
}

/**
 * Escapes HTML special characters for safe template rendering.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const TWO_CIRCLE_SECTIONS: Record<TwoCircleSectionKey, TwoCircleSection> = {
  experience: {
    title: 'experience',
    left: {
      period: 'May 2026',
      role: 'Data Scientist',
      title: 'Lief Capital Asset Management',
      bullets: [
        'Worked across AI & data workflows on Azure Machine Learning (EDA, preprocessing, feature engineering, training, and evaluation).',
        'Optimized multi-decade financial data pipelines using parallel processing, vectorization, and Polars, cutting runtime from >1h to <30m.',
        'Contributed to a machine learning financial ranking pipeline with time-aware Walk-Forward Validation.',
      ],
    },
    right: {
      period: 'September 2025 – April 2026',
      role: 'Intern',
      title: 'Thaidotrun Co., Ltd. (Merged into ASICS)',
      bullets: [
        'Built an automated runner highlight extraction pipeline (detection, tracking, OCR) generating 10–20s clips at ~60% success rate.',
        'Developed a shoe detection & brand classification pipeline using DINO feature extraction, unsupervised clustering, and pseudo-labeling.',
        'Cut dataset preparation from 7–10 days to 1–2 days and improved test performance from 0.74 to 0.85 ± 0.05.',
      ],
    },
  },
  project: {
    title: 'project',
    left: {
      period: 'August 2024 – October 2024',
      role: 'Pre-Graduation Thesis · Computer Vision, Edge AI',
      title: 'Shrimp Detection & Counting System',
      bgImage: '/shrimp.jpg',
      bullets: [
        'Built an aquaculture shrimp detection & counting prototype fusing camera data with an underwater ultrasonic transducer.',
        'Trained YOLO11n on ~300 varied images (0.882 mAP@0.5) and converted to TensorRT FP16 (~28 FPS on NVIDIA Jetson Nano).',
        'Ran a live freshwater experiment, identifying flood-prone outdoor hardware risks before pond-scale rollout.',
      ],
    },
    right: {
      period: 'November 2024 – August 2025',
      role: 'Graduation Thesis · B.Eng. Computer Engineering & AI',
      title: 'Detection of White Blood Cells in Raptors',
      bgImage: '/wbc.png',
      bullets: [
        'Developed a deep learning detector for 6 avian blood-cell classes across 1,180 annotated smear images.',
        'Benchmarked YOLO-11l/12l/26l & RT-DETR-l; YOLO-26l reached 0.957 mAP@0.5 (93.4% recall) with Grad-CAM XAI.',
        'Built a full-stack Next.js/Supabase app with client-side WebAssembly (WASM) inference and authored a journal manuscript.',
      ],
    },
  },
};

/**
 * Renders a two-circle editorial card block with escaped text.
 */
export function renderSideCardHtml(item: TwoCircleCard | null | undefined): string {
  if (!item) return '';
  const periodHtml = item.period
    ? `<div class="two-circle-card-period">${escapeHtml(item.period)}</div>`
    : '';
  const roleHtml = item.role
    ? `<div class="two-circle-card-role">${escapeHtml(item.role)}</div>`
    : '';
  const bodyHtml = item.bullets?.length
    ? `<ul class="two-circle-card-bullets">${item.bullets
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('')}</ul>`
    : item.desc
      ? `<p class="two-circle-card-desc">${escapeHtml(item.desc)}</p>`
      : '';

  return `
    <div class="two-circle-card">
      ${periodHtml}
      ${roleHtml}
      <h3 class="two-circle-card-title">${escapeHtml(item.title)}</h3>
      ${bodyHtml}
    </div>
  `.trim();
}
