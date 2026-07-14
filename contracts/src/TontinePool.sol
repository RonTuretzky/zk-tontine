// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LifeOracle} from "./LifeOracle.sol";

/// @notice One closed tontine cohort. Contributions sit in sDAI (yield accrues to
///         the share price); verified deaths release the deceased's estate as
///         mortality credits to survivors, weighted by Sabin's fair transfer plan
///         (weight ∝ mortality-rate × stake × non-bequest fraction), so mixed-age,
///         mixed-stake pools stay actuarially fair. After lock, members draw a
///         monthly lifetime income capped by an age-banded annuitization rate —
///         gated on a current proof-of-life, which is what makes heartbeats matter.
///
///         Anti-fraud economics: every finalized death pays the death-claimant a
///         bounty from the estate, so concealing a death (heir fraud) is a race
///         against anyone who can produce the notification email. The classic
///         murder incentive is blunted by stake caps (no member's death moves the
///         pool much) and by pseudonymity (members are email-hash nullifiers, not
///         names).
contract TontinePool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant RAY = 1e27;
    uint256 private constant BPS = 1e4;
    uint256 private constant SECONDS_PER_YEAR = 31_557_600; // 365.25 days
    uint256 private constant MONTH = 30 days;
    uint16 public constant MAX_BEQUEST_BPS = 5000; // a tontine needs mortality credits
    uint32 public constant MAX_BACKDRAW_MONTHS = 12;

    struct MemberAcct {
        bool exists;
        bool settled;
        uint16 bequestBps;
        uint16 qBps; //          annual mortality probability, refreshed as age advances
        uint32 monthsDrawn; //   income months already taken since lock
        uint64 birthYear;
        address beneficiary;
        uint256 principal; //    sDAI shares from contribution
        uint256 credits; //      sDAI shares harvested from mortality credits
        uint256 weight; //       qBps · principal · (1 − bequest) — fair-transfer weight
        uint256 creditDebt; //   accumulator debt, RAY-scaled
    }

    struct Params {
        string name;
        uint64 lockTime; //      enrollment closes and income phase begins
        uint256 minJoinAssets; // WXDAI terms
        uint256 maxJoinAssets; // stake cap — murder-incentive + whale mitigation
        uint32 maxMembers;
        uint16 bountyBps; //     of estate, to the death claimant
        address treasury; //     residue sink of last resort
    }

    LifeOracle public immutable oracle;
    IERC4626 public immutable sdai;
    IERC20 public immutable wxdai;

    string public name;
    uint64 public immutable lockTime;
    uint256 public immutable minJoinAssets;
    uint256 public immutable maxJoinAssets;
    uint32 public immutable maxMembers;
    uint16 public immutable bountyBps;
    address public immutable treasury;

    mapping(bytes32 id => MemberAcct) public members;
    bytes32[] public memberIds;
    uint32 public livingMembers;
    uint256 public totalWeight;
    uint256 public accCreditRay; // credited sDAI shares per unit weight, RAY-scaled

    event Joined(
        bytes32 indexed id, address indexed wallet, uint256 shares, uint64 birthYear, uint16 qBps
    );
    event Exited(bytes32 indexed id, uint256 shares);
    event MortalityRefreshed(bytes32 indexed id, uint16 qBps, uint256 weight);
    event DeathSettled(
        bytes32 indexed id, uint256 estate, uint256 bounty, uint256 bequest, uint256 credits
    );
    event IncomeWithdrawn(bytes32 indexed id, address indexed to, uint256 shares, uint32 months);
    event BeneficiarySet(bytes32 indexed id, address beneficiary);

    error NotEnrolled();
    error NotGoodStanding();
    error AlreadyJoined();
    error NotMember();
    error AlreadySettled();
    error PoolLocked();
    error PoolNotLocked();
    error PoolFull();
    error ContributionOutOfBounds();
    error BequestTooLarge();
    error BadBirthYear();
    error NotDeadYet();
    error NothingToDraw();
    error DrawTooLarge();

    constructor(LifeOracle oracle_, IERC4626 sdai_, IERC20 wxdai_, Params memory p) {
        oracle = oracle_;
        sdai = sdai_;
        wxdai = wxdai_;
        name = p.name;
        lockTime = p.lockTime;
        minJoinAssets = p.minJoinAssets;
        maxJoinAssets = p.maxJoinAssets;
        maxMembers = p.maxMembers;
        bountyBps = p.bountyBps;
        treasury = p.treasury;
        wxdai_.forceApprove(address(sdai_), type(uint256).max);
    }

    // ─────────────────────────── joining ───────────────────────────

    function isLocked() public view returns (bool) {
        return block.timestamp >= lockTime;
    }

    /// @notice Join with WXDAI (deposited into sDAI) before the cohort locks.
    function join(uint256 assets, uint64 birthYear, uint16 bequestBps, address beneficiary)
        external
        nonReentrant
    {
        wxdai.safeTransferFrom(msg.sender, address(this), assets);
        uint256 shares = sdai.deposit(assets, address(this));
        _join(assets, shares, birthYear, bequestBps, beneficiary);
    }

    /// @notice Join with sDAI shares directly.
    function joinWithSDai(uint256 shares, uint64 birthYear, uint16 bequestBps, address beneficiary)
        external
        nonReentrant
    {
        IERC20(address(sdai)).safeTransferFrom(msg.sender, address(this), shares);
        _join(sdai.convertToAssets(shares), shares, birthYear, bequestBps, beneficiary);
    }

    function _join(
        uint256 assets,
        uint256 shares,
        uint64 birthYear,
        uint16 bequestBps,
        address beneficiary
    ) internal {
        if (isLocked()) revert PoolLocked();
        if (memberIds.length >= maxMembers) revert PoolFull();
        if (assets < minJoinAssets || assets > maxJoinAssets) revert ContributionOutOfBounds();
        if (bequestBps > MAX_BEQUEST_BPS) revert BequestTooLarge();

        bytes32 id = oracle.idOf(msg.sender);
        if (id == bytes32(0)) revert NotEnrolled();
        if (!oracle.isInGoodStanding(id)) revert NotGoodStanding();
        MemberAcct storage m = members[id];
        if (m.exists) revert AlreadyJoined();

        uint256 age = _ageOf(birthYear);
        if (age < 18 || age > 100) revert BadBirthYear();
        uint16 q = qBpsForAge(age);
        uint256 w = _weight(shares, q, bequestBps);

        m.exists = true;
        m.birthYear = birthYear;
        m.bequestBps = bequestBps;
        m.beneficiary = beneficiary;
        m.qBps = q;
        m.principal = shares;
        m.weight = w;
        m.creditDebt = (accCreditRay * w) / RAY;
        memberIds.push(id);
        livingMembers += 1;
        totalWeight += w;
        emit Joined(id, msg.sender, shares, birthYear, q);
    }

    /// @notice Full refund while the cohort is still enrolling. Irrevocable after
    ///         lock — late surrender would let the healthy adversely select out.
    function exit() external nonReentrant {
        if (isLocked()) revert PoolLocked();
        bytes32 id = oracle.idOf(msg.sender);
        MemberAcct storage m = members[id];
        if (!m.exists || m.settled) revert NotMember();

        uint256 shares = m.principal;
        totalWeight -= m.weight;
        livingMembers -= 1;
        m.settled = true;
        m.principal = 0;
        m.weight = 0;
        emit Exited(id, shares);
        IERC20(address(sdai)).safeTransfer(msg.sender, shares);
    }

    function setBeneficiary(address beneficiary) external {
        bytes32 id = oracle.idOf(msg.sender);
        MemberAcct storage m = members[id];
        if (!m.exists || m.settled) revert NotMember();
        m.beneficiary = beneficiary;
        emit BeneficiarySet(id, beneficiary);
    }

    // ─────────────────────── mortality credits ───────────────────────

    /// @notice Releases a finalized death into the pool: bounty → claimant,
    ///         bequest → beneficiary, remainder → survivors' mortality credits by
    ///         fair-transfer weight. Anyone may call (the claimant wants to).
    function settleDeath(bytes32 id) external nonReentrant {
        MemberAcct storage m = members[id];
        if (!m.exists) revert NotMember();
        if (m.settled) revert AlreadySettled();
        if (!oracle.isDead(id)) revert NotDeadYet();

        _harvest(m); // credits accrued up to settlement still belong to the estate
        totalWeight -= m.weight;
        livingMembers -= 1;

        uint256 estate = m.principal + m.credits;
        m.settled = true;
        m.principal = 0;
        m.credits = 0;
        m.weight = 0;

        uint256 bounty = (estate * bountyBps) / BPS;
        address claimant = oracle.claimantOf(id);
        if (claimant == address(0)) bounty = 0;

        uint256 bequest;
        address beneficiary = m.beneficiary;
        if (!isLocked()) {
            // Pre-lock death: the tontine never started for this cohort — treat as
            // a refund. Everything (net of bounty) goes back out.
            bequest = estate - bounty;
            if (beneficiary == address(0)) beneficiary = oracle.walletOf(id);
        } else if (beneficiary != address(0)) {
            bequest = ((estate - bounty) * m.bequestBps) / BPS;
        }

        uint256 credits = estate - bounty - bequest;
        if (credits > 0) {
            if (totalWeight > 0) {
                accCreditRay += (credits * RAY) / totalWeight;
            } else if (beneficiary != address(0)) {
                bequest += credits; // no survivors: estate follows the bequest
            } else {
                IERC20(address(sdai)).safeTransfer(treasury, credits);
            }
        }
        emit DeathSettled(id, estate, bounty, bequest, estate - bounty - bequest);

        if (bounty > 0) IERC20(address(sdai)).safeTransfer(claimant, bounty);
        if (bequest > 0) IERC20(address(sdai)).safeTransfer(beneficiary, bequest);
    }

    /// @notice Re-banding as members age keeps the fair transfer plan fair. Anyone
    ///         may refresh anyone (keepers, the frontend, other members).
    function refreshMortality(bytes32 id) public {
        MemberAcct storage m = members[id];
        if (!m.exists || m.settled) revert NotMember();
        _harvest(m);
        uint16 q = qBpsForAge(_ageOf(m.birthYear));
        uint256 w = _weight(m.principal, q, m.bequestBps);
        totalWeight = totalWeight - m.weight + w;
        m.qBps = q;
        m.weight = w;
        m.creditDebt = (accCreditRay * w) / RAY;
        emit MortalityRefreshed(id, q, w);
    }

    function _harvest(MemberAcct storage m) internal {
        uint256 pending = (accCreditRay * m.weight) / RAY - m.creditDebt;
        if (pending > 0) m.credits += pending;
        m.creditDebt = (accCreditRay * m.weight) / RAY;
    }

    /// @dev Sabin–Fullmer nominal-gain weight: the fair share of each forfeiture is
    ///      proportional to s·q/(1−q) (the member's nominal tontine yield times
    ///      stake), scaled by the pooled fraction (1−bequest) per Bernhardt–
    ///      Donnelly. The accumulator normalizes per death event, which is exactly
    ///      the group-gain factor G of the nominal-gain method applied per event.
    function _weight(uint256 principalShares, uint16 qBps, uint16 bequestBps)
        internal
        pure
        returns (uint256)
    {
        return (principalShares * qBps * (BPS - bequestBps)) / (uint256(BPS - qBps) * BPS);
    }

    // ───────────────────────── income phase ─────────────────────────

    /// @notice Monthly lifetime income, capped by the age-banded annuitization
    ///         rate. Requires a current proof-of-life — a lapsed member's income
    ///         simply waits (up to MAX_BACKDRAW_MONTHS accrue) until they return.
    function withdrawIncome(uint256 shares) external nonReentrant {
        if (!isLocked()) revert PoolNotLocked();
        bytes32 id = oracle.idOf(msg.sender);
        MemberAcct storage m = members[id];
        if (!m.exists || m.settled) revert NotMember();
        if (!oracle.isInGoodStanding(id)) revert NotGoodStanding();

        refreshMortality(id); // harvests + re-bands

        uint32 elapsed = uint32((block.timestamp - lockTime) / MONTH) + 1;
        if (elapsed <= m.monthsDrawn) revert NothingToDraw();
        uint32 months = elapsed - m.monthsDrawn;
        if (months > MAX_BACKDRAW_MONTHS) months = MAX_BACKDRAW_MONTHS;

        uint256 balance = m.principal + m.credits;
        uint256 cap = (balance * payoutRateBpsForAge(_ageOf(m.birthYear)) * months) / (12 * BPS);
        if (shares > cap) revert DrawTooLarge();
        m.monthsDrawn = elapsed;

        // Draw credits first; principal reduction shrinks the fair-transfer weight.
        uint256 fromCredits = shares <= m.credits ? shares : m.credits;
        m.credits -= fromCredits;
        uint256 fromPrincipal = shares - fromCredits;
        if (fromPrincipal > 0) {
            m.principal -= fromPrincipal;
            uint256 w = _weight(m.principal, m.qBps, m.bequestBps);
            totalWeight = totalWeight - m.weight + w;
            m.weight = w;
            m.creditDebt = (accCreditRay * w) / RAY;
        }
        emit IncomeWithdrawn(id, msg.sender, shares, months);
        IERC20(address(sdai)).safeTransfer(msg.sender, shares);
    }

    // ─────────────────────────── tables ───────────────────────────
    // Annual mortality probability (unisex period-table approximation) and
    // annuitization payout rates, in basis points, by age band. Constants chosen
    // from public period life tables; see docs/SPEC.md for sources and rationale.

    function qBpsForAge(uint256 age) public pure returns (uint16) {
        if (age < 25) return 8;
        if (age < 30) return 10;
        if (age < 35) return 12;
        if (age < 40) return 16;
        if (age < 45) return 22;
        if (age < 50) return 33;
        if (age < 55) return 50;
        if (age < 60) return 78;
        if (age < 65) return 120;
        if (age < 70) return 180;
        if (age < 75) return 280;
        if (age < 80) return 450;
        if (age < 85) return 750;
        if (age < 90) return 1300;
        if (age < 95) return 2200;
        return 3500;
    }

    function payoutRateBpsForAge(uint256 age) public pure returns (uint16) {
        if (age < 60) return 400;
        if (age < 65) return 500;
        if (age < 70) return 560;
        if (age < 75) return 650;
        if (age < 80) return 800;
        if (age < 85) return 1000;
        if (age < 90) return 1300;
        return 1800;
    }

    function _ageOf(uint64 birthYear) internal view returns (uint256) {
        uint256 nowYear = 1970 + block.timestamp / SECONDS_PER_YEAR;
        if (birthYear >= nowYear) return 0;
        return nowYear - birthYear;
    }

    // ─────────────────────────── views ───────────────────────────

    function memberCount() external view returns (uint256) {
        return memberIds.length;
    }

    function balanceOf(bytes32 id) public view returns (uint256) {
        MemberAcct storage m = members[id];
        if (!m.exists || m.settled) return 0;
        uint256 pending = (accCreditRay * m.weight) / RAY - m.creditDebt;
        return m.principal + m.credits + pending;
    }

    function balanceInAssets(bytes32 id) external view returns (uint256) {
        return sdai.convertToAssets(balanceOf(id));
    }

    /// @notice The member's current monthly income cap, in sDAI shares.
    function monthlyIncomeOf(bytes32 id) external view returns (uint256) {
        MemberAcct storage m = members[id];
        if (!m.exists || m.settled) return 0;
        return (balanceOf(id) * payoutRateBpsForAge(_ageOf(m.birthYear))) / (12 * BPS);
    }

    function poolTotalShares() external view returns (uint256) {
        return sdai.balanceOf(address(this));
    }

    function poolTotalAssets() external view returns (uint256) {
        return sdai.convertToAssets(sdai.balanceOf(address(this)));
    }

    function allMemberIds() external view returns (bytes32[] memory) {
        return memberIds;
    }
}
