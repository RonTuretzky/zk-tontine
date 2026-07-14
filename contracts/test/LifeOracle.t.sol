// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {EmailProof, DomainRoles} from "../src/Types.sol";
import {LifeOracle} from "../src/LifeOracle.sol";

contract LifeOracleEnrollTest is BaseTest {
    function test_enroll_happy() public {
        bytes32 id = enroll(alice, "alice@example.com");
        assertEq(d.oracle.idOf(alice), id);
        assertEq(d.oracle.walletOf(id), alice);
        assertTrue(d.oracle.isInGoodStanding(id));
    }

    function test_enroll_rejectsWrongPattern() public {
        vm.expectRevert(LifeOracle.WrongPattern.selector);
        vm.prank(alice);
        d.oracle.enroll(mkProof(GMAIL, LIFE, idFor("a@x"), uint64(block.timestamp)));
    }

    function test_enroll_rejectsDeathDomain() public {
        vm.expectRevert(LifeOracle.DomainNotAllowed.selector);
        vm.prank(alice);
        d.oracle.enroll(mkProof(LEGACY, ENROLL, idFor("a@x"), uint64(block.timestamp)));
    }

    function test_enroll_rejectsUnregisteredDomain() public {
        vm.expectRevert(LifeOracle.DomainNotAllowed.selector);
        vm.prank(alice);
        d.oracle
            .enroll(
                mkProof(keccak256("evil.example"), ENROLL, idFor("a@x"), uint64(block.timestamp))
            );
    }

    function test_enroll_rejectsSecondWallet() public {
        enroll(alice, "alice@example.com");
        vm.expectRevert(LifeOracle.AlreadyEnrolled.selector);
        vm.prank(alice);
        d.oracle.enroll(mkProof(GMAIL, ENROLL, idFor("alice2@x"), uint64(block.timestamp)));
    }

    function test_enroll_rejectsTakenIdentity() public {
        enroll(alice, "shared@example.com");
        vm.expectRevert(LifeOracle.IdentityTaken.selector);
        vm.prank(bob);
        d.oracle
            .enroll(mkProof(GMAIL, ENROLL, idFor("shared@example.com"), uint64(block.timestamp)));
    }

    function test_enroll_rejectsDeadIdentity() public {
        bytes32 id = enroll(alice, "alice@example.com");
        killMember(alice, bob);
        assertTrue(d.oracle.isDead(id));
        vm.expectRevert(LifeOracle.IdentityTaken.selector);
        vm.prank(carol);
        d.oracle.enroll(mkProof(GMAIL, ENROLL, id, uint64(block.timestamp)));
    }

    function test_enroll_rejectsStaleEmail() public {
        vm.expectRevert(LifeOracle.StaleEmail.selector);
        vm.prank(alice);
        d.oracle.enroll(mkProof(GMAIL, ENROLL, idFor("a@x"), uint64(block.timestamp - 31 days)));
    }

    function test_enroll_rejectsFutureEmail() public {
        vm.expectRevert(LifeOracle.FutureEmail.selector);
        vm.prank(alice);
        d.oracle.enroll(mkProof(GMAIL, ENROLL, idFor("a@x"), uint64(block.timestamp + 2 days)));
    }

    function test_enroll_rejectsVetoedProof() public {
        bytes32 id = idFor("a@x");
        EmailProof memory p = mkProof(GMAIL, ENROLL, id, uint64(block.timestamp));
        d.groth16
            .setVetoed(
                [
                    uint256(p.dkimPubkeyHash),
                    uint256(p.domainHash),
                    uint256(p.nullifier),
                    uint256(p.patternHash),
                    uint256(p.emailTimestamp),
                    uint256(uint160(alice))
                ],
                true
            );
        vm.expectRevert(LifeOracle.InvalidProof.selector);
        vm.prank(alice);
        d.oracle.enroll(p);
    }

    function test_enroll_rejectsRevokedDkimKey() public {
        vm.prank(guardian);
        d.dkim.revokeKey(GMAIL, dkimKeyOf(GMAIL));
        vm.expectRevert(LifeOracle.InvalidProof.selector);
        vm.prank(alice);
        d.oracle.enroll(mkProof(GMAIL, ENROLL, idFor("a@x"), uint64(block.timestamp)));
    }

    function test_rebindWallet_movesIdentity() public {
        bytes32 id = enroll(alice, "alice@example.com");
        vm.warp(block.timestamp + 1);
        vm.prank(bob);
        d.oracle.rebindWallet(mkProof(GMAIL, ENROLL, id, uint64(block.timestamp)));
        assertEq(d.oracle.walletOf(id), bob);
        assertEq(d.oracle.idOf(bob), id);
        assertEq(d.oracle.idOf(alice), bytes32(0));
    }

    function test_rebindWallet_blockedDuringClaim() public {
        bytes32 id = enroll(alice, "alice@example.com");
        vm.warp(block.timestamp + 1 minutes);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        d.oracle.claimDeath{value: 0.01 ether}(
            id, mkProof(LEGACY, DEATH, keccak256("de1"), uint64(block.timestamp))
        );
        vm.expectRevert(LifeOracle.NotAlive.selector);
        vm.prank(carol);
        d.oracle.rebindWallet(mkProof(GMAIL, ENROLL, id, uint64(block.timestamp)));
    }
}

