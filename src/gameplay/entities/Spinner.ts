/**
 * Spinner entity — 자기 좌표/형태/충돌 응답을 소유.
 *
 * 종류:
 *   - cube     : 정사각형 (변 = def.size). spinner.angleRad 로 z축 회전.
 *   - triangle : 정삼각형 (외접원 반경 = def.size/2). spinner.angleRad 로 z축 회전.
 *
 * 회전:
 *   - 시각 렌더는 pseudo-3D Y축 회전 (renderInGameScreen.ts) — 그건 그것대로.
 *   - 콜리전은 단순 2D z축 회전. 시각 silhouette 과 완전 일치하지는 않지만
 *     원(circle) 보다 형태에 훨씬 가깝다.
 */

import type { BallState } from '../state/BallState';
import type { SpinnerRuntimeState } from '../state/SpinnerRuntimeState';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import { BALL_RADIUS } from '../systems/playfieldLayout';

export type Vec2 = { x: number; y: number };

/**
 * 회전된 콜리전 폴리곤 vertex 목록 (월드 좌표, CCW).
 *
 * 시각 렌더러(renderInGameScreen.ts) 가 그리는 pseudo-3D Y축 회전 silhouette 과
 * 정확히 일치한다. Y축 회전이라 y 는 불변, x 만 sin/cos 으로 변형.
 *
 *   cube     : 8 vertex 3D cube → 2D 실루엣 = AABB (세로 ±s, 가로 ±s*(|cos|+|sin|)).
 *              회전하지 않음, 폭만 펄스. 4 vertex 직사각형.
 *   triangle : tetrahedron 4 vertex → top vertex 는 (0, -h) 고정, base 3개 중
 *              가장 왼/오른쪽 x' 두 개와 함께 3 vertex 삼각형.
 *
 * spinner.angleRad 는 Y축 회전각 (렌더와 동일 의미).
 */
export function getCollisionPolygon(
  spinner: SpinnerRuntimeState,
  def: SpinnerDefinition,
): readonly Vec2[] {
  const cx = spinner.x;
  const cy = spinner.y;
  const cos = Math.cos(spinner.angleRad);
  const sin = Math.sin(spinner.angleRad);

  // 2026-05-19: 시각의 edge stroke(2px) + glow 영역 보정 — 콜리전을 ~4px 외곽으로 확장.
  // 시각 outer envelope 가 발광 효과로 더 커 보이는데 콜리전이 fill 만 잡으면 "닿았는데 안 튕김" 느낌.
  const VISUAL_OUTER_PAD = 4;

  if (def.kind === 'cube') {
    // 8 vertex 정육면체 → Y회전 후 2D silhouette = 직사각형.
    //   x range = ±s * (|cos| + |sin|),  y range = ±s
    const s = def.size / 2;
    const halfW = s * (Math.abs(cos) + Math.abs(sin)) + VISUAL_OUTER_PAD;
    const halfH = s + VISUAL_OUTER_PAD;
    return [
      { x: cx - halfW, y: cy - halfH },
      { x: cx + halfW, y: cy - halfH },
      { x: cx + halfW, y: cy + halfH },
      { x: cx - halfW, y: cy + halfH },
    ];
  }

  // triangle (tetrahedron). renderInGameScreen.ts §triangle 와 동일 vertex.
  //   s = def.size/2, h = def.size * √6/3, inv3 = 1/√3
  //   top:   (0,   -h,      0)
  //   base1: (s,   h/3,  -s*inv3)
  //   base2: (-s,  h/3,  -s*inv3)
  //   base3: (0,   h/3,   2*s*inv3)
  // Y회전 후 x' = lx*cos - lz*sin, y' = ly (변하지 않음).
  // silhouette = top + base 3개 중 minX, maxX 두 개.
  const s = def.size / 2;
  const h = def.size * (Math.sqrt(6) / 3);
  const inv3 = 1 / Math.sqrt(3);
  const baseY = h / 3;
  const base1X = s * cos - (-s * inv3) * sin;        // s*cos + s*inv3*sin
  const base2X = -s * cos - (-s * inv3) * sin;       // -s*cos + s*inv3*sin
  const base3X = 0 * cos - (2 * s * inv3) * sin;     // -2*s*inv3*sin
  const minX = Math.min(base1X, base2X, base3X);
  const maxX = Math.max(base1X, base2X, base3X);
  // CCW: top, base-right, base-left (y is down, CCW from top).
  // 외곽 방향으로 VISUAL_OUTER_PAD 만큼 확장 (시각 stroke+glow 보정).
  return [
    { x: cx, y: cy - h - VISUAL_OUTER_PAD },
    { x: cx + maxX + VISUAL_OUTER_PAD, y: cy + baseY + VISUAL_OUTER_PAD },
    { x: cx + minX - VISUAL_OUTER_PAD, y: cy + baseY + VISUAL_OUTER_PAD },
  ];
}

