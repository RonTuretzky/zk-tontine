// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

/// @notice Test/demo stand-in for a compiled snarkjs verifier. Accepts everything by
///         default; tests flip `result` (global) or veto specific public-input sets
///         to exercise failure paths. All contract-level checks (DKIM registry,
///         pattern binding, nullifiers, timestamps, windows) remain fully real.
contract MockGroth16Verifier is IGroth16Verifier {
    bool public result = true;
    mapping(bytes32 => bool) public vetoed;

    function setResult(bool result_) external {
        result = result_;
    }

    function setVetoed(uint256[6] calldata publicInputs, bool vetoed_) external {
        vetoed[keccak256(abi.encode(publicInputs))] = vetoed_;
    }

    function verifyProof(uint256[8] calldata, uint256[6] calldata publicInputs)
        external
        view
        returns (bool)
    {
        if (vetoed[keccak256(abi.encode(publicInputs))]) return false;
        return result;
    }
}
