// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Archive of DKIM public-key hashes per sender domain, with validity
///         windows and revocation. DNS only serves a domain's *current* key, so an
///         on-chain archive is what lets old emails stay provable and leaked keys
///         get killed.
///
///         Key additions go through the owner (timelocked governance, fed by DKIM
///         archive oracles). Revocation is deliberately fast: owner OR guardian,
///         no timelock — a leaked mail-server key is an identity- and
///         event-forgery weapon.
contract DKIMRegistry is Ownable {
    struct KeyInfo {
        bool exists;
        uint64 validFrom; //  earliest emailTimestamp this key may sign (0 = epoch)
        uint64 validUntil; // latest emailTimestamp this key may sign (0 = open)
        uint64 revokedAt; //  wall-clock time of revocation (0 = not revoked)
    }

    address public guardian;
    mapping(bytes32 domainHash => mapping(bytes32 keyHash => KeyInfo)) public keys;

    event KeySet(
        bytes32 indexed domainHash, bytes32 indexed keyHash, uint64 validFrom, uint64 validUntil
    );
    event KeyRevoked(bytes32 indexed domainHash, bytes32 indexed keyHash);
    event GuardianSet(address indexed guardian);

    error NotOwnerNorGuardian();
    error UnknownKey();

    constructor(address owner_, address guardian_) Ownable(owner_) {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    function setKey(bytes32 domainHash, bytes32 keyHash, uint64 validFrom, uint64 validUntil)
        external
        onlyOwner
    {
        keys[domainHash][keyHash] =
            KeyInfo({exists: true, validFrom: validFrom, validUntil: validUntil, revokedAt: 0});
        emit KeySet(domainHash, keyHash, validFrom, validUntil);
    }

    /// @dev Revoked keys are dead for *all* proofs, including emails predating the
    ///      compromise: we cannot distinguish a genuinely old email from a forgery
    ///      back-dated by whoever holds the private key.
    function revokeKey(bytes32 domainHash, bytes32 keyHash) external {
        if (msg.sender != owner() && msg.sender != guardian) revert NotOwnerNorGuardian();
        KeyInfo storage info = keys[domainHash][keyHash];
        if (!info.exists) revert UnknownKey();
        info.revokedAt = uint64(block.timestamp);
        emit KeyRevoked(domainHash, keyHash);
    }

    function isKeyValid(bytes32 domainHash, bytes32 keyHash, uint64 emailTimestamp)
        external
        view
        returns (bool)
    {
        KeyInfo storage info = keys[domainHash][keyHash];
        if (!info.exists || info.revokedAt != 0) return false;
        if (emailTimestamp < info.validFrom) return false;
        if (info.validUntil != 0 && emailTimestamp > info.validUntil) return false;
        return true;
    }
}