/**
 * 폴리곤 위의 점 중 ball center 에 가장 가까운 지점을 찾는다.
 * 폴리곤 경계 (변 위) 만 검사. inside test 는 별도로 필요할 수 있음.
 * 반환: (closestPoint, edge index, edge normal — outward).
 */
function closestPointOnPolygon(
  poly: readonly Vec2[],
  p: Vec2,
): { pt: Vec2; edgeNormal: Vec2 } {
  let bestDistSq = Infinity;
  let bestPt: Vec2 = poly[0]!;
  let bestNormal: Vec2 = { x: 0, y: -1 };

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len2 = ex * ex + ey * ey;
    if (len2 < 1e-12) continue;
    let t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cpx = a.x + ex * t;
    const cpy = a.y + ey * t;
    const dx = p.x - cpx;
    const dy = p.y - cpy;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < bestDistSq) {
      bestDistSq = dist2;
      bestPt = { x: cpx, y: cpy };
      // CCW 폴리곤의 outward normal: edge 의 우측 (ey, -ex) 정규화.
      const len = Math.sqrt(len2);
      bestNormal = { x: ey / len, y: -ex / len };
    }
  }
  return { pt: bestPt, edgeNormal: bestNormal };
}

/** ball center 가 폴리곤 안에 있는지 (CCW 가정, ray casting). */
function isPointInsidePolygon(poly: readonly Vec2[], p: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y;
    const xj = poly[j]!.x, yj = poly[j]!.y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 공 swept 충돌 검사 — prev → curr 선분이 폴리곤 변을 가로질러 inside 로 들어왔는지.
 *
 * 빠른 공이 한 프레임에 폴리곤을 *건너뛰면* (터널링) 현재 위치 검사로는 못 잡으므로
 * 이전 위치 → 현재 위치 선분으로 변과 교차 시점 t (0..1) 탐색.
 *
 * @returns 가장 빠른 (t 최소) 충돌 — { t, nx, ny } 또는 null (충돌 없음).
 */
function sweptCheckPolygon(
  prev: Vec2,
  curr: Vec2,
  poly: readonly Vec2[],
): { t: number; nx: number; ny: number } | null {
  let bestT = Infinity;
  let bestNx = 0;
  let bestNy = 0;
  let hit = false;

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const lenSq = ex * ex + ey * ey;
    if (lenSq < 1e-12) continue;
    const len = Math.sqrt(lenSq);
    // CCW outward normal (poly 가 CCW 가정 — getCollisionPolygon 보장).
    const nx = ey / len;
    const ny = -ex / len;

    // 변 plane 까지의 부호 거리 (outward 양수).
    const distPrev = (prev.x - a.x) * nx + (prev.y - a.y) * ny;
    const distCurr = (curr.x - a.x) * nx + (curr.y - a.y) * ny;

    // 공 surface 가 변 plane 에 닿는 = dist = BALL_RADIUS.
    // prev 가 outside (dist > R) + curr 가 inside-or-touching (dist <= R) 이면 진입.
    if (distPrev > BALL_RADIUS && distCurr <= BALL_RADIUS) {
      const denom = distPrev - distCurr;
      if (denom < 1e-9) continue;
      const t = (distPrev - BALL_RADIUS) / denom;
      if (t < 0 || t > 1) continue;
      // 충돌 시점의 공 중심 위치.
      const hitX = prev.x + (curr.x - prev.x) * t;
      const hitY = prev.y + (curr.y - prev.y) * t;
      // 그 시점 공 중심이 변 segment 영역 내인지 (투영 t_e 0..1).
      const tEdge = ((hitX - a.x) * ex + (hitY - a.y) * ey) / lenSq;
      if (tEdge < 0 || tEdge > 1) continue;

      if (t < bestT) {
        bestT = t;
        bestNx = nx;
        bestNy = ny;
        hit = true;
      }
    }
  }

  return hit ? { t: bestT, nx: bestNx, ny: bestNy } : null;
}

