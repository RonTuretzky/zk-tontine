// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {LifeOracle} from "../src/LifeOracle.sol";
import {TontinePool} from "../src/TontinePool.sol";
import {MockWxdai} from "../src/mocks/MockSDai.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TontinePoolJoinTest is BaseTest {
    function test_join_happy() public {
        bytes32 id = enroll(alice, "alice@example.com");
        join(alice, 100 ether, birthYearForAge(70), 0, address(0));
        assertEq(d.pool.memberCount(), 1);
        assertEq(d.pool.livingMembers(), 1);
        assertGt(d.pool.balanceOf(id), 0);
        // 70-year-old: qBps 280, weight = s·q/(1e4−q)
        (,, uint16 bequestBps, uint16 qBps,,,,,,,) = d.pool.members(id);
        assertEq(qBps, 280);
        assertEq(bequestBps, 0);
    }

    function test_join_requiresEnrollment() public {
        MockWxdai(address(d.wxdai)).mint(alice, 100 ether);
        vm.startPrank(alice);
        d.wxdai.approve(address(d.pool), 100 ether);
        vm.expectRevert(TontinePool.NotEnrolled.selector);
        d.pool.join(100 ether, birthYearForAge(70), 0, address(0));
        vm.stopPrank();
    }

    function test_join_requiresGoodStanding() public {
        // fresh pool with a distant lock so the lapse (not the lock) is what bites
        TontinePool pool2 = d.factory
            .createPool(
                TontinePool.Params({
                    name: "Slow Cohort",
                    lockTime: uint64(block.timestamp + 30 days),
                    minJoinAssets: 1 ether,
                    maxJoinAssets: 10_000 ether,
                    maxMembers: 100,
                    bountyBps: 200,
                    treasury: address(this)
                })
            );
        enroll(alice, "alice@example.com");
        vm.warp(block.timestamp + 46 minutes); // lapse (30m + 15m grace)
        MockWxdai(address(d.wxdai)).mint(alice, 100 ether);
        vm.startPrank(alice);
        d.wxdai.approve(address(pool2), 100 ether);
        vm.expectRevert(TontinePool.NotGoodStanding.selector);
        pool2.join(100 ether, birthYearForAge(70), 0, address(0));
        vm.stopPrank();
    }

    function test_join_enforcesBounds() public {
        enroll(alice, "alice@example.com");
        MockWxdai(address(d.wxdai)).mint(alice, 20_000 ether);
        vm.startPrank(alice);
        d.wxdai.approve(address(d.pool), 20_000 ether);
        vm.expectRevert(TontinePool.ContributionOutOfBounds.selector);
        d.pool.join(0.5 ether, birthYearForAge(70), 0, address(0)); // < 1 demo min
        vm.expectRevert(TontinePool.ContributionOutOfBounds.selector);
        d.pool.join(10_001 ether, birthYearForAge(70), 0, address(0)); // > demo max
        vm.stopPrank();
    }

    function test_join_rejectsDoubleJoin() public {
        enroll(alice, "alice@example.com");
        join(alice, 100 ether, birthYearForAge(70), 0, address(0));
        MockWxdai(address(d.wxdai)).mint(alice, 100 ether);
        vm.startPrank(alice);
        d.wxdai.approve(address(d.pool), 100 ether);
        vm.expectRevert(TontinePool.AlreadyJoined.selector);
        d.pool.join(100 ether, birthYearForAge(70), 0, address(0));
        vm.stopPrank();
    }

    function test_join_rejectsAfterLock() public {
        enroll(alice, "alice@example.com");
        vm.warp(d.pool.lockTime());
        heartbeatSafe(alice);
        MockWxdai(address(d.wxdai)).mint(alice, 100 ether);
        vm.startPrank(alice);
        d.wxdai.approve(address(d.pool), 100 ether);
        vm.expectRevert(TontinePool.PoolLocked.selector);
        d.pool.join(100 ether, birthYearForAge(70), 0, address(0));
        vm.stopPrank();
    }

    function test_join_rejectsBequestOverCap() public {
        enroll(alice, "alice@example.com");
        MockWxdai(address(d.wxdai)).mint(alice, 100 ether);
        vm.startPrank(alice);
        d.wxdai.approve(address(d.pool), 100 ether);
        vm.expectRevert(TontinePool.BequestTooLarge.selector);
        d.pool.join(100 ether, birthYearForAge(70), 5001, bob);
        vm.stopPrank();
    }

    function test_joinWithSDai() public {
        bytes32 id = enroll(alice, "alice@example.com");
        MockWxdai(address(d.wxdai)).mint(alice, 100 ether);
        vm.startPrank(alice);
        d.wxdai.approve(address(d.sdai), 100 ether);
        uint256 shares = d.sdai.deposit(100 ether, alice);
        IERC20(address(d.sdai)).approve(address(d.pool), shares);
        d.pool.joinWithSDai(shares, birthYearForAge(65), 0, address(0));
        vm.stopPrank();
        assertEq(d.pool.balanceOf(id), shares);
    }

    function test_exit_refundsBeforeLock() public {
        bytes32 id = enroll(alice, "alice@example.com");
        join(alice, 100 ether, birthYearForAge(70), 0, address(0));
        vm.prank(alice);
        d.pool.exit();
        assertEq(d.pool.balanceOf(id), 0);
        assertEq(d.pool.livingMembers(), 0);
        assertGt(IERC20(address(d.sdai)).balanceOf(alice), 0);
    }

    function test_exit_rejectsAfterLock() public {
        enroll(alice, "alice@example.com");
        join(alice, 100 ether, birthYearForAge(70), 0, address(0));
        vm.warp(d.pool.lockTime());
        vm.prank(alice);
        vm.expectRevert(TontinePool.PoolLocked.selector);
        d.pool.exit();
    }

    function heartbeatSafe(address who) internal {
        bytes32 id = d.oracle.idOf(who);
        vm.prank(who);
        d.oracle.proveLife(mkProof(GMAIL, LIFE, id, uint64(block.timestamp)));
    }
}

