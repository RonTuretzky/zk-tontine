// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {LifeOracle} from "./LifeOracle.sol";
import {TontinePool} from "./TontinePool.sol";

/// @notice Spawns closed tontine cohorts against a shared mortality oracle. Anyone
///         may open a cohort — the pools are member-run; there is no promoter take
///         anywhere in the system.
contract TontineFactory {
    LifeOracle public immutable oracle;
    IERC4626 public immutable sdai;
    IERC20 public immutable wxdai;

    TontinePool[] public pools;

    event PoolCreated(address indexed pool, string name, uint64 lockTime);

    constructor(LifeOracle oracle_, IERC4626 sdai_, IERC20 wxdai_) {
        oracle = oracle_;
        sdai = sdai_;
        wxdai = wxdai_;
    }

    function createPool(TontinePool.Params memory p) external returns (TontinePool pool) {
        pool = new TontinePool(oracle, sdai, wxdai, p);
        pools.push(pool);
        emit PoolCreated(address(pool), p.name, p.lockTime);
    }

    function poolCount() external view returns (uint256) {
        return pools.length;
    }

    function allPools() external view returns (TontinePool[] memory) {
        return pools;
    }
}
