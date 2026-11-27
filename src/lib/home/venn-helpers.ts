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
  title: string;
  desc: string;
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
      title: 'Lief Capital Asset Management',
      desc: 'Worked with AI and data processing workflows on Azure Machine Learning, covering data preprocessing, feature engineering, model training, and evaluation. Optimized large-scale financial data processing using parallel processing, vectorized computation, and Polars, reducing runtime from over 1 hour to under 30 minutes. Also contributed to a machine learning-based financial ranking pipeline with Walk-Forward Validation.',
    },
    right: {
      title: 'Thaidotrun Co., Ltd. (Merged into ASICS)',
      desc: 'Worked on computer vision and machine learning solutions for race events. Developed an automated runner highlight extraction system using object detection, tracking, and OCR to generate 10–20 second clips, achieving approximately 60% success rate. Also built a shoe detection and brand classification pipeline using DINO feature extraction, unsupervised learning, and pseudo-labeling, reducing dataset preparation time from 7–10 days to 1–2 days and improving model performance from 0.74 to 0.85 ± 0.05.',
    },
  },
  project: {
    title: 'project',
    left: {
      title: 'MTC-UAV Maize Tassel Counting',
      desc: 'Investigated spatial density estimation as a robust computer vision solution for automated maize tassel enumeration in ultra-dense aerial drone imagery, addressing severe occlusions where individual bounding box detectors fail.',
    },
    right: {
      title: 'Raptor Blood Cell Classification System',
      desc: 'Collaborative graduation research creating a clinical deep learning object detection diagnostic system for identifying six avian blood-cell classes from raptor blood smears with YOLO-26l, RT-DETR, and Grad-CAM for Explainable AI (XAI).',
    },
  },
};

/**
 * Renders a two-circle editorial card block with escaped text.
 */
export function renderSideCardHtml(item: TwoCircleCard | null | undefined): string {
  if (!item) return '';
  return `
    <div class="two-circle-card">
      <h3 class="two-circle-card-title">${escapeHtml(item.title)}</h3>
      <p class="two-circle-card-desc">${escapeHtml(item.desc)}</p>
    </div>
  `.trim();
}