contract TontinePoolDeathTest is BaseTest {
    bytes32 internal aliceId;
    bytes32 internal bobId;
    bytes32 internal carolId;

    function setUp() public override {
        super.setUp();
        aliceId = enroll(alice, "alice@example.com");
        bobId = enroll(bob, "bob@example.com");
        carolId = enroll(carol, "carol@example.com");
    }

    function test_settleDeath_fairSplitByNominalGainWeight() public {
        // bob (60) and carol (80) survive alice (70). Same stakes; carol's
        // q/(1−q) is higher, so she must receive the larger share (Sabin–Fullmer).
        join(alice, 1000 ether, birthYearForAge(70), 0, address(0));
        join(bob, 1000 ether, birthYearForAge(60), 0, address(0));
        join(carol, 1000 ether, birthYearForAge(80), 0, address(0));
        vm.warp(d.pool.lockTime() + 1); // credits flow only once the cohort locks

        uint256 aliceEstate = d.pool.balanceOf(aliceId);
        killMember(alice, dave);
        d.pool.settleDeath(aliceId);

        uint256 bounty = (aliceEstate * 200) / 10_000;
        uint256 creditsPool = aliceEstate - bounty;

        uint256 bobGain = d.pool.balanceOf(bobId) - 1000 ether;
        uint256 carolGain = d.pool.balanceOf(carolId) - 1000 ether;

        // weights: q=120 → 120/9880; q=750 → 750/9250
        uint256 wBob = (uint256(1000 ether) * 120) / 9880;
        uint256 wCarol = (uint256(1000 ether) * 750) / 9250;
        assertApproxEqRel(bobGain, (creditsPool * wBob) / (wBob + wCarol), 1e12);
        assertApproxEqRel(carolGain, (creditsPool * wCarol) / (wBob + wCarol), 1e12);
        // everything is conserved (dust stays in the pool)
        assertLe(bobGain + carolGain, creditsPool);
        assertApproxEqAbs(bobGain + carolGain, creditsPool, 10);
    }

    function test_settleDeath_paysBountyToClaimant() public {
        join(alice, 1000 ether, birthYearForAge(70), 0, address(0));
        join(bob, 1000 ether, birthYearForAge(60), 0, address(0));
        uint256 aliceEstate = d.pool.balanceOf(aliceId);
        killMember(alice, dave);
        d.pool.settleDeath(aliceId);
        assertEq(IERC20(address(d.sdai)).balanceOf(dave), (aliceEstate * 200) / 10_000);
    }

    function test_settleDeath_respectsBequest() public {
        join(alice, 1000 ether, birthYearForAge(70), 4000, dave); // 40% bequest
        join(bob, 1000 ether, birthYearForAge(60), 0, address(0));
        // lock so the bequest split (not the pre-lock refund) applies
        vm.warp(d.pool.lockTime() + 1);
        uint256 aliceEstate = d.pool.balanceOf(aliceId);
        killMember(alice, carol);
        d.pool.settleDeath(aliceId);

        uint256 bounty = (aliceEstate * 200) / 10_000;
        uint256 bequest = ((aliceEstate - bounty) * 4000) / 10_000;
        assertEq(IERC20(address(d.sdai)).balanceOf(dave), bequest);
        assertApproxEqAbs(
            d.pool.balanceOf(bobId), 1000 ether + (aliceEstate - bounty - bequest), 10
        );
    }

    function test_settleDeath_preLockRefundsEverything() public {
        join(alice, 1000 ether, birthYearForAge(70), 1000, dave);
        join(bob, 1000 ether, birthYearForAge(60), 0, address(0));
        uint256 aliceEstate = d.pool.balanceOf(aliceId);
        killMember(alice, carol);
        d.pool.settleDeath(aliceId); // still pre-lock
        uint256 bounty = (aliceEstate * 200) / 10_000;
        // beneficiary gets the whole estate net of bounty, not just 10%
        assertEq(IERC20(address(d.sdai)).balanceOf(dave), aliceEstate - bounty);
        assertEq(d.pool.balanceOf(bobId), 1000 ether); // no credits pre-lock
    }

    function test_settleDeath_lastSurvivorTakesAll() public {
        join(alice, 1000 ether, birthYearForAge(70), 0, address(0));
        join(bob, 1000 ether, birthYearForAge(60), 0, address(0));
        vm.warp(d.pool.lockTime() + 1);
        uint256 aliceEstate = d.pool.balanceOf(aliceId);
        killMember(alice, dave);
        d.pool.settleDeath(aliceId);
        uint256 bounty = (aliceEstate * 200) / 10_000;
        assertApproxEqAbs(d.pool.balanceOf(bobId), 2000 ether - bounty, 10);

        // bob dies too — no survivors; his estate follows his (unset) beneficiary
        // to the treasury
        killMember(bob, dave);
        uint256 treasuryBefore = IERC20(address(d.sdai)).balanceOf(address(this));
        d.pool.settleDeath(bobId);
        assertGt(IERC20(address(d.sdai)).balanceOf(address(this)), treasuryBefore);
    }

    function test_settleDeath_rejectsLivingMember() public {
        join(alice, 1000 ether, birthYearForAge(70), 0, address(0));
        vm.expectRevert(TontinePool.NotDeadYet.selector);
        d.pool.settleDeath(aliceId);
    }

    function test_settleDeath_rejectsDoubleSettle() public {
        join(alice, 1000 ether, birthYearForAge(70), 0, address(0));
        join(bob, 1000 ether, birthYearForAge(60), 0, address(0));
        killMember(alice, dave);
        d.pool.settleDeath(aliceId);
        vm.expectRevert(TontinePool.AlreadySettled.selector);
        d.pool.settleDeath(aliceId);
    }

    function test_yieldAccruesThroughShares() public {
        join(alice, 1000 ether, birthYearForAge(70), 0, address(0));
        // simulate sDAI yield: donate WXDAI to the vault → share price rises
        MockWxdai(address(d.wxdai)).mint(address(d.sdai), 100 ether);
        assertGt(d.pool.balanceInAssets(aliceId), 1000 ether);
    }
}

