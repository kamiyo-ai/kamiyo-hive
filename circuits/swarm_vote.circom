pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";

// Anonymous voting with Merkle membership proof
// vote_commitment = Poseidon(vote, vote_salt, action_hash)
// vote_nullifier = Poseidon(owner_secret, agent_id, registration_secret, action_hash)
template SwarmVote(TREE_DEPTH) {
    // Public inputs
    signal input agents_root;
    signal input action_hash;
    signal input vote_nullifier;
    signal input vote_commitment;

    // Private inputs
    signal input owner_secret;
    signal input agent_id;
    signal input registration_secret;
    signal input merkle_path[TREE_DEPTH];
    signal input path_indices[TREE_DEPTH];
    signal input vote;
    signal input vote_salt;

    // 1. Validate vote is binary (0 or 1)
    vote * (1 - vote) === 0;

    // 2. Compute agent commitment
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== owner_secret;
    commitmentHasher.inputs[1] <== agent_id;
    commitmentHasher.inputs[2] <== registration_secret;
    signal commitment <== commitmentHasher.out;

    // 3. Verify commitment is in Merkle tree
    component merkleHashers[TREE_DEPTH];
    component muxes[TREE_DEPTH];

    signal merkleNodes[TREE_DEPTH + 1];
    merkleNodes[0] <== commitment;

    for (var i = 0; i < TREE_DEPTH; i++) {
        // Ensure path_indices is binary
        path_indices[i] * (1 - path_indices[i]) === 0;

        muxes[i] = MultiMux1(2);
        muxes[i].c[0][0] <== merkleNodes[i];
        muxes[i].c[0][1] <== merkle_path[i];
        muxes[i].c[1][0] <== merkle_path[i];
        muxes[i].c[1][1] <== merkleNodes[i];
        muxes[i].s <== path_indices[i];

        merkleHashers[i] = Poseidon(2);
        merkleHashers[i].inputs[0] <== muxes[i].out[0];
        merkleHashers[i].inputs[1] <== muxes[i].out[1];
        merkleNodes[i + 1] <== merkleHashers[i].out;
    }

    // Verify computed root matches public root
    agents_root === merkleNodes[TREE_DEPTH];

    // 4. Verify nullifier (owner_secret required to prevent forgery)
    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== owner_secret;
    nullifierHasher.inputs[1] <== agent_id;
    nullifierHasher.inputs[2] <== registration_secret;
    nullifierHasher.inputs[3] <== action_hash;

    vote_nullifier === nullifierHasher.out;

    // 5. Verify vote commitment
    component voteCommitmentHasher = Poseidon(3);
    voteCommitmentHasher.inputs[0] <== vote;
    voteCommitmentHasher.inputs[1] <== vote_salt;
    voteCommitmentHasher.inputs[2] <== action_hash;

    vote_commitment === voteCommitmentHasher.out;
}

// Default depth of 20 supports ~1M agents
component main {public [agents_root, action_hash, vote_nullifier, vote_commitment]} = SwarmVote(20);
