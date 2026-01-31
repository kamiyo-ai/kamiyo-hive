// Re-export from separate file to avoid SSR issues
export { PAYMENT_TIERS, getTierForReputation, getTierRequirements } from './reputation-tiers';

const FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const WASM_URL = process.env.NEXT_PUBLIC_CIRCUIT_WASM_URL || '/circuits/agent_reputation.wasm';
const ZKEY_URL = process.env.NEXT_PUBLIC_CIRCUIT_ZKEY_URL || '/circuits/agent_reputation_final.zkey';

let wasmBuffer: ArrayBuffer | null = null;
let zkeyBuffer: ArrayBuffer | null = null;
let loadingPromise: Promise<{ wasmBuffer: ArrayBuffer; zkeyBuffer: ArrayBuffer }> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseidonInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let snarkjsModule: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let circomlibModule: any = null;

async function loadSnarkjs() {
  if (!snarkjsModule) {
    snarkjsModule = await import('snarkjs');
  }
  return snarkjsModule;
}

async function loadCircomlib() {
  if (!circomlibModule) {
    // @ts-expect-error - circomlibjs has no types
    circomlibModule = await import('circomlibjs');
  }
  return circomlibModule;
}

async function loadCircuitArtifacts(): Promise<{ wasmBuffer: ArrayBuffer; zkeyBuffer: ArrayBuffer }> {
  if (wasmBuffer && zkeyBuffer) return { wasmBuffer, zkeyBuffer };
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const [wasmRes, zkeyRes] = await Promise.all([fetch(WASM_URL), fetch(ZKEY_URL)]);
    if (!wasmRes.ok) throw new Error(`Failed to load WASM: ${wasmRes.status}`);
    if (!zkeyRes.ok) throw new Error(`Failed to load zkey: ${zkeyRes.status}`);

    wasmBuffer = await wasmRes.arrayBuffer();
    zkeyBuffer = await zkeyRes.arrayBuffer();

    if (wasmBuffer.byteLength < 1000) throw new Error('Invalid WASM');
    if (zkeyBuffer.byteLength < 1000) throw new Error('Invalid zkey');

    return { wasmBuffer, zkeyBuffer };
  })();

  return loadingPromise;
}

async function getPoseidon() {
  if (!poseidonInstance) {
    const circomlib = await loadCircomlib();
    poseidonInstance = await circomlib.buildPoseidon();
  }
  return poseidonInstance;
}

async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const hash = poseidon(inputs.map((i: bigint) => poseidon.F.e(i)));
  return BigInt(poseidon.F.toString(hash));
}

function bigintToBytes32(n: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let temp = n;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  return bytes;
}

