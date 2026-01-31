export interface HiveVizEffect {
  id: string;
  type: 'ring';
  sourcePosition: [number, number, number];
  color: string;
  progress: number;
  startedAt: number;
  duration: number;
}
