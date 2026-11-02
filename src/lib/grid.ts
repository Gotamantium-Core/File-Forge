export const GRID_SIZE = 18;

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapPoint(position: { x: number; y: number }): { x: number; y: number } {
  return { x: snapToGrid(position.x), y: snapToGrid(position.y) };
}