function bytesToBigint(arr: Uint8Array): bigint {
  let result = BigInt(0);
  for (let i = 0; i < arr.length; i++) {
    result = (result << BigInt(8)) | BigInt(arr[i]);
  }
  return result;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function generateMerkleProof(commitment: bigint, depth: number): Promise<{ siblings: bigint[]; indices: number[]; root: bigint }> {
  const siblings: bigint[] = [];
  const indices: number[] = [];

  for (let i = 0; i < depth; i++) {
    siblings.push(bytesToBigint(randomBytes(31)) % FIELD_MODULUS);
    indices.push(0);
  }

  let currentHash = commitment;
  for (let i = 0; i < depth; i++) {
    currentHash = indices[i] === 0
      ? await poseidonHash([currentHash, siblings[i]])
      : await poseidonHash([siblings[i], currentHash]);
  }

  return { siblings, indices, root: currentHash };
}

export interface ReputationProofInputs {
  reputationScore: number;
  transactionCount: number;
  minReputation: number;
  minTransactions: number;
  agentsRoot?: string;
}

export interface ReputationProofResult {
  proof: {
    pi_a: [Uint8Array, Uint8Array];
    pi_b: [[Uint8Array, Uint8Array], [Uint8Array, Uint8Array]];
    pi_c: [Uint8Array, Uint8Array];
  };
  publicInputs: {
    agentsRoot: Uint8Array;
    minReputation: number;
    minTransactions: number;
    nullifier: Uint8Array;
  };
  proofBytes: {
    proof_a: Uint8Array;
    proof_b: Uint8Array;
    proof_c: Uint8Array;
  };
}

export async function generateReputationProof(inputs: ReputationProofInputs): Promise<ReputationProofResult> {
  const { reputationScore, transactionCount, minReputation, minTransactions } = inputs;

  if (!Number.isInteger(reputationScore) || reputationScore < 0 || reputationScore > 100)
    throw new Error('reputationScore must be 0-100');
  if (!Number.isInteger(transactionCount) || transactionCount < 0)
    throw new Error('transactionCount must be >= 0');
  if (!Number.isInteger(minReputation) || minReputation < 0 || minReputation > 100)
    throw new Error('minReputation must be 0-100');
  if (!Number.isInteger(minTransactions) || minTransactions < 0)
    throw new Error('minTransactions must be >= 0');
  if (reputationScore < minReputation)
    throw new Error(`reputation ${reputationScore} < threshold ${minReputation}`);
  if (transactionCount < minTransactions)
    throw new Error(`txCount ${transactionCount} < minimum ${minTransactions}`);
  if (transactionCount > 0xFFFFFFFF)
    throw new Error('transactionCount exceeds u32 max');

  const ownerSecret = bytesToBigint(randomBytes(31)) % FIELD_MODULUS;
  const agentId = bytesToBigint(randomBytes(31)) % FIELD_MODULUS;
  const registrationSecret = bytesToBigint(randomBytes(31)) % FIELD_MODULUS;
  const commitment = await poseidonHash([ownerSecret, agentId, registrationSecret]);

  const treeDepth = 20;
  const { siblings, indices, root: agentsRoot } = await generateMerkleProof(commitment, treeDepth);

  const epoch = BigInt(Math.floor(Date.now() / 86400000));
  const nullifier = await poseidonHash([ownerSecret, agentId, registrationSecret, epoch]);

  const circuitInputs = {
    owner_secret: ownerSecret.toString(),
    agent_id: agentId.toString(),
    registration_secret: registrationSecret.toString(),
    merkle_path: siblings.map(s => s.toString()),
    path_indices: indices,
    reputation_score: reputationScore,
    transaction_count: transactionCount,
    reputation_secret: (bytesToBigint(randomBytes(31)) % FIELD_MODULUS).toString(),
    epoch: epoch.toString(),
    agents_root: agentsRoot.toString(),
    min_reputation: minReputation,
    min_transactions: minTransactions,
    nullifier: nullifier.toString(),
  };

  const snarkjs = await loadSnarkjs();
  const { wasmBuffer: wasm, zkeyBuffer: zkey } = await loadCircuitArtifacts();
  const { proof } = await snarkjs.groth16.fullProve(
    circuitInputs,
    new Uint8Array(wasm),
    new Uint8Array(zkey)
  );

  const fieldToBytes = (s: string) => bigintToBytes32(BigInt(s));

  const proof_a = new Uint8Array(64);
  proof_a.set(fieldToBytes(proof.pi_a[0]), 0);
  proof_a.set(bigintToBytes32(FIELD_MODULUS - BigInt(proof.pi_a[1])), 32);

  const proof_b = new Uint8Array(128);
  proof_b.set(fieldToBytes(proof.pi_b[0][1]), 0);
  proof_b.set(fieldToBytes(proof.pi_b[0][0]), 32);
  proof_b.set(fieldToBytes(proof.pi_b[1][1]), 64);
  proof_b.set(fieldToBytes(proof.pi_b[1][0]), 96);

  const proof_c = new Uint8Array(64);
  proof_c.set(fieldToBytes(proof.pi_c[0]), 0);
  proof_c.set(fieldToBytes(proof.pi_c[1]), 32);

  return {
    proof: {
      pi_a: [fieldToBytes(proof.pi_a[0]), fieldToBytes(proof.pi_a[1])],
      pi_b: [
        [fieldToBytes(proof.pi_b[0][0]), fieldToBytes(proof.pi_b[0][1])],
        [fieldToBytes(proof.pi_b[1][0]), fieldToBytes(proof.pi_b[1][1])],
      ],
      pi_c: [fieldToBytes(proof.pi_c[0]), fieldToBytes(proof.pi_c[1])],
    },
    publicInputs: {
      agentsRoot: bigintToBytes32(agentsRoot),
      minReputation,
      minTransactions,
      nullifier: bigintToBytes32(nullifier),
    },
    proofBytes: {
      proof_a,
      proof_b,
      proof_c,
    },
  };
}
