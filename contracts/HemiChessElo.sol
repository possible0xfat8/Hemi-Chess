// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// These imports automatically pull the secure standard libraries
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HemiChessElo is ERC20, Ownable {
    
    // Emitted when ELO is adjusted by the Oracle (initial sync, match result, or batch sync)
    event EloAdjusted(address indexed player, uint256 amount, bool isWin);

    // Initializes the token with Name: "HemiChess ELO" and Symbol: "HELO"
    // Sets the deployer (you) as the initial owner of the contract
    constructor() ERC20("HemiChess ELO", "HELO") Ownable(msg.sender) {}

    /**
     * @dev Admin function for the backend Oracle to sync initial ELO or adjust after a game.
     * Only the owner (your backend oracle) can call this.
     * @param player The address whose ELO is being adjusted
     * @param amount The amount of ELO to mint or burn (in wei, with 18 decimals)
     * @param isWin True to mint (initial 1200 sync or won game), false to burn (lost game)
     */
    function adjustElo(address player, uint256 amount, bool isWin) external onlyOwner {
        require(player != address(0), "HemiChess: Cannot adjust ELO for zero address");
        require(amount > 0, "HemiChess: Amount must be greater than zero");
        
        if (isWin) {
            _mint(player, amount);
        } else {
            // Check balance before burning to prevent underflow
            require(balanceOf(player) >= amount, "HemiChess: Insufficient ELO balance to burn");
            _burn(player, amount);
        }
        
        emit EloAdjusted(player, amount, isWin);
    }

    /**
     * @dev Batch adjust ELO for multiple players in a single transaction.
     * Perfect for the backend admin "Sync All" reconciliation tool.
     * 
     * @param players Array of player addresses
     * @param amounts Array of ELO amounts to mint/burn (in wei)
     * @param isWins Array of booleans (true = mint, false = burn)
     */
    function batchAdjustElo(
        address[] calldata players,
        uint256[] calldata amounts,
        bool[] calldata isWins
    ) external onlyOwner {
        require(
            players.length == amounts.length && amounts.length == isWins.length, 
            "HemiChess: Array length mismatch"
        );
        require(players.length > 0, "HemiChess: Empty arrays");
        
        for (uint256 i = 0; i < players.length; i++) {
            require(players[i] != address(0), "HemiChess: Cannot adjust ELO for zero address");
            require(amounts[i] > 0, "HemiChess: Amount must be greater than zero");
            
            if (isWins[i]) {
                _mint(players[i], amounts[i]);
            } else {
                // Check balance before burning to prevent underflow in the loop
                require(
                    balanceOf(players[i]) >= amounts[i], 
                    "HemiChess: Insufficient ELO balance to burn"
                );
                _burn(players[i], amounts[i]);
            }
            
            emit EloAdjusted(players[i], amounts[i], isWins[i]);
        }
    }

    /**
     * @dev THE SOULBOUND OVERRIDE.
     * This intercepts all token movements. It instantly rejects user-to-user transfers.
     * Tokens can only be minted (from 0x0) or burned (to 0x0).
     */
    function _update(address from, address to, uint256 value) internal override {
        require(
            from == address(0) || to == address(0),
            "HemiChess: Tokens are Soulbound and cannot be transferred between players"
        );
        super._update(from, to, value);
    }
}