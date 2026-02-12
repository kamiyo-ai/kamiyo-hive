declare module 'circomlibjs' {
  export interface Poseidon {
    (inputs: (bigint | number)[]): unknown;
    F: {
      toObject(element: unknown): bigint;
      fromObject?(n: bigint): unknown;
    };
  }

  export function buildPoseidon(): Promise<Poseidon>;
}
