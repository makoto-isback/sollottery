/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sollottery.json`.
 */
export type Sollottery = {
  "address": "CpEVMvSsqTjx4Ajo4J7tbVSaqwR7nR5fwGFqMLAQ1ndr",
  "metadata": {
    "name": "sollottery",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "A fully on-chain Solana lottery program"
  },
  "instructions": [
    {
      "name": "activateUser",
      "docs": [
        "Activate user wallet - one-time 0.01 SOL fee"
      ],
      "discriminator": [
        161,
        57,
        19,
        111,
        100,
        58,
        100,
        166
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "adminWallet",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "buyTickets",
      "docs": [
        "Buy tickets (1-10 tickets per transaction)",
        "Each ticket gets a random number between 1-1000"
      ],
      "discriminator": [
        48,
        16,
        122,
        137,
        24,
        214,
        198,
        58
      ],
      "accounts": [
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "ticketRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "userTickets",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  116,
                  105,
                  99,
                  107,
                  101,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "userProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "adminWallet",
          "writable": true
        },
        {
          "name": "roundVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "ticketCount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "claimPrize",
      "docs": [
        "Claim prize - winner can claim anytime after round ends",
        "After claiming, automatically starts the next round"
      ],
      "discriminator": [
        157,
        233,
        139,
        121,
        246,
        62,
        234,
        235
      ],
      "accounts": [
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "ticketRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "roundVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "userTickets",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  116,
                  105,
                  99,
                  107,
                  101,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              },
              {
                "kind": "account",
                "path": "winner"
              }
            ]
          }
        },
        {
          "name": "winner",
          "writable": true,
          "signer": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        },
        {
          "name": "nextRound",
          "writable": true
        },
        {
          "name": "nextRoundVault",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "endRound",
      "docs": [
        "End the current round and select winning number from sold tickets",
        "Can be called by anyone if 24 hours have passed"
      ],
      "discriminator": [
        54,
        47,
        1,
        200,
        250,
        6,
        144,
        63
      ],
      "accounts": [
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "ticketRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "round.round_number",
                "account": "round"
              }
            ]
          }
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the lottery program and create the first round",
        "Also initializes the vault PDA for the round"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "roundNumber"
              }
            ]
          }
        },
        {
          "name": "roundVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "roundNumber"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roundNumber",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "round",
      "discriminator": [
        87,
        127,
        165,
        51,
        73,
        78,
        116,
        174
      ]
    },
    {
      "name": "ticketRegistry",
      "discriminator": [
        58,
        169,
        167,
        230,
        107,
        202,
        126,
        54
      ]
    },
    {
      "name": "userProfile",
      "discriminator": [
        32,
        37,
        119,
        205,
        179,
        180,
        13,
        194
      ]
    },
    {
      "name": "userTickets",
      "discriminator": [
        92,
        168,
        76,
        232,
        125,
        8,
        105,
        196
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidTicketCount",
      "msg": "Invalid ticket count. Must be between 1 and 10."
    },
    {
      "code": 6001,
      "name": "roundNotActive",
      "msg": "Round is not active."
    },
    {
      "code": 6002,
      "name": "roundNotExpired",
      "msg": "Round has not expired yet."
    },
    {
      "code": 6003,
      "name": "roundExpired",
      "msg": "Round has expired."
    },
    {
      "code": 6004,
      "name": "maxTicketsReached",
      "msg": "Maximum tickets per round reached."
    },
    {
      "code": 6005,
      "name": "noTicketsSold",
      "msg": "No tickets were sold in this round."
    },
    {
      "code": 6006,
      "name": "roundNotEnded",
      "msg": "Round has not ended yet."
    },
    {
      "code": 6007,
      "name": "noWinningNumber",
      "msg": "No winning number has been set."
    },
    {
      "code": 6008,
      "name": "notWinner",
      "msg": "You are not the winner of this round."
    },
    {
      "code": 6009,
      "name": "invalidWinner",
      "msg": "Invalid winner account."
    },
    {
      "code": 6010,
      "name": "userNotActivated",
      "msg": "Wallet not activated."
    },
    {
      "code": 6011,
      "name": "alreadyActivated",
      "msg": "Wallet already activated."
    },
    {
      "code": 6012,
      "name": "invalidAdminWallet",
      "msg": "Invalid admin wallet address."
    },
    {
      "code": 6013,
      "name": "noPrize",
      "msg": "No prize available to claim."
    },
    {
      "code": 6014,
      "name": "mathOverflow",
      "msg": "Mathematical operation overflowed."
    }
  ],
  "types": [
    {
      "name": "round",
      "docs": [
        "Round account - stores information about a lottery round"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundNumber",
            "type": "u64"
          },
          {
            "name": "startTimestamp",
            "type": "i64"
          },
          {
            "name": "endTimestamp",
            "type": "i64"
          },
          {
            "name": "winningNumber",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "roundStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "roundStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "ended"
          },
          {
            "name": "claimed"
          }
        ]
      }
    },
    {
      "name": "ticketRegistry",
      "docs": [
        "Ticket Registry - stores all sold ticket numbers for a round"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundNumber",
            "type": "u64"
          },
          {
            "name": "soldTickets",
            "type": {
              "vec": "u16"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userProfile",
      "docs": [
        "User Profile - stores activation status for a user"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "activated",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "userTickets",
      "docs": [
        "User Tickets - stores tickets owned by a user for a specific round"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "roundNumber",
            "type": "u64"
          },
          {
            "name": "ticketNumbers",
            "type": {
              "vec": "u16"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
