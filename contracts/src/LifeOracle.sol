// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EmailProof, DomainRoles} from "./Types.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";

/// @notice The mortality oracle: binds wallets to email identities and tracks each
///         identity through Alive → (Lapsed) → DeathClaimed → Dead, driven entirely
///         by zkEmail proofs from allowlisted proxy institutions.
///
///         Design highlights (see docs/SPEC.md for the full argument):
///         - Heartbeats are challenge-response: the member must *send* an email
///           containing the oracle's current epoch nonce and prove their provider's
///           DKIM signature over it. The nonce is derived from a blockhash observed
///           after the epoch starts, so life proofs cannot be stockpiled while alive
///           and replayed by heirs after death.
///         - Missing heartbeats only *lapses* a member (payouts pause); it never
///           redistributes their money. Only a verified death does that. This kills
///           the "key-management endurance lottery" failure mode of naive designs.
///         - Death claims are bonded and challengeable. A false claim is refuted by
///           any fresher life proof, and the bond is forfeited to the victim.
///         - Members with no institutional email trail at death are handled by the
///           presumed-death path: a deep lapse plus a larger bond and a longer
///           challenge window, mirroring legal presumption of death.
contract LifeOracle is Ownable, ReentrancyGuard {
    enum Status {
        None, //         never enrolled
        Alive, //        enrolled; liveness currency is derived from lastLifeProof
        DeathClaimed, // bonded claim pending its challenge window
        Dead //          finalized
    }

    struct Record {
        Status status;
        address wallet; //         current bound wallet
        uint64 enrolledAt;
        uint64 lastLifeProof; //   emailTimestamp of the freshest accepted life signal
        // death-claim state
        address claimant;
        uint96 bond;
        uint64 claimedAt; //       wall clock when the claim opened
        uint64 deathNoticeTime; // claimed moment of death (email Date, or lastLifeProof
        //                         for presumed-death claims)
        uint64 challengeEnds;
    }

    uint64 public constant MAX_TIMESTAMP_SKEW = 1 days;

    IZKEmailVerifier public immutable verifier;
    bytes32 public immutable enrollPattern;
    bytes32 public immutable lifePattern;
    bytes32 public immutable deathPattern;

    uint64 public immutable heartbeatPeriod; //         e.g. 90 days
    uint64 public immutable gracePeriod; //             e.g. 30 days
    uint64 public immutable challengeWindow; //         e.g. 30 days
    uint64 public immutable presumedDeadAfter; //       e.g. 730 days without a heartbeat
    uint64 public immutable presumedChallengeWindow; // e.g. 90 days
    uint96 public immutable deathClaimBond; //          native xDAI
    uint96 public immutable presumedClaimBond; //       native xDAI, larger

    mapping(bytes32 domainHash => uint8 roles) public domainRoles;
    mapping(bytes32 id => Record) public records;
    mapping(address wallet => bytes32 id) public idOf;
    mapping(bytes32 emailNullifier => bool) public usedDeathEmails;

    // Challenge-response epoch nonce. Rolled lazily by the first proof of a new
    // epoch; derived from a blockhash seen only after the epoch began.
    uint64 public currentEpochIndex;
    bytes32 public currentEpochNonce;
    uint64 public currentEpochNonceSetAt;

    event DomainRolesSet(bytes32 indexed domainHash, uint8 roles);
    event Enrolled(bytes32 indexed id, address indexed wallet, uint64 emailTimestamp);
    event WalletRebound(bytes32 indexed id, address indexed oldWallet, address indexed newWallet);
    event LifeProven(bytes32 indexed id, uint64 emailTimestamp);
    event EpochRolled(uint64 indexed epochIndex, bytes32 nonce);
    event DeathClaimed(
        bytes32 indexed id,
        address indexed claimant,
        uint64 deathNoticeTime,
        uint64 challengeEnds,
        bool presumed
    );
    event DeathRefuted(bytes32 indexed id, address indexed claimant, uint96 slashedBond);
    event DeathFinalized(bytes32 indexed id, address indexed claimant);

    error WrongPattern();
    error DomainNotAllowed();
    error AlreadyEnrolled();
    error IdentityTaken();
    error NotEnrolled();
    error InvalidProof();
    error WrongIdentity();
    error StaleEmail();
    error FutureEmail();
    error NotAlive();
    error NotClaimed();
    error ClaimPending();
    error WrongBond();
    error DeathEmailReused();
    error NoticePredatesLife();
    error NotLapsedLongEnough();
    error WindowStillOpen();
    error WindowClosed();
    error TransferFailed();

    struct Config {
        uint64 heartbeatPeriod;
        uint64 gracePeriod;
        uint64 challengeWindow;
        uint64 presumedDeadAfter;
        uint64 presumedChallengeWindow;
        uint96 deathClaimBond;
        uint96 presumedClaimBond;
    }

    constructor(
        address owner_,
        IZKEmailVerifier verifier_,
        bytes32 enrollPattern_,
        bytes32 lifePattern_,
        bytes32 deathPattern_,
        Config memory cfg
    ) Ownable(owner_) {
        verifier = verifier_;
        enrollPattern = enrollPattern_;
        lifePattern = lifePattern_;
        deathPattern = deathPattern_;
        heartbeatPeriod = cfg.heartbeatPeriod;
        gracePeriod = cfg.gracePeriod;
        challengeWindow = cfg.challengeWindow;
        presumedDeadAfter = cfg.presumedDeadAfter;
        presumedChallengeWindow = cfg.presumedChallengeWindow;
        deathClaimBond = cfg.deathClaimBond;
        presumedClaimBond = cfg.presumedClaimBond;
    }

    // ─────────────────────────── admin ───────────────────────────

    function setDomainRoles(bytes32 domainHash, uint8 roles) external onlyOwner {
        domainRoles[domainHash] = roles;
        emit DomainRolesSet(domainHash, roles);
    }

    // ────────────────────────── epochs ───────────────────────────

    function epochIndexAt(uint64 t) public view returns (uint64) {
        return t / heartbeatPeriod;
    }

    /// @notice Rolls the challenge nonce when a new heartbeat epoch has begun. The
    ///         nonce mixes a post-epoch-start blockhash, so an email containing it
    ///         cannot have been written before the epoch.
    function rollEpoch() public {
        uint64 idx = epochIndexAt(uint64(block.timestamp));
        if (idx != currentEpochIndex || currentEpochNonce == bytes32(0)) {
            currentEpochIndex = idx;
            currentEpochNonce =
                keccak256(abi.encode(blockhash(block.number - 1), address(this), idx));
            currentEpochNonceSetAt = uint64(block.timestamp);
            emit EpochRolled(idx, currentEpochNonce);
        }
    }

    // ───────────────────────── enrollment ─────────────────────────

    /// @notice Binds msg.sender to the email identity proven by an enrollment email
    ///         from an identity-anchor domain. One identity, one wallet, forever
    ///         (rebindable via a fresh proof of the same mailbox).
    function enroll(EmailProof calldata p) external {
        if (p.patternHash != enrollPattern) revert WrongPattern();
        if (domainRoles[p.domainHash] & DomainRoles.IDENTITY == 0) revert DomainNotAllowed();
        if (idOf[msg.sender] != bytes32(0)) revert AlreadyEnrolled();
        Record storage r = records[p.nullifier];
        if (r.status != Status.None) revert IdentityTaken();
        uint64 notBefore = block.timestamp > 30 days ? uint64(block.timestamp - 30 days) : 0;
        _checkEmailTime(p.emailTimestamp, notBefore);
        if (!verifier.verify(p, uint256(uint160(msg.sender)))) revert InvalidProof();

        r.status = Status.Alive;
        r.wallet = msg.sender;
        r.enrolledAt = uint64(block.timestamp);
        r.lastLifeProof = p.emailTimestamp;
        idOf[msg.sender] = p.nullifier;
        emit Enrolled(p.nullifier, msg.sender, p.emailTimestamp);
    }

    /// @notice Moves an identity to a new wallet by re-proving control of the same
    ///         mailbox. Lost keys must not be fatal in a decades-long instrument.
    ///         Blocked while a death claim is pending (an heir must not dodge a
    ///         claim by rotating wallets — refutation requires a life proof anyway).
    function rebindWallet(EmailProof calldata p) external {
        if (p.patternHash != enrollPattern) revert WrongPattern();
        if (domainRoles[p.domainHash] & DomainRoles.IDENTITY == 0) revert DomainNotAllowed();
        if (idOf[msg.sender] != bytes32(0)) revert AlreadyEnrolled();
        Record storage r = records[p.nullifier];
        if (r.status != Status.Alive) revert NotAlive();
        _checkEmailTime(p.emailTimestamp, r.lastLifeProof);
        if (!verifier.verify(p, uint256(uint160(msg.sender)))) revert InvalidProof();

        address old = r.wallet;
        delete idOf[old];
        r.wallet = msg.sender;
        r.lastLifeProof = p.emailTimestamp;
        idOf[msg.sender] = p.nullifier;
        emit WalletRebound(p.nullifier, old, msg.sender);
    }

    // ───────────────────────── heartbeats ─────────────────────────

    /// @notice Challenge-response proof of life: an email the member *sent* whose
    ///         Subject carries the current epoch nonce, DKIM-signed by their own
    ///         provider (which must hold the LIFE role).
    function proveLife(EmailProof calldata p) external {
        bytes32 id = idOf[msg.sender];
        if (id == bytes32(0)) revert NotEnrolled();
        Record storage r = records[id];
        if (r.status == Status.DeathClaimed) revert ClaimPending(); // use refuteDeath
        if (r.status != Status.Alive) revert NotAlive();
        _acceptLifeProof(r, id, p);
        emit LifeProven(id, p.emailTimestamp);
    }

    /// @notice Refutes a pending death claim with a life proof fresher than the
    ///         claimed moment of death. The claimant's bond goes to the member.
    function refuteDeath(EmailProof calldata p) external nonReentrant {
        bytes32 id = idOf[msg.sender];
        if (id == bytes32(0)) revert NotEnrolled();
        Record storage r = records[id];
        if (r.status != Status.DeathClaimed) revert NotClaimed();
        if (block.timestamp > r.challengeEnds) revert WindowClosed();
        if (p.emailTimestamp <= r.deathNoticeTime) revert StaleEmail();
        _acceptLifeProof(r, id, p);

        address claimant = r.claimant;
        uint96 bond = r.bond;
        r.status = Status.Alive;
        r.claimant = address(0);
        r.bond = 0;
        r.claimedAt = 0;
        r.deathNoticeTime = 0;
        r.challengeEnds = 0;
        emit DeathRefuted(id, claimant, bond);
        emit LifeProven(id, p.emailTimestamp);

        (bool ok,) = msg.sender.call{value: bond}("");
        if (!ok) revert TransferFailed();
    }

    function _acceptLifeProof(Record storage r, bytes32 id, EmailProof calldata p) internal {
        if (p.patternHash != lifePattern) revert WrongPattern();
        if (domainRoles[p.domainHash] & DomainRoles.LIFE == 0) revert DomainNotAllowed();
        // The circuit outputs the SENDER's identity nullifier — it must be the
        // member's own mailbox, not just any mailbox on an allowlisted provider.
        if (p.nullifier != id) revert WrongIdentity();
        rollEpoch();
        // The nonce was only observable after currentEpochNonceSetAt; an email
        // predating it cannot honestly contain it. (The circuit binds the nonce to
        // the Subject; the contract binds the timestamps.)
        if (p.emailTimestamp < currentEpochNonceSetAt) revert StaleEmail();
        if (p.emailTimestamp <= r.lastLifeProof) revert StaleEmail();
        _checkEmailTime(p.emailTimestamp, 0);
        if (!verifier.verify(p, uint256(currentEpochNonce))) revert InvalidProof();
        r.lastLifeProof = p.emailTimestamp;
    }

    // ──────────────────────── death claims ────────────────────────

    /// @notice Opens a bonded death claim backed by a zkEmail death notification
    ///         from an allowlisted death-proxy institution (funeral home, cemetery,
    ///         insurer bereavement desk…). The circuit proves the notification
    ///         references the member's identity; the id is the sixth public input.
    function claimDeath(bytes32 id, EmailProof calldata p) external payable {
        Record storage r = records[id];
        if (r.status != Status.Alive) revert NotAlive();
        if (msg.value != deathClaimBond) revert WrongBond();
        if (p.patternHash != deathPattern) revert WrongPattern();
        if (domainRoles[p.domainHash] & DomainRoles.DEATH == 0) revert DomainNotAllowed();
        if (usedDeathEmails[p.nullifier]) revert DeathEmailReused();
        usedDeathEmails[p.nullifier] = true;
        _checkEmailTime(p.emailTimestamp, 0);
        if (p.emailTimestamp <= r.lastLifeProof) revert NoticePredatesLife();
        if (!verifier.verify(p, uint256(id))) revert InvalidProof();

        _openClaim(r, id, p.emailTimestamp, challengeWindow, uint96(msg.value), false);
    }

    /// @notice Presumed death: no email trail, just a deep lapse. Larger bond and a
    ///         longer challenge window. Covers members who die leaving no
    ///         institutional notification (and punishes lazy false claimants).
    function claimPresumedDeath(bytes32 id) external payable {
        Record storage r = records[id];
        if (r.status != Status.Alive) revert NotAlive();
        if (msg.value != presumedClaimBond) revert WrongBond();
        if (block.timestamp < uint256(r.lastLifeProof) + presumedDeadAfter) {
            revert NotLapsedLongEnough();
        }
        _openClaim(r, id, r.lastLifeProof, presumedChallengeWindow, uint96(msg.value), true);
    }

    function _openClaim(
        Record storage r,
        bytes32 id,
        uint64 noticeTime,
        uint64 window,
        uint96 bond,
        bool presumed
    ) internal {
        r.status = Status.DeathClaimed;
        r.claimant = msg.sender;
        r.bond = bond;
        r.claimedAt = uint64(block.timestamp);
        r.deathNoticeTime = noticeTime;
        r.challengeEnds = uint64(block.timestamp) + window;
        emit DeathClaimed(id, msg.sender, noticeTime, r.challengeEnds, presumed);
    }

    /// @notice Closes an unchallenged claim. The bond returns to the claimant, who
    ///         also becomes the bounty recipient in every pool the member joined.
    function finalizeDeath(bytes32 id) external nonReentrant {
        Record storage r = records[id];
        if (r.status != Status.DeathClaimed) revert NotClaimed();
        if (block.timestamp <= r.challengeEnds) revert WindowStillOpen();

        r.status = Status.Dead;
        address claimant = r.claimant;
        uint96 bond = r.bond;
        r.bond = 0;
        emit DeathFinalized(id, claimant);

        (bool ok,) = claimant.call{value: bond}("");
        if (!ok) revert TransferFailed();
    }

    // ─────────────────────────── views ───────────────────────────

    function _checkEmailTime(uint64 emailTimestamp, uint64 notBefore) internal view {
        if (emailTimestamp > block.timestamp + MAX_TIMESTAMP_SKEW) revert FutureEmail();
        if (notBefore != 0 && emailTimestamp < notBefore) revert StaleEmail();
    }

    function statusOf(bytes32 id) external view returns (Status) {
        return records[id].status;
    }

    function isDead(bytes32 id) external view returns (bool) {
        return records[id].status == Status.Dead;
    }

    /// @notice Alive AND heartbeat-current. Pools gate income withdrawals on this,
    ///         which is what makes heartbeats worth sending.
    function isInGoodStanding(bytes32 id) public view returns (bool) {
        Record storage r = records[id];
        return r.status == Status.Alive
            && block.timestamp <= uint256(r.lastLifeProof) + heartbeatPeriod + gracePeriod;
    }

    /// @notice Alive but heartbeat-stale: payouts pause, nothing is forfeited.
    function isLapsed(bytes32 id) external view returns (bool) {
        Record storage r = records[id];
        return r.status == Status.Alive && !isInGoodStanding(id);
    }

    function claimantOf(bytes32 id) external view returns (address) {
        return records[id].claimant;
    }

    function walletOf(bytes32 id) external view returns (address) {
        return records[id].wallet;
    }
}
