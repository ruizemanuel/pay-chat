// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title  pay-chat PromptReceipt
/// @notice Emits a verifiable on-chain record for each paid LLM query processed
///         by the pay-chat backend. The x402 USDC transfer already settles the
///         payment; this contract layers in structured metadata (model, prompt
///         hash, timestamp) so receipts are auditable without inspecting the
///         entire transfer payload.
/// @dev    Only the `owner` (the thirdweb-managed server wallet) can log
///         receipts. Events are the product: there is no on-chain state to
///         query — consumers listen to `PromptPaid` via Celoscan or an indexer.
contract PromptReceipt is Ownable {
    event PromptPaid(
        address indexed user,
        string model,
        bytes32 indexed queryHash,
        uint256 timestamp
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Log a paid LLM query.
    /// @param  user       The wallet that paid for the query via x402.
    /// @param  model      Human-readable model identifier (e.g. "groq/llama-3.3-70b").
    /// @param  queryHash  keccak256 hash of the user's prompt — logged instead of the
    ///                    raw text so nothing private ends up on-chain.
    function logPrompt(
        address user,
        string calldata model,
        bytes32 queryHash
    ) external onlyOwner {
        emit PromptPaid(user, model, queryHash, block.timestamp);
    }
}
