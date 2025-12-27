/**
 * IDL structure matching the on-chain Anchor program
 * Generated from target/idl/sollottery.json
 */
export const IDL = {
    "version": "0.1.0",
    "name": "sollottery",
    "address": "57BGqiA2YWkF9u58EYnSRfJHJCPHPEiftnojD5fqys8r",
    "instructions": [
        {
            "name": "activateUser",
            "docs": [
                "Activate user wallet - one-time 0.01 SOL fee"
            ],
            "discriminator": [161, 57, 19, 111, 100, 58, 100, 166],
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
                                "value": [117, 115, 101, 114, 95, 112, 114, 111, 102, 105, 108, 101]
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
                    "writable": true,
                    "address": "2q79WzkjgEqPoBAWeEP2ih51q6TYp8D9DYWWMeLHK6WP"
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
            "discriminator": [48, 16, 122, 137, 24, 214, 198, 58],
            "accounts": [
                {
                    "name": "round",
                    "writable": true,
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const",
                                "value": [114, 111, 117, 110, 100]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
                                "value": [114, 101, 103, 105, 115, 116, 114, 121]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
                                "value": [117, 115, 101, 114, 95, 116, 105, 99, 107, 101, 116, 115]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
                                "value": [117, 115, 101, 114, 95, 112, 114, 111, 102, 105, 108, 101]
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
                    "writable": true,
                    "address": "2q79WzkjgEqPoBAWeEP2ih51q6TYp8D9DYWWMeLHK6WP"
                },
                {
                    "name": "roundVault",
                    "writable": true,
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const",
                                "value": [118, 97, 117, 108, 116]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
            "name": "endRound",
            "docs": [
                "End the current round and select winning number from sold tickets",
                "Can be called by anyone if 24 hours have passed"
            ],
            "discriminator": [54, 47, 1, 200, 250, 6, 144, 63],
            "accounts": [
                {
                    "name": "round",
                    "writable": true,
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const",
                                "value": [114, 111, 117, 110, 100]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
                                "value": [114, 101, 103, 105, 115, 116, 114, 121]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
            "name": "claimPrize",
            "docs": [
                "Claim prize - winner can claim anytime after round ends",
                "After claiming, automatically starts the next round"
            ],
            "discriminator": [157, 233, 139, 121, 246, 62, 234, 235],
            "accounts": [
                {
                    "name": "round",
                    "writable": true,
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const",
                                "value": [114, 111, 117, 110, 100]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
                                "value": [114, 101, 103, 105, 115, 116, 114, 121]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
                                "value": [118, 97, 117, 108, 116]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
                                "value": [117, 115, 101, 114, 95, 116, 105, 99, 107, 101, 116, 115]
                            },
                            {
                                "kind": "account",
                                "path": "round.roundNumber",
                                "account": "Round"
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
            "name": "initialize",
            "docs": [
                "Initialize the lottery program and create the first round",
                "Also initializes the vault PDA for the round"
            ],
            "discriminator": [175, 175, 109, 31, 13, 152, 155, 237],
            "accounts": [
                {
                    "name": "round",
                    "writable": true,
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const",
                                "value": [114, 111, 117, 110, 100]
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
                                "value": [118, 97, 117, 108, 116]
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
            "name": "Round",
            "discriminator": [87, 127, 165, 51, 73, 78, 116, 174]
        },
        {
            "name": "TicketRegistry",
            "discriminator": [58, 169, 167, 230, 107, 202, 126, 54]
        },
        {
            "name": "UserProfile",
            "discriminator": [32, 37, 119, 205, 179, 180, 13, 194]
        },
        {
            "name": "UserTickets",
            "discriminator": [92, 168, 76, 232, 125, 8, 105, 196]
        }
    ],
    "errors": [
        {
            "code": 6000,
            "name": "InvalidTicketCount",
            "msg": "Invalid ticket count. Must be between 1 and 10."
        },
        {
            "code": 6001,
            "name": "RoundNotActive",
            "msg": "Round is not active."
        },
        {
            "code": 6002,
            "name": "RoundNotExpired",
            "msg": "Round has not expired yet."
        },
        {
            "code": 6003,
            "name": "RoundExpired",
            "msg": "Round has expired."
        },
        {
            "code": 6004,
            "name": "MaxTicketsReached",
            "msg": "Maximum tickets per round reached."
        },
        {
            "code": 6005,
            "name": "NoTicketsSold",
            "msg": "No tickets were sold in this round."
        },
        {
            "code": 6006,
            "name": "RoundNotEnded",
            "msg": "Round has not ended yet."
        },
        {
            "code": 6007,
            "name": "NoWinningNumber",
            "msg": "No winning number has been set."
        },
        {
            "code": 6008,
            "name": "NotWinner",
            "msg": "You are not the winner of this round."
        },
        {
            "code": 6009,
            "name": "InvalidWinner",
            "msg": "Invalid winner account."
        },
        {
            "code": 6010,
            "name": "UserNotActivated",
            "msg": "Wallet not activated."
        },
        {
            "code": 6011,
            "name": "AlreadyActivated",
            "msg": "Wallet already activated."
        },
        {
            "code": 6012,
            "name": "NoPrize",
            "msg": "No prize available to claim."
        },
        {
            "code": 6013,
            "name": "MathOverflow",
            "msg": "Mathematical operation overflowed."
        }
    ],
    "types": [
        {
            "name": "Round",
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
                                "name": "RoundStatus"
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
            "name": "RoundStatus",
            "type": {
                "kind": "enum",
                "variants": [
                    {
                        "name": "Active"
                    },
                    {
                        "name": "Ended"
                    },
                    {
                        "name": "Claimed"
                    }
                ]
            }
        },
        {
            "name": "TicketRegistry",
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
            "name": "UserProfile",
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
            "name": "UserTickets",
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
} as Idl;
