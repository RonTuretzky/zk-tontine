// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EmailProof} from "./Types.sol";
import {IGroth16Verifier} from "./interfaces/IGroth16Verifier.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";
import {DKIMRegistry} from "./DKIMRegistry.sol";

/// @notice Routes each proof to the Groth16 verifier compiled for its blueprint
///         (keyed by patternHash) after checking the signing DKIM key against the
///         registry. Compiled snarkjs verifiers drop in per blueprint; nothing else
///         in the system changes when circuits are added or upgraded.
contract ZKEmailVerifier is Ownable, IZKEmailVerifier {
    DKIMRegistry public immutable dkim;
    mapping(bytes32 patternHash => IGroth16Verifier) public verifiers;

    event VerifierSet(bytes32 indexed patternHash, address verifier);

    constructor(address owner_, DKIMRegistry dkim_) Ownable(owner_) {
        dkim = dkim_;
    }

    function setVerifier(bytes32 patternHash, IGroth16Verifier verifier) external onlyOwner {
        verifiers[patternHash] = verifier;
        emit VerifierSet(patternHash, address(verifier));
    }

    function verify(EmailProof calldata p, uint256 extraData) external view returns (bool) {
        IGroth16Verifier g16 = verifiers[p.patternHash];
        if (address(g16) == address(0)) return false;
        if (!dkim.isKeyValid(p.domainHash, p.dkimPubkeyHash, p.emailTimestamp)) return false;
        return g16.verifyProof(
            p.proof,
            [
                uint256(p.dkimPubkeyHash),
                uint256(p.domainHash),
                uint256(p.nullifier),
                uint256(p.patternHash),
                uint256(p.emailTimestamp),
                extraData
            ]
        );
    }
}
