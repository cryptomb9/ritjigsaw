// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {PuzzleCompletion} from "../src/PuzzleCompletion.sol";

contract Deploy is Script {
    function run() external returns (PuzzleCompletion puzzleCompletion) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        puzzleCompletion = new PuzzleCompletion();

        console2.log("PuzzleCompletion deployed:", address(puzzleCompletion));

        vm.stopBroadcast();
    }
}
