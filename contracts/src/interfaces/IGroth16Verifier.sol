// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal Groth16 verifier interface. One deployed verifier per compiled
///         blueprint (snarkjs `generateverifier` output wrapped to this shape).
interface IGroth16Verifier {
    /// @param proof πA(2) ‖ πB(4) ‖ πC(2)
    /// @param publicInputs [dkimPubkeyHash, domainHash, nullifier, patternHash,
    ///                      emailTimestamp, extraData]
    function verifyProof(uint256[8] calldata proof, uint256[6] calldata publicInputs)
        external
        view
        returns (bool);
}