/**
 * 공 ↔ 스피너 폴리곤 충돌 검사 + 반사.
 *
 * 두 단계 검사:
 *   1) **swept** — prevBall 주어지면 선분 (prev → curr) 이 폴리곤 변을 가로질러 들어왔는지.
 *      빠른 공 터널링 방지. swept hit 시 그 시점으로 위치 되돌리고 반사.
 *   2) **현재 위치 검사** — swept 가 안 잡았으면 옛 로직 (closest point + inside test).
 *
 * @param prevBall 이번 tick 시작 시점 공 위치 (선택). MovementSystem 처리 *전* 위치.
 * @returns
 *   - collided: false → 충돌 없음 (ball 그대로)
 *   - collided: true  → push-out + 반사 적용된 nextBall
 */
export function handleBallCollision(
  ball: BallState,
  spinner: SpinnerRuntimeState,
  def: SpinnerDefinition,
  prevBall?: BallState,
): { nextBall: BallState; collided: boolean } {
  const poly = getCollisionPolygon(spinner, def);

  // 1) swept 검사 — prevBall 있을 때만.
  if (prevBall) {
    const swept = sweptCheckPolygon(
      { x: prevBall.x, y: prevBall.y },
      { x: ball.x, y: ball.y },
      poly,
    );
    if (swept) {
      // 충돌 시점 공 중심 위치.
      const hitX = prevBall.x + (ball.x - prevBall.x) * swept.t;
      const hitY = prevBall.y + (ball.y - prevBall.y) * swept.t;
      const dot = ball.vx * swept.nx + ball.vy * swept.ny;
      // dot < 0 = 변쪽으로 들어오는 중 → 반사.
      if (dot < 0) {
        return {
          nextBall: {
            ...ball,
            x: hitX,
            y: hitY,
            vx: ball.vx - 2 * dot * swept.nx,
            vy: ball.vy - 2 * dot * swept.ny,
          },
          collided: true,
        };
      }
      // dot >= 0 (이미 분리 방향) — push-out 만, 반사 안 함.
      return {
        nextBall: { ...ball, x: hitX, y: hitY },
        collided: true,
      };
    }
  }

  // 2) 옛 로직 — 현재 위치 closest point + inside test.
  const ballPos: Vec2 = { x: ball.x, y: ball.y };
  const { pt: closest, edgeNormal } = closestPointOnPolygon(poly, ballPos);

  const dx = ball.x - closest.x;
  const dy = ball.y - closest.y;
  const distToBoundary = Math.sqrt(dx * dx + dy * dy);

  const inside = isPointInsidePolygon(poly, ballPos);

  // inside 가 아니면서 거리 > BALL_RADIUS → 충돌 없음.
  if (!inside && distToBoundary > BALL_RADIUS) {
    return { nextBall: ball, collided: false };
  }

  // 법선: 공 → 폴리곤 외부 방향.
  // - outside + 가까움: 법선 = closest → ball (정규화)
  // - inside: 법선 = edge normal (outward), 공을 폴리곤 밖으로 밀어내는 방향
  let nx: number;
  let ny: number;
  if (inside) {
    nx = edgeNormal.x;
    ny = edgeNormal.y;
  } else if (distToBoundary > 1e-6) {
    nx = dx / distToBoundary;
    ny = dy / distToBoundary;
  } else {
    nx = edgeNormal.x;
    ny = edgeNormal.y;
  }

  // 입사 속도의 법선 성분. dot < 0 이면 공이 폴리곤 쪽으로 들어오는 중.
  const dot = ball.vx * nx + ball.vy * ny;

  // push-out: 공 표면이 폴리곤 경계에 닿도록 위치 보정.
  // outside: overlap = BALL_RADIUS - distToBoundary (양수)
  // inside : overlap = BALL_RADIUS + distToBoundary (공을 폴리곤 밖으로 강제 이동)
  const overlap = inside
    ? BALL_RADIUS + distToBoundary
    : BALL_RADIUS - distToBoundary;

  // dot >= 0 이면 이미 분리 방향 → 반사 안 함, push-out 만.
  if (dot >= 0) {
    return {
      nextBall: {
        ...ball,
        x: ball.x + nx * overlap,
        y: ball.y + ny * overlap,
      },
      collided: true,
    };
  }

  // 반사: v' = v - 2(v·n)n
  return {
    nextBall: {
      ...ball,
      x: ball.x + nx * overlap,
      y: ball.y + ny * overlap,
      vx: ball.vx - 2 * dot * nx,
      vy: ball.vy - 2 * dot * ny,
    },
    collided: true,
  };
}
