// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Uniform zkEmail proof envelope shared by every tontine blueprint.
///         See docs/SPEC.md §4 for the blueprint table and demo-mode semantics.
///         Public signals in circuit order, plus the Groth16 proof points.
///
///         The three blueprints and what each binds:
///         - enroll-v1:   nullifier = Poseidon(email address) — the member's stable
///                        identity; extraData = enrolling wallet.
///         - life-v1:     nullifier = Poseidon(email address) of the SENDER (the
///                        member proves an email they *sent*, DKIM-signed by their
///                        own provider); extraData = the pool's current epoch nonce,
///                        which the circuit proves appears in the Subject header.
///                        Freshness comes from the nonce + monotonic emailTimestamp,
///                        so life proofs cannot be stockpiled before death.
///         - death-v1:    nullifier = Poseidon(canonicalized email bytes) — one claim
///                        per unique notification email; extraData = the deceased
///                        member's identity nullifier, which the circuit proves was
///                        regex-extracted from the notification body (institutions
///                        reference the account holder's email address in account
///                        closure / bereavement correspondence).
struct EmailProof {
    bytes32 dkimPubkeyHash; // Poseidon hash of the DKIM RSA key that signed the email
    bytes32 domainHash; //     keccak256(lowercase sender domain)
    bytes32 nullifier; //      see blueprint notes above
    bytes32 patternHash; //    keccak256(blueprintId) — pins the exact circuit
    uint64 emailTimestamp; //  DKIM-covered Date header, unix seconds
    uint256[8] proof; //       Groth16 πA(2) ‖ πB(4) ‖ πC(2)
}

/// @notice What an allowlisted sender domain is trusted to attest. Bitmask.
library DomainRoles {
    uint8 internal constant NONE = 0;
    uint8 internal constant IDENTITY = 1; // may anchor enrollments
    uint8 internal constant LIFE = 2; //     may carry proof-of-life heartbeats
    uint8 internal constant DEATH = 4; //    may carry death notifications
}
