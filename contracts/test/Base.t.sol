// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {EmailProof, DomainRoles} from "../src/Types.sol";
import {LifeOracle} from "../src/LifeOracle.sol";
import {TontinePool} from "../src/TontinePool.sol";
import {MockWxdai} from "../src/mocks/MockSDai.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Shared harness: full system deployed via the real Deploy script (demo
///         config: 30-min heartbeats, 10-min challenge windows, mock reserve pair),
///         DKIM keys and blueprint patterns pre-registered, plus helpers to
///         fabricate proofs (the MockGroth16Verifier accepts them; every
///         contract-level check stays real) and to enroll/join members.
///
///         The test contract itself is `admin` (owner of everything), so admin ops
///         need no pranking.
///
///         Demo domains mirror script/Deploy.s.sol demoLifeDomains()/
///         demoDeathDomains() and app/lib/demo.ts — keep all three in sync.
abstract contract BaseTest is Test {
    Deploy.Deployment internal d;

    address internal guardian = makeAddr("guardian");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");

    // -- canonical demo domains (hash of lowercase domain string)
    bytes32 internal constant GMAIL = keccak256("gmail.com");
    bytes32 internal constant OUTLOOK = keccak256("outlook.com");
    bytes32 internal constant LEGACY = keccak256("legacy.com");
    bytes32 internal constant DIGNITY = keccak256("dignitymemorial.com");

    // -- blueprint pattern commitments
    bytes32 internal constant ENROLL = keccak256("tontine/enroll-v1");
    bytes32 internal constant LIFE = keccak256("tontine/life-v1");
    bytes32 internal constant DEATH = keccak256("tontine/death-v1");

    uint64 internal constant T0 = 1_900_000_000; // deterministic test epoch

    function dkimKeyOf(bytes32 domainHash) internal pure returns (bytes32) {
        return keccak256(abi.encode("dkim-key", domainHash));
    }

    function setUp() public virtual {
        vm.warp(T0);
        vm.roll(1000);
        Deploy deployer = new Deploy();
        d = deployer.deploy(address(this), guardian, address(deployer));

        // Register demo DKIM keys + roles exactly as demoSetup does, but from the
        // test contract (the owner after handoff).
        deployerDemoSetup();
    }

    function deployerDemoSetup() internal {
        bytes32[2] memory life = [GMAIL, OUTLOOK];
        for (uint256 i = 0; i < life.length; i++) {
            d.dkim.setKey(life[i], dkimKeyOf(life[i]), 0, 0);
            d.oracle.setDomainRoles(life[i], DomainRoles.IDENTITY | DomainRoles.LIFE);
        }
        bytes32[2] memory death = [LEGACY, DIGNITY];
        for (uint256 i = 0; i < death.length; i++) {
            d.dkim.setKey(death[i], dkimKeyOf(death[i]), 0, 0);
            d.oracle.setDomainRoles(death[i], DomainRoles.DEATH);
        }
        d.verifier.setVerifier(ENROLL, d.groth16);
        d.verifier.setVerifier(LIFE, d.groth16);
        d.verifier.setVerifier(DEATH, d.groth16);
    }

    // ------------------------------------------------------------ proof helpers

    function mkProof(bytes32 domainHash, bytes32 patternHash, bytes32 nullifier, uint64 emailTs)
        internal
        pure
        returns (EmailProof memory p)
    {
        p.dkimPubkeyHash = dkimKeyOf(domainHash);
        p.domainHash = domainHash;
        p.nullifier = nullifier;
        p.patternHash = patternHash;
        p.emailTimestamp = emailTs;
        // p.proof stays zeroed — the mock verifier ignores it.
    }

    function idFor(string memory email) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("email:", email));
    }

    /// @dev Enrolls `who` with an identity derived from `email`, via gmail.
    function enroll(address who, string memory email) internal returns (bytes32 id) {
        id = idFor(email);
        vm.prank(who);
        d.oracle.enroll(mkProof(GMAIL, ENROLL, id, uint64(block.timestamp)));
    }

    function heartbeat(address who) internal {
        bytes32 id = d.oracle.idOf(who);
        vm.prank(who);
        d.oracle.proveLife(mkProof(GMAIL, LIFE, id, uint64(block.timestamp)));
    }

    /// @dev Mints WXDAI and joins the demo pool.
    function join(address who, uint256 assets, uint64 birthYear, uint16 bequestBps, address ben)
        internal
    {
        MockWxdai(address(d.wxdai)).mint(who, assets);
        vm.startPrank(who);
        d.wxdai.approve(address(d.pool), assets);
        d.pool.join(assets, birthYear, bequestBps, ben);
        vm.stopPrank();
    }

    /// @dev Full happy-path kill: bonded email claim + window elapse + finalize.
    ///      Warps forward a minute so the death notice postdates any life proof
    ///      minted in the same block.
    function killMember(address victim, address claimant) internal {
        vm.warp(block.timestamp + 1 minutes);
        bytes32 id = d.oracle.idOf(victim);
        vm.deal(claimant, 1 ether);
        vm.prank(claimant);
        d.oracle.claimDeath{value: 0.01 ether}(
            id,
            mkProof(
                LEGACY,
                DEATH,
                keccak256(abi.encode("death-email", id, block.timestamp)),
                uint64(block.timestamp)
            )
        );
        vm.warp(block.timestamp + 10 minutes + 1);
        d.oracle.finalizeDeath(id);
    }

    function birthYearForAge(uint256 age) internal view returns (uint64) {
        uint256 nowYear = 1970 + block.timestamp / 31_557_600;
        return uint64(nowYear - age);
    }
}
