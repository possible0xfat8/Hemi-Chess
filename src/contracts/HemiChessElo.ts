// HemiChessElo Smart Contract Configuration
// Deployed on Hemi Sepolia Testnet (Chain ID: 743111)

export const HEMI_CHESS_ELO_ADDRESS = "0x985a8f367db07E2869c5B4C521386C3F760DB765" as const;

export const HEMI_CHESS_ELO_ABI = [
  {
    "inputs": [],
    "name": "claimElo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "hasClaimed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isWin",
        "type": "bool"
      }
    ],
    "name": "adjustElo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