contract LifeOracleHeartbeatTest is BaseTest {
    bytes32 internal id;

    function setUp() public override {
        super.setUp();
        id = enroll(alice, "alice@example.com");
    }

    function test_proveLife_advancesFreshness() public {
        vm.warp(block.timestamp + 20 minutes);
        heartbeat(alice);
        assertTrue(d.oracle.isInGoodStanding(id));
    }

    function test_lapse_afterMissedHeartbeat() public {
        // demo config: 30 min heartbeat + 15 min grace
        vm.warp(block.timestamp + 46 minutes);
        assertFalse(d.oracle.isInGoodStanding(id));
        assertTrue(d.oracle.isLapsed(id));
        // lapse is recoverable — nothing was forfeited
        heartbeat(alice);
        assertTrue(d.oracle.isInGoodStanding(id));
    }

    function test_proveLife_rejectsMonotonicViolation() public {
        vm.warp(block.timestamp + 20 minutes);
        heartbeat(alice);
        vm.expectRevert(LifeOracle.StaleEmail.selector);
        vm.prank(alice);
        d.oracle.proveLife(mkProof(GMAIL, LIFE, id, uint64(block.timestamp - 1)));
    }

    function test_proveLife_rejectsEmailPredatingEpochNonce() public {
        d.oracle.rollEpoch();
        uint64 nonceSetAt = d.oracle.currentEpochNonceSetAt();
        vm.warp(block.timestamp + 5 minutes);
        vm.expectRevert(LifeOracle.StaleEmail.selector);
        vm.prank(alice);
        d.oracle.proveLife(mkProof(GMAIL, LIFE, id, nonceSetAt - 1));
    }

    function test_proveLife_rejectsWrongSendersIdentity() public {
        enroll(bob, "bob@example.com");
        vm.warp(block.timestamp + 5 minutes);
        // bob submits a life proof whose nullifier is alice's identity
        vm.expectRevert(LifeOracle.WrongIdentity.selector);
        vm.prank(bob);
        d.oracle.proveLife(mkProof(GMAIL, LIFE, id, uint64(block.timestamp)));
    }

    function test_proveLife_rejectsDeathProxyDomain() public {
        vm.warp(block.timestamp + 5 minutes);
        vm.expectRevert(LifeOracle.DomainNotAllowed.selector);
        vm.prank(alice);
        d.oracle.proveLife(mkProof(LEGACY, LIFE, id, uint64(block.timestamp)));
    }

    function test_epochNonce_rolls() public {
        d.oracle.rollEpoch();
        bytes32 n1 = d.oracle.currentEpochNonce();
        vm.warp(block.timestamp + 31 minutes); // past demo heartbeatPeriod
        vm.roll(block.number + 10);
        d.oracle.rollEpoch();
        assertTrue(d.oracle.currentEpochNonce() != n1);
    }
}

