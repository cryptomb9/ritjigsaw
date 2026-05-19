// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PuzzleCompletion {
    uint256 public constant MAX_LEADERBOARD_SIZE = 30;
    uint256 public constant POINTS_PER_TILE = 1000;
    uint256 public constant SECONDS_PENALTY = 10;
    uint256 public constant MOVES_PENALTY = 25;

    struct Completion {
        bool exists;
        uint64 completedAt;
        uint16 rows;
        uint16 cols;
        uint32 moves;
        uint32 secondsTaken;
        uint256 score;
        bytes32 completionHash;
    }

    mapping(bytes32 puzzleHash => mapping(address player => Completion completion)) private completions;
    mapping(address player => uint256 points) public totalPoints;
    address[] private topPlayers;

    event PuzzleCompleted(
        bytes32 indexed puzzleHash,
        address indexed player,
        uint16 rows,
        uint16 cols,
        uint32 moves,
        uint32 secondsTaken,
        uint256 score,
        uint256 totalPoints,
        bytes32 completionHash,
        uint64 completedAt,
        bool improved
    );

    function submitScore(
        bytes32 puzzleHash,
        uint16 rows,
        uint16 cols,
        uint32 moves,
        uint32 secondsTaken,
        bytes32 completionHash
    ) external returns (bool improved) {
        require(puzzleHash != bytes32(0), "puzzle hash required");
        require(rows > 1 && cols > 1, "invalid grid");
        require(moves > 0, "moves required");
        require(secondsTaken > 0, "time required");
        require(completionHash != bytes32(0), "hash required");

        Completion storage current = completions[puzzleHash][msg.sender];
        uint256 score = scoreFor(rows, cols, moves, secondsTaken);
        improved = !current.exists || score > current.score;

        if (improved) {
            uint256 previousScore = current.score;
            current.exists = true;
            current.completedAt = uint64(block.timestamp);
            current.rows = rows;
            current.cols = cols;
            current.moves = moves;
            current.secondsTaken = secondsTaken;
            current.score = score;
            current.completionHash = completionHash;

            totalPoints[msg.sender] += score - previousScore;
            _updateTopPlayers(msg.sender);
        }

        emit PuzzleCompleted(
            puzzleHash,
            msg.sender,
            rows,
            cols,
            moves,
            secondsTaken,
            score,
            totalPoints[msg.sender],
            completionHash,
            uint64(block.timestamp),
            improved
        );
    }

    function scoreFor(uint16 rows, uint16 cols, uint32 moves, uint32 secondsTaken)
        public
        pure
        returns (uint256)
    {
        uint256 base = uint256(rows) * uint256(cols) * POINTS_PER_TILE;
        uint256 penalty = uint256(secondsTaken) * SECONDS_PENALTY + uint256(moves) * MOVES_PENALTY;

        if (penalty >= base) {
            return 1;
        }

        return base - penalty;
    }

    function getCompletion(bytes32 puzzleHash, address player)
        external
        view
        returns (
            bool exists,
            uint64 completedAt,
            uint16 rows,
            uint16 cols,
            uint32 moves,
            uint32 secondsTaken,
            uint256 score,
            bytes32 completionHash
        )
    {
        Completion storage completion = completions[puzzleHash][player];
        return (
            completion.exists,
            completion.completedAt,
            completion.rows,
            completion.cols,
            completion.moves,
            completion.secondsTaken,
            completion.score,
            completion.completionHash
        );
    }

    function getTopPlayers() external view returns (address[] memory players, uint256[] memory points) {
        players = new address[](topPlayers.length);
        points = new uint256[](topPlayers.length);

        for (uint256 i = 0; i < topPlayers.length; i++) {
            players[i] = topPlayers[i];
            points[i] = totalPoints[topPlayers[i]];
        }
    }

    function _updateTopPlayers(address player) private {
        uint256 playerPoints = totalPoints[player];
        uint256 length = topPlayers.length;
        uint256 playerIndex = type(uint256).max;

        for (uint256 i = 0; i < length; i++) {
            if (topPlayers[i] == player) {
                playerIndex = i;
                break;
            }
        }

        if (playerIndex == type(uint256).max) {
            if (length < MAX_LEADERBOARD_SIZE) {
                topPlayers.push(player);
                playerIndex = length;
            } else {
                uint256 lastIndex = length - 1;
                if (playerPoints <= totalPoints[topPlayers[lastIndex]]) {
                    return;
                }
                topPlayers[lastIndex] = player;
                playerIndex = lastIndex;
            }
        }

        while (playerIndex > 0 && playerPoints > totalPoints[topPlayers[playerIndex - 1]]) {
            address previous = topPlayers[playerIndex - 1];
            topPlayers[playerIndex - 1] = topPlayers[playerIndex];
            topPlayers[playerIndex] = previous;
            playerIndex--;
        }
    }
}
