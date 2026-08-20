import type { FaceData, NormalizedLandmark } from "../types/vision";

function dist(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Temporal smoothing: moving average buffer for age stability
const ageHistory: string[] = [];
const AGE_HISTORY_LEN = 12;

export function analyzeFace(landmarks: NormalizedLandmark[]): FaceData | null {
  if (!landmarks || landmarks.length < 468) return null;

  // ── Key Anatomy Points ─────────────────────────────────────────────────────
  const forehead    = landmarks[10];
  const chin        = landmarks[152];
  const leftCheek   = landmarks[234];
  const rightCheek  = landmarks[454];
  const noseTip     = landmarks[1];
  const noseBridge  = landmarks[6];

  const leftEyeOuter  = landmarks[33];
  const leftEyeInner  = landmarks[133];
  const leftEyeTop    = landmarks[159];
  const leftEyeBottom = landmarks[145];

  const rightEyeInner  = landmarks[362];
  const rightEyeOuter  = landmarks[263];
  const rightEyeTop    = landmarks[386];
  const rightEyeBottom = landmarks[374];

  const mouthLeft  = landmarks[61];
  const mouthRight = landmarks[291];
  const lipTop     = landmarks[13];
  const lipBottom  = landmarks[14];

  // Jaw / lower face anchor
  const leftJaw  = landmarks[172];
  const rightJaw = landmarks[397];

  // ── Bounding Box ────────────────────────────────────────────────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  const boundingBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  // ── Core Measurements ───────────────────────────────────────────────────────
  const faceHeight   = dist(forehead, chin);
  const faceWidth    = dist(leftCheek, rightCheek);
  const safeFH       = Math.max(0.01, faceHeight);
  const safeFW       = Math.max(0.01, faceWidth);

  // Vertical thirds
  const upperThird   = dist(forehead, noseBridge) / safeFH;  // forehead zone


  const lowerThird   = dist(noseTip, chin) / safeFH;         // chin/jaw zone

  // Eye measurements
  const leftEyeH     = dist(leftEyeTop, leftEyeBottom);
  const leftEyeW     = dist(leftEyeOuter, leftEyeInner);
  const leftEAR      = leftEyeH / Math.max(0.001, leftEyeW);

  const rightEyeH    = dist(rightEyeTop, rightEyeBottom);
  const rightEyeW    = dist(rightEyeOuter, rightEyeInner);
  const rightEAR     = rightEyeH / Math.max(0.001, rightEyeW);

  const eyeWidth     = (leftEyeW + rightEyeW) / 2;
  const eyeToFace    = eyeWidth / safeFW;  // larger eyes relative to face → youth

  // Eye vertical position (how high on face are eyes)
  const leftEyeMidY  = (leftEyeTop.y + leftEyeBottom.y) / 2;
  const rightEyeMidY = (rightEyeTop.y + rightEyeBottom.y) / 2;
  const eyeMidY      = (leftEyeMidY + rightEyeMidY) / 2;
  const eyeVerticalPos = (eyeMidY - forehead.y) / safeFH; // smaller = eyes higher up (youth)

  // Jaw width ratio
  const jawWidth     = dist(leftJaw, rightJaw);
  const jawRatio     = jawWidth / safeFW;  // lower jaw width relative to cheek width

  // Mouth
  const mouthWidth   = dist(mouthLeft, mouthRight);
  const mouthOpenness = dist(lipTop, lipBottom);
  const mouthWidthRatio = mouthWidth / safeFW;
  const mouthOpenRatio  = mouthOpenness / Math.max(0.001, mouthWidth);

  // Smile metric
  const mouthCornerY  = (mouthLeft.y + mouthRight.y) / 2;
  const smileElev     = (lipTop.y - mouthCornerY) / safeFH;

  // ── Blink Detection ─────────────────────────────────────────────────────────
  const isLeftBlink  = leftEAR  < 0.18;
  const isRightBlink = rightEAR < 0.18;

  // ── Emotion Classification ──────────────────────────────────────────────────
  let emotion      = "Neutral 😐";
  let emotionScore = 0.82;

  if (isLeftBlink && !isRightBlink) {
    emotion = "Winking Left 😉"; emotionScore = 0.91;
  } else if (!isLeftBlink && isRightBlink) {
    emotion = "Winking Right 😉"; emotionScore = 0.91;
  } else if (mouthOpenRatio > 0.5) {
    emotion = "Surprised 😲"; emotionScore = Math.min(0.98, 0.72 + mouthOpenRatio * 0.5);
  } else if (mouthWidthRatio > 0.44 && smileElev > 0.01) {
    emotion = "Happy / Smiling 😊"; emotionScore = Math.min(0.99, 0.80 + (mouthWidthRatio - 0.44) * 2.5);
  } else if (mouthOpenRatio > 0.22) {
    emotion = "Speaking 🗣️"; emotionScore = 0.87;
  } else if (smileElev < -0.005) {
    emotion = "Sad / Frowning 😢"; emotionScore = 0.78;
  }

  // ── Age Estimation — Multi-Metric ───────────────────────────────────────────
  //
  // Score each hypothesis using multiple independent metrics:
  //   - lowerThird (jaw/chin drop grows with age)
  //   - upperThird (forehead proportion shrinks slightly with age)
  //   - eyeToFace  (eye-to-face ratio shrinks with age)
  //   - eyeVerticalPos (eyes sit relatively higher in youth)
  //   - jawRatio  (jaw narrows relative to cheeks in mature/senior faces)
  //   - facialIndex = faceHeight / faceWidth
  //
  const facialIndex = safeFH / safeFW;

  // Each metric returns a score 0-1 for each age bracket
  type AgeBracket = "Teen" | "YoungAdult" | "Adult" | "Mature" | "Senior";

  const scores: Record<AgeBracket, number> = {
    Teen:       0,
    YoungAdult: 0,
    Adult:      0,
    Mature:     0,
    Senior:     0,
  };

  // lowerThird: Teen=0.30-0.37, YoungAdult=0.37-0.41, Adult=0.41-0.44, Mature=0.44-0.48, Senior=0.48+
  const lt = lowerThird;
  if (lt < 0.37)        scores.Teen       += 2.5;
  else if (lt < 0.41)   scores.YoungAdult += 2.5;
  else if (lt < 0.44)   scores.Adult      += 2.5;
  else if (lt < 0.48)   scores.Mature     += 2.5;
  else                  scores.Senior     += 2.5;

  // eyeToFace: larger relative eye → younger
  const ef = eyeToFace;
  if (ef > 0.30)        scores.Teen       += 2.0;
  else if (ef > 0.27)   scores.YoungAdult += 2.0;
  else if (ef > 0.24)   scores.Adult      += 2.0;
  else if (ef > 0.21)   scores.Mature     += 2.0;
  else                  scores.Senior     += 2.0;

  // eyeVerticalPos: lower value = eyes higher up (youth)
  const ev = eyeVerticalPos;
  if (ev < 0.30)        scores.Teen       += 1.5;
  else if (ev < 0.35)   scores.YoungAdult += 1.5;
  else if (ev < 0.40)   scores.Adult      += 1.5;
  else if (ev < 0.45)   scores.Mature     += 1.5;
  else                  scores.Senior     += 1.5;

  // jawRatio: higher jaw-to-face ratio (jaw fills more of face) → more adult/mature
  const jr = jawRatio;
  if (jr < 0.70)        scores.Teen       += 1.0;
  else if (jr < 0.77)   scores.YoungAdult += 1.0;
  else if (jr < 0.83)   scores.Adult      += 1.0;
  else if (jr < 0.88)   scores.Mature     += 1.0;
  else                  scores.Senior     += 1.0;

  // upperThird: larger upper third (big forehead) → youth
  const ut = upperThird;
  if (ut > 0.36)        scores.Teen       += 1.0;
  else if (ut > 0.33)   scores.YoungAdult += 1.0;
  else if (ut > 0.30)   scores.Adult      += 1.0;
  else if (ut > 0.27)   scores.Mature     += 1.0;
  else                  scores.Senior     += 1.0;

  // facialIndex bonus (long/narrow vs short/wide)
  if (facialIndex < 1.20)    scores.Mature  += 0.5;
  else if (facialIndex > 1.40) scores.Teen  += 0.5;

  // Pick winning bracket
  let topBracket: AgeBracket = "Adult";
  let topScore = -1;
  for (const [bracket, sc] of Object.entries(scores) as [AgeBracket, number][]) {
    if (sc > topScore) { topScore = sc; topBracket = bracket; }
  }

  // ── Temporal smoothing for age (prevent flickering) ─────────────────────────
  ageHistory.push(topBracket);
  if (ageHistory.length > AGE_HISTORY_LEN) ageHistory.shift();

  const ageCounts: Record<string, number> = {};
  for (const a of ageHistory) { ageCounts[a] = (ageCounts[a] || 0) + 1; }
  let stableAge: AgeBracket = topBracket;
  let maxAgeCt = 0;
  for (const [a, ct] of Object.entries(ageCounts)) {
    if (ct > maxAgeCt) { maxAgeCt = ct; stableAge = a as AgeBracket; }
  }

  const AGE_LABELS: Record<AgeBracket, string> = {
    Teen:       "Teen (13-19 yrs)",
    YoungAdult: "Young Adult (20-27 yrs)",
    Adult:      "Adult (28-38 yrs)",
    Mature:     "Mature (39-50 yrs)",
    Senior:     "Senior (51+ yrs)",
  };

  const estimatedAge  = AGE_LABELS[stableAge];
  const totalPossible = 8.5; // sum of all metric weights
  const ageConfidence = Math.min(0.96, 0.60 + (topScore / totalPossible) * 0.36);

  // ── Head Pose ────────────────────────────────────────────────────────────────
  const leftEyeCenter  = (leftEyeOuter.x + leftEyeInner.x) / 2;
  const rightEyeCenter = (rightEyeOuter.x + rightEyeInner.x) / 2;
  const midEyeX        = (leftEyeCenter + rightEyeCenter) / 2;

  const yaw   = Math.round((noseTip.x - midEyeX) * 180);
  const pitch = Math.round((noseTip.y - (leftEyeTop.y + rightEyeTop.y) / 2) * 100 - 15);
  const roll  = Math.round(
    Math.atan2(rightEyeInner.y - leftEyeInner.y, rightEyeInner.x - leftEyeInner.x) * (180 / Math.PI)
  );

  // ── Symmetry ─────────────────────────────────────────────────────────────────
  const leftFaceHalf  = dist(leftCheek, noseTip);
  const rightFaceHalf = dist(rightCheek, noseTip);
  const symmetry = Math.max(0, 1.0 - Math.abs(leftFaceHalf - rightFaceHalf) / safeFW);

  return {
    landmarks,
    boundingBox,
    estimatedAge,
    ageConfidence: Number(ageConfidence.toFixed(2)),
    emotion,
    emotionScore: Number(emotionScore.toFixed(2)),
    symmetry: Number(symmetry.toFixed(2)),
    headPose: { yaw, pitch, roll },
    eyesBlinking: { left: isLeftBlink, right: isRightBlink },
  };
}
