// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EmailProof} from "../Types.sol";

interface IZKEmailVerifier {
    /// @notice Verifies DKIM-key registration + the Groth16 proof for the
    ///         blueprint identified by proof.patternHash.
    /// @param extraData sixth public input. enroll-v1: enrolling wallet;
    ///        life-v1: epoch nonce; death-v1: deceased's identity nullifier.
    function verify(EmailProof calldata proof, uint256 extraData) external view returns (bool);
}
