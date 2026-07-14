// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Test/demo stand-ins for WXDAI and sDAI (the Gnosis Savings-xDAI ERC4626
///         vault). MockSDai lets tests simulate yield by donating WXDAI, which
///         raises the share price exactly like DSR accrual does on the real vault.
contract MockWxdai is ERC20 {
    constructor() ERC20("Wrapped XDAI", "WXDAI") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockSDai is ERC4626 {
    constructor(IERC20 wxdai) ERC20("Savings xDAI", "sDAI") ERC4626(wxdai) {}
}
