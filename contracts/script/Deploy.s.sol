// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {DomainRoles} from "../src/Types.sol";
import {DKIMRegistry} from "../src/DKIMRegistry.sol";
import {ZKEmailVerifier} from "../src/ZKEmailVerifier.sol";
import {LifeOracle} from "../src/LifeOracle.sol";
import {TontineFactory} from "../src/TontineFactory.sol";
import {TontinePool} from "../src/TontinePool.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {MockWxdai, MockSDai} from "../src/mocks/MockSDai.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";

/// @notice Full topology on a fresh chain.
///
///         Env knobs:
///           WXDAI / SDAI — addresses of the real reserve pair (on Gnosis:
///                          WXDAI 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d,
///                          sDAI  0xaf204776c7245bF4147c2612BF6e5972Ee483701);
///                          unset → mocks are deployed (tests, local demo).
///           DEMO_SETUP   — true → register the demo proxy domains below, route
///                          all three blueprints to the MockGroth16Verifier, use
///                          minutes-scale windows and token bonds so the full
///                          enroll → heartbeat → death-claim → challenge →
///                          settle → income loop is walkable in under an hour.
///
///         Real Groth16 verifiers (compiled per blueprint) replace the mock via
///         ZKEmailVerifier.setVerifier without touching anything else.
contract Deploy is Script {
    bytes32 public constant ENROLL_PATTERN = keccak256("tontine/enroll-v1");
    bytes32 public constant LIFE_PATTERN = keccak256("tontine/life-v1");
    bytes32 public constant DEATH_PATTERN = keccak256("tontine/death-v1");

    struct Deployment {
        IERC20 wxdai;
        IERC4626 sdai;
        DKIMRegistry dkim;
        ZKEmailVerifier verifier;
        MockGroth16Verifier groth16;
        LifeOracle oracle;
        TontineFactory factory;
        TontinePool pool;
    }

    function run() external returns (Deployment memory d) {
        address admin = vm.envOr("ADMIN", msg.sender);
        address guardian = vm.envOr("GUARDIAN", msg.sender);
        bool demo = vm.envOr("DEMO_SETUP", false);
        address wxdai = vm.envOr("WXDAI", address(0));
        address sdai = vm.envOr("SDAI", address(0));
        vm.startBroadcast();
        d = deploy(admin, guardian, msg.sender, wxdai, sdai, demo);
        if (demo) demoSetup(d);
        vm.stopBroadcast();
    }

    /// @dev Test-friendly overload: mock reserve pair, demo windows.
    function deploy(address admin, address guardian, address deployer)
        public
        returns (Deployment memory d)
    {
        return deploy(admin, guardian, deployer, address(0), address(0), true);
    }

    function deploy(
        address admin,
        address guardian,
        address deployer,
        address wxdai,
        address sdai,
        bool demo
    ) public returns (Deployment memory d) {
        if (wxdai == address(0)) {
            MockWxdai mw = new MockWxdai();
            d.wxdai = IERC20(address(mw));
            d.sdai = IERC4626(address(new MockSDai(d.wxdai)));
        } else {
            d.wxdai = IERC20(wxdai);
            d.sdai = IERC4626(sdai);
        }

        // Deployer holds ownership while wiring; handoff to admin at the end.
        d.dkim = new DKIMRegistry(deployer, guardian);
        d.verifier = new ZKEmailVerifier(deployer, d.dkim);
        d.groth16 = new MockGroth16Verifier();

        d.oracle = new LifeOracle(
            deployer,
            d.verifier,
            ENROLL_PATTERN,
            LIFE_PATTERN,
            DEATH_PATTERN,
            demo
                ? LifeOracle.Config({
                    heartbeatPeriod: 30 minutes,
                    gracePeriod: 15 minutes,
                    challengeWindow: 10 minutes,
                    presumedDeadAfter: 2 hours,
                    presumedChallengeWindow: 20 minutes,
                    deathClaimBond: 0.01 ether,
                    presumedClaimBond: 0.05 ether
                })
                : LifeOracle.Config({
                    heartbeatPeriod: 90 days,
                    gracePeriod: 30 days,
                    challengeWindow: 30 days,
                    presumedDeadAfter: 730 days,
                    presumedChallengeWindow: 90 days,
                    deathClaimBond: 50 ether, //   xDAI — must sting for false claims
                    presumedClaimBond: 250 ether
                })
        );

        d.factory = new TontineFactory(d.oracle, d.sdai, d.wxdai);
        d.pool = d.factory
            .createPool(
                TontinePool.Params({
                    name: demo ? "Demo Cohort" : "Cohort One",
                    lockTime: uint64(block.timestamp + (demo ? 45 minutes : 90 days)),
                    minJoinAssets: demo ? 1 ether : 500 ether,
                    maxJoinAssets: demo ? 10_000 ether : 50_000 ether,
                    maxMembers: 500,
                    bountyBps: 200, // 2% of estate to whoever proves the death
                    treasury: admin
                })
            );

        if (admin != deployer) {
            d.dkim.transferOwnership(admin);
            d.verifier.transferOwnership(admin);
            d.oracle.transferOwnership(admin);
        }
    }

    /// @notice Demo proxy-domain allowlist. Mirrored in app/lib/demo.ts and
    ///         test/Base.t.sol — keep all three in sync.
    ///         Mail providers DKIM-sign what a member *sends* (enrollment +
    ///         challenge-response heartbeats); institutions DKIM-sign the
    ///         notifications their bereavement/records desks send out.
    function demoLifeDomains() public pure returns (bytes32[4] memory) {
        return [
            keccak256("gmail.com"), //    [0] mail providers: identity + life
            keccak256("outlook.com"), //  [1]
            keccak256("proton.me"), //    [2]
            keccak256("yahoo.com") //     [3]
        ];
    }

    function demoDeathDomains() public pure returns (bytes32[6] memory) {
        return [
            keccak256("legacy.com"), //            [0] obituary platform
            keccak256("dignitymemorial.com"), //   [1] funeral-home network
            keccak256("neptunesociety.com"), //    [2] cremation provider
            keccak256("tributearchive.com"), //    [3] obituary/tribute platform
            keccak256("metlife.com"), //           [4] life insurer bereavement desk
            keccak256("kaiserpermanente.org") //   [5] healthcare provider records
        ];
    }

    function demoSetup(Deployment memory d) public {
        bytes32[4] memory life = demoLifeDomains();
        for (uint256 i = 0; i < life.length; i++) {
            d.dkim.setKey(life[i], keccak256(abi.encode("dkim-key", life[i])), 0, 0);
            d.oracle.setDomainRoles(life[i], DomainRoles.IDENTITY | DomainRoles.LIFE);
        }
        bytes32[6] memory death = demoDeathDomains();
        for (uint256 i = 0; i < death.length; i++) {
            d.dkim.setKey(death[i], keccak256(abi.encode("dkim-key", death[i])), 0, 0);
            d.oracle.setDomainRoles(death[i], DomainRoles.DEATH);
        }
        d.verifier.setVerifier(ENROLL_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.verifier.setVerifier(LIFE_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.verifier.setVerifier(DEATH_PATTERN, IGroth16Verifier(address(d.groth16)));
    }
}