contract TontinePoolIncomeTest is BaseTest {
    bytes32 internal aliceId;
    bytes32 internal bobId;

    function setUp() public override {
        super.setUp();
        aliceId = enroll(alice, "alice@example.com");
        bobId = enroll(bob, "bob@example.com");
        join(alice, 1000 ether, birthYearForAge(70), 0, address(0));
        join(bob, 1000 ether, birthYearForAge(60), 0, address(0));
        vm.warp(d.pool.lockTime() + 1);
        heartbeat(alice);
        heartbeat(bob);
    }

    function test_withdraw_capsAtMonthlyRate() public {
        // age 70 → 650 bps annual → monthly cap = bal·650/(12·10000)
        uint256 cap = d.pool.monthlyIncomeOf(aliceId);
        vm.prank(alice);
        vm.expectRevert(TontinePool.DrawTooLarge.selector);
        d.pool.withdrawIncome(cap + 1e6);
        vm.prank(alice);
        d.pool.withdrawIncome(cap);
        assertEq(IERC20(address(d.sdai)).balanceOf(alice), cap);
    }

    function test_withdraw_oncePerMonth() public {
        uint256 cap = d.pool.monthlyIncomeOf(aliceId);
        vm.prank(alice);
        d.pool.withdrawIncome(cap);
        vm.prank(alice);
        vm.expectRevert(TontinePool.NothingToDraw.selector);
        d.pool.withdrawIncome(1);
        // next month unlocks
        vm.warp(block.timestamp + 30 days);
        heartbeat(alice);
        uint256 cap2 = d.pool.monthlyIncomeOf(aliceId);
        vm.prank(alice);
        d.pool.withdrawIncome(cap2);
    }

    function test_withdraw_requiresGoodStanding() public {
        vm.warp(block.timestamp + 46 minutes); // lapse in demo config
        vm.prank(alice);
        vm.expectRevert(TontinePool.NotGoodStanding.selector);
        d.pool.withdrawIncome(1);
        // heartbeat restores access; missed months accumulate (up to the cap)
        heartbeat(alice);
        vm.prank(alice);
        d.pool.withdrawIncome(1);
    }

    function test_withdraw_drawsCreditsBeforePrincipal() public {
        killMember(bob, dave);
        d.pool.settleDeath(bobId);
        (,,,,,,, uint256 principalBefore,,,) = poolMember(aliceId);
        uint256 cap = d.pool.monthlyIncomeOf(aliceId);
        vm.prank(alice);
        d.pool.withdrawIncome(cap);
        (,,,,,,, uint256 principalAfter,,,) = poolMember(aliceId);
        // credits from bob's death exceed one month's income → principal untouched
        assertEq(principalAfter, principalBefore);
    }

    function poolMember(bytes32 id)
        internal
        view
        returns (
            bool exists,
            bool settled,
            uint16 bequestBps,
            uint16 qBps,
            uint32 monthsDrawn,
            uint64 birthYear,
            address beneficiary,
            uint256 principal,
            uint256 credits,
            uint256 weight,
            uint256 creditDebt
        )
    {
        return d.pool.members(id);
    }

    function test_refreshMortality_rebandsWithAge() public {
        (,,, uint16 qBefore,,,,,,,) = poolMember(aliceId);
        assertEq(qBefore, 280); // age 70
        vm.warp(block.timestamp + 5 * 31_557_600); // five years on
        d.pool.refreshMortality(aliceId);
        (,,, uint16 qAfter,,,,,,,) = poolMember(aliceId);
        assertEq(qAfter, 450); // age 75 band
    }
}

contract TontineFactoryTest is BaseTest {
    function test_createPool_registers() public {
        uint256 before = d.factory.poolCount();
        TontinePool p = d.factory
            .createPool(
                TontinePool.Params({
                    name: "Cohort Two",
                    lockTime: uint64(block.timestamp + 30 days),
                    minJoinAssets: 10 ether,
                    maxJoinAssets: 1000 ether,
                    maxMembers: 100,
                    bountyBps: 100,
                    treasury: address(this)
                })
            );
        assertEq(d.factory.poolCount(), before + 1);
        assertEq(address(d.factory.pools(before)), address(p));
        assertEq(p.bountyBps(), 100);
    }
}
