// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PuzzleCompletion} from "../src/PuzzleCompletion.sol";

contract PuzzleCompletionTest {
    bytes32 private constant PUZZLE_HASH = keccak256("ritual-jigsaw:v1:ritual-placeholder:4x4");

    PuzzleCompletion private puzzle;

    function setUp() public {
        puzzle = new PuzzleCompletion();
    }

    function testSubmitScoreStoresCompletionAndPoints() public {
        bytes32 completionHash = keccak256(bytes("completion"));
        bool improved = puzzle.submitScore(PUZZLE_HASH, 4, 4, 24, 60, completionHash);

        (
            bool exists,
            ,
            uint16 rows,
            uint16 cols,
            uint32 moves,
            uint32 secondsTaken,
            uint256 score,
            bytes32 storedHash
        ) = puzzle.getCompletion(PUZZLE_HASH, address(this));

        assertTrue(improved);
        assertTrue(exists);
        assertEq(rows, 4);
        assertEq(cols, 4);
        assertEq(moves, 24);
        assertEq(secondsTaken, 60);
        assertEq(score, 14800);
        assertEq(storedHash, completionHash);
        assertEq(puzzle.totalPoints(address(this)), 14800);
    }

    function testWorseScoreDoesNotReplaceBest() public {
        puzzle.submitScore(PUZZLE_HASH, 4, 4, 24, 60, keccak256(bytes("best")));
        bool improved = puzzle.submitScore(PUZZLE_HASH, 4, 4, 60, 120, keccak256(bytes("worse")));

        (,,,,,, uint256 score, bytes32 storedHash) = puzzle.getCompletion(PUZZLE_HASH, address(this));

        assertFalse(improved);
        assertEq(score, 14800);
        assertEq(storedHash, keccak256(bytes("best")));
        assertEq(puzzle.totalPoints(address(this)), 14800);
    }

    function testUnknownFrontendPuzzleHashCanStillSubmit() public {
        bytes32 customPuzzleHash = keccak256("custom-image-url");

        puzzle.submitScore(customPuzzleHash, 3, 3, 12, 30, keccak256(bytes("custom")));

        (bool exists,,,,,, uint256 score,) = puzzle.getCompletion(customPuzzleHash, address(this));
        assertTrue(exists);
        assertEq(score, 8400);
    }

    function assertTrue(bool value) private pure {
        require(value, "assert true failed");
    }

    function assertFalse(bool value) private pure {
        require(!value, "assert false failed");
    }

    function assertEq(uint256 actual, uint256 expected) private pure {
        require(actual == expected, "uint assert eq failed");
    }

    function assertEq(uint32 actual, uint32 expected) private pure {
        require(actual == expected, "uint32 assert eq failed");
    }

    function assertEq(uint16 actual, uint16 expected) private pure {
        require(actual == expected, "uint16 assert eq failed");
    }

    function assertEq(bytes32 actual, bytes32 expected) private pure {
        require(actual == expected, "bytes32 assert eq failed");
    }
}
