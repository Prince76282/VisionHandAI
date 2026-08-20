import type { HandData, FaceData } from "../types/vision";

// MediaPipe Hand Landmark Connections
export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base cross connections
  [5, 9], [9, 13], [13, 17],
];

// Key Face Mesh Contours
export const FACE_OVAL: number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10
];

export const LEFT_EYE_CONTOUR: number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33
];

export const RIGHT_EYE_CONTOUR: number[] = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362
];

export const LIPS_CONTOUR: number[] = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 61
];

export const NOSE_CONTOUR: number[] = [
  168, 6, 197, 195, 5, 4, 1, 19, 94, 2
];

export interface DrawOptions {
  mirrored?: boolean;
  showSkeleton?: boolean;
  showLandmarks?: boolean;
  showHandedness?: boolean;
  showGestureBadge?: boolean;
  showBoundingBox?: boolean;
  activeFingerHighlight?: boolean;
  showFaceMesh?: boolean;
  showFaceHUD?: boolean;
  showAgeEmotion?: boolean;
}

export function drawVisionOverlays(
  ctx: CanvasRenderingContext2D,
  hands: HandData[],
  faces: FaceData[],
  width: number,
  height: number,
  options: DrawOptions = {}
) {
  const {
    mirrored = true,
    showSkeleton = true,
    showLandmarks = true,
    showHandedness = true,
    showGestureBadge = true,
    showBoundingBox = true,
    activeFingerHighlight = true,
    showFaceMesh = true,
    showFaceHUD = true,
    showAgeEmotion = true,
  } = options;

  ctx.save();

  // ============================================
  // 1. DRAW FACE MESH & AGE / EMOTION HUD
  // ============================================
  for (const face of faces) {
    if (!face.landmarks || face.landmarks.length < 468) continue;

    const points = face.landmarks.map((lm) => {
      const x = mirrored ? (1 - lm.x) * width : lm.x * width;
      const y = lm.y * height;
      return { x, y, z: lm.z };
    });

    // Draw Face Mesh Contours
    if (showFaceMesh) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(6, 182, 212, 0.55)"; // Cyan Glow
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 4;

      const drawLoop = (indices: number[], color: string, widthVal = 1.5) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = widthVal;
        for (let i = 0; i < indices.length; i++) {
          const pt = points[indices[i]];
          if (!pt) continue;
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      };

      // Face Oval Outline
      drawLoop(FACE_OVAL, "rgba(0, 245, 212, 0.45)", 2);
      // Eyes
      drawLoop(LEFT_EYE_CONTOUR, "#00f5d4", 2);
      drawLoop(RIGHT_EYE_CONTOUR, "#00f5d4", 2);
      // Lips
      drawLoop(LIPS_CONTOUR, "rgba(247, 37, 133, 0.7)", 2);
      // Nose
      drawLoop(NOSE_CONTOUR, "rgba(56, 189, 248, 0.6)", 1.5);

      // Key Facial Feature Points
      [1, 33, 263, 61, 291, 10, 152].forEach((idx) => {
        const pt = points[idx];
        if (pt) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
      });

      ctx.shadowBlur = 0;
    }

    // Draw Face Bounding Box & Telemetry HUD
    if (showFaceHUD || showAgeEmotion) {
      const box = face.boundingBox;
      const rawX = mirrored ? (1 - (box.x + box.width)) * width : box.x * width;
      const rawY = box.y * height;
      const rawW = box.width * width;
      const rawH = box.height * height;

      const pad = 16;
      const bx = Math.max(10, rawX - pad);
      const by = Math.max(10, rawY - pad);
      const bw = rawW + pad * 2;
      const bh = rawH + pad * 2;

      // Cyber Holographic Corner Brackets
      ctx.strokeStyle = "rgba(0, 245, 212, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#00f5d4";
      ctx.shadowBlur = 8;

      const corner = 20;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + corner);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + corner, by);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - corner, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + corner);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - corner);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + corner, by + bh);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - corner, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - corner);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Top Face Header Tag
      const headerX = bx;
      const headerY = Math.max(25, by - 10);

      ctx.fillStyle = "rgba(10, 13, 20, 0.88)";
      ctx.beginPath();
      ctx.roundRect(headerX, headerY - 18, 160, 22, 6);
      ctx.fill();
      ctx.strokeStyle = "#00f5d4";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#00f5d4";
      ctx.font = "bold 10px JetBrains Mono, monospace";
      ctx.fillText("FACIAL BIOMETRICS", headerX + 8, headerY - 3);

      // Bottom Age & Emotion HUD Badge
      if (showAgeEmotion) {
        const hudX = Math.max(10, Math.min(width - 230, bx));
        const hudY = Math.min(height - 75, by + bh + 12);

        ctx.fillStyle = "rgba(10, 13, 20, 0.92)";
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, 220, 62, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Age Line
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.fillText(`EST. AGE: ${face.estimatedAge}`, hudX + 12, hudY + 20);

        // Emotion Line
        ctx.fillStyle = "#f1f5f9";
        ctx.font = "600 11px Inter, sans-serif";
        ctx.fillText(`MOOD: ${face.emotion}`, hudX + 12, hudY + 38);

        // Head Symmetry & Gaze
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText(`SYMMETRY: ${Math.round(face.symmetry * 100)}% • YAW: ${face.headPose.yaw}°`, hudX + 12, hudY + 53);
      }
    }
  }

  // ============================================
  // 2. DRAW HAND SKELETON & GESTURES
  // ============================================
  for (const hand of hands) {
    const isLeft = hand.handedness === "left";
    const primaryColor = isLeft ? "#00f5d4" : "#f72585";
    const secondaryColor = isLeft ? "#06b6d4" : "#a855f7";
    const glowColor = isLeft ? "rgba(0, 245, 212, 0.45)" : "rgba(247, 37, 133, 0.45)";

    const landmarks = hand.landmarks;
    if (!landmarks || landmarks.length < 21) continue;

    const points = landmarks.map((lm) => {
      const x = mirrored ? (1 - lm.x) * width : lm.x * width;
      const y = lm.y * height;
      return { x, y, z: lm.z };
    });

    // Skeleton Lines
    if (showSkeleton) {
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 12;

      for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
        const start = points[startIdx];
        const end = points[endIdx];

        ctx.strokeStyle = primaryColor;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
    }

    // Joints & Reticle
    if (showLandmarks) {
      points.forEach((pt, index) => {
        const isFingertip = [4, 8, 12, 16, 20].includes(index);
        const isIndexTip = index === 8;

        ctx.beginPath();
        if (isIndexTip && activeFingerHighlight) {
          ctx.arc(pt.x, pt.y, 8, 0, 2 * Math.PI);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = primaryColor;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 14, 0, 2 * Math.PI);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = glowColor;
          ctx.stroke();
        } else if (isFingertip) {
          ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = secondaryColor;
          ctx.stroke();
        } else {
          ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
          ctx.fillStyle = secondaryColor;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
      });
    }

    // Hand Bounding Box & Corner Brackets
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const pad = 20;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width, maxX + pad);
    maxY = Math.min(height, maxY + pad);

    if (showBoundingBox) {
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.setLineDash([]);

      const cornerLen = 14;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(minX, minY + cornerLen);
      ctx.lineTo(minX, minY);
      ctx.lineTo(minX + cornerLen, minY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(maxX - cornerLen, minY);
      ctx.lineTo(maxX, minY);
      ctx.lineTo(maxX, minY + cornerLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(minX, maxY - cornerLen);
      ctx.lineTo(minX, maxY);
      ctx.lineTo(minX + cornerLen, maxY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(maxX - cornerLen, maxY);
      ctx.lineTo(maxX, maxY);
      ctx.lineTo(maxX, maxY - cornerLen);
      ctx.stroke();
    }

    // Handedness & Gesture Badge
    if (showHandedness || showGestureBadge) {
      const wrist = points[0];
      const badgeX = Math.max(20, Math.min(width - 165, wrist.x - 75));
      const badgeY = Math.min(height - 48, Math.max(30, maxY + 15));

      const label = `${hand.handedness.toUpperCase()} HAND`;
      const gestureName = hand.currentGesture?.event && hand.currentGesture.event !== "NONE"
        ? hand.currentGesture.event.replace("_", " ")
        : "DETECTING...";
      const conf = Math.round((hand.currentGesture?.confidence || hand.score) * 100);

      ctx.fillStyle = "rgba(10, 13, 20, 0.88)";
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, 155, 42, 8);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = primaryColor;
      ctx.stroke();

      ctx.fillStyle = primaryColor;
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillText(`${label} (${conf}%)`, badgeX + 10, badgeY + 16);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 13px Inter, sans-serif";
      ctx.fillText(gestureName, badgeX + 10, badgeY + 33);
    }
  }

  ctx.restore();
}