contract LifeOracleDeathTest is BaseTest {
    bytes32 internal id;

    function setUp() public override {
        super.setUp();
        id = enroll(alice, "alice@example.com");
        vm.warp(block.timestamp + 1 minutes);
    }

    function _claim(address claimant) internal {
        vm.deal(claimant, 1 ether);
        vm.prank(claimant);
        d.oracle.claimDeath{value: 0.01 ether}(
            id, mkProof(LEGACY, DEATH, keccak256("death-email-1"), uint64(block.timestamp))
        );
    }

    function test_claim_finalize_happy() public {
        _claim(bob);
        assertEq(uint8(d.oracle.statusOf(id)), uint8(LifeOracle.Status.DeathClaimed));
        vm.warp(block.timestamp + 11 minutes);
        uint256 before = bob.balance;
        d.oracle.finalizeDeath(id);
        assertTrue(d.oracle.isDead(id));
        assertEq(bob.balance - before, 0.01 ether); // bond returned
        assertEq(d.oracle.claimantOf(id), bob);
    }

    function test_claim_rejectsWrongBond() public {
        vm.deal(bob, 1 ether);
        vm.expectRevert(LifeOracle.WrongBond.selector);
        vm.prank(bob);
        d.oracle.claimDeath{value: 0.001 ether}(
            id, mkProof(LEGACY, DEATH, keccak256("de"), uint64(block.timestamp))
        );
    }

    function test_claim_rejectsLifeDomain() public {
        vm.deal(bob, 1 ether);
        vm.expectRevert(LifeOracle.DomainNotAllowed.selector);
        vm.prank(bob);
        d.oracle.claimDeath{value: 0.01 ether}(
            id, mkProof(GMAIL, DEATH, keccak256("de"), uint64(block.timestamp))
        );
    }

    function test_claim_rejectsReusedDeathEmail() public {
        bytes32 bobId = enroll(bob, "bob@example.com");
        vm.warp(block.timestamp + 1 minutes);
        _claim(carol);
        vm.deal(dave, 1 ether);
        vm.expectRevert(LifeOracle.DeathEmailReused.selector);
        vm.prank(dave);
        d.oracle.claimDeath{value: 0.01 ether}(
            bobId, mkProof(LEGACY, DEATH, keccak256("death-email-1"), uint64(block.timestamp))
        );
    }

    function test_claim_rejectsNoticePredatingLastLifeProof() public {
        uint64 lifeTs = uint64(block.timestamp);
        vm.warp(block.timestamp + 5 minutes);
        heartbeatAt(alice, uint64(block.timestamp));
        vm.deal(bob, 1 ether);
        vm.expectRevert(LifeOracle.NoticePredatesLife.selector);
        vm.prank(bob);
        d.oracle.claimDeath{value: 0.01 ether}(id, mkProof(LEGACY, DEATH, keccak256("de"), lifeTs));
    }

    function heartbeatAt(address who, uint64 ts) internal {
        bytes32 whoId = d.oracle.idOf(who);
        vm.prank(who);
        d.oracle.proveLife(mkProof(GMAIL, LIFE, whoId, ts));
    }

    function test_refute_returnsBondToMember() public {
        _claim(bob);
        vm.warp(block.timestamp + 5 minutes);
        uint256 before = alice.balance;
        vm.prank(alice);
        d.oracle.refuteDeath(mkProof(GMAIL, LIFE, id, uint64(block.timestamp)));
        assertEq(alice.balance - before, 0.01 ether); // slashed bond to the victim
        assertEq(uint8(d.oracle.statusOf(id)), uint8(LifeOracle.Status.Alive));
        assertTrue(d.oracle.isInGoodStanding(id));
        assertEq(d.oracle.claimantOf(id), address(0));
    }

    function test_refute_rejectsLifeProofOlderThanNotice() public {
        _claim(bob);
        uint64 noticeTs = uint64(block.timestamp);
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(alice);
        vm.expectRevert(LifeOracle.StaleEmail.selector);
        d.oracle.refuteDeath(mkProof(GMAIL, LIFE, id, noticeTs));
    }

    function test_refute_rejectsAfterWindow() public {
        _claim(bob);
        vm.warp(block.timestamp + 11 minutes);
        vm.prank(alice);
        vm.expectRevert(LifeOracle.WindowClosed.selector);
        d.oracle.refuteDeath(mkProof(GMAIL, LIFE, id, uint64(block.timestamp)));
    }

    function test_finalize_rejectsDuringWindow() public {
        _claim(bob);
        vm.warp(block.timestamp + 5 minutes);
        vm.expectRevert(LifeOracle.WindowStillOpen.selector);
        d.oracle.finalizeDeath(id);
    }

    function test_deadMemberCannotHeartbeat() public {
        _claim(bob);
        vm.warp(block.timestamp + 11 minutes);
        d.oracle.finalizeDeath(id);
        vm.expectRevert(LifeOracle.NotAlive.selector);
        vm.prank(alice);
        d.oracle.proveLife(mkProof(GMAIL, LIFE, id, uint64(block.timestamp)));
    }
}

contract LifeOraclePresumedDeathTest is BaseTest {
    bytes32 internal id;

    function setUp() public override {
        super.setUp();
        id = enroll(alice, "alice@example.com");
    }

    function test_presumed_rejectsBeforeDeepLapse() public {
        vm.warp(block.timestamp + 1 hours); // < 2h demo presumedDeadAfter
        vm.deal(bob, 1 ether);
        vm.expectRevert(LifeOracle.NotLapsedLongEnough.selector);
        vm.prank(bob);
        d.oracle.claimPresumedDeath{value: 0.05 ether}(id);
    }

    function test_presumed_happyAndRefutable() public {
        vm.warp(block.timestamp + 2 hours + 1);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        d.oracle.claimPresumedDeath{value: 0.05 ether}(id);
        assertEq(uint8(d.oracle.statusOf(id)), uint8(LifeOracle.Status.DeathClaimed));

        // the member returns within the (longer) presumed window
        vm.warp(block.timestamp + 15 minutes);
        uint256 before = alice.balance;
        vm.prank(alice);
        d.oracle.refuteDeath(mkProof(GMAIL, LIFE, id, uint64(block.timestamp)));
        assertEq(alice.balance - before, 0.05 ether);
        assertTrue(d.oracle.isInGoodStanding(id));
    }

    function test_presumed_finalizes() public {
        vm.warp(block.timestamp + 2 hours + 1);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        d.oracle.claimPresumedDeath{value: 0.05 ether}(id);
        vm.warp(block.timestamp + 21 minutes);
        d.oracle.finalizeDeath(id);
        assertTrue(d.oracle.isDead(id));
    }
}
