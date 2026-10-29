// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentEscrow
 * @notice Autonomous Agent-to-Agent (A2A) Settlement & Micropayment Escrow on HSK Chain
 * @dev Optimized for AI agent networks executing tasks, verifying invariants, and settling programmatic payments.
 */
contract AgentEscrow {
    enum EscrowStatus { None, Active, Settled, Refunded, Disputed }

    struct TaskEscrow {
        address initiator;
        address worker;
        uint256 amount;
        bytes32 taskSpecHash;
        uint256 deadline;
        EscrowStatus status;
    }

    struct MicropayChannel {
        address sender;
        address receiver;
        uint256 totalDeposit;
        uint256 settledAmount;
        uint256 expiration;
        bool isOpen;
    }

    // Mapping from taskId to TaskEscrow
    mapping(bytes32 => TaskEscrow) public escrows;

    // Mapping from channelId to MicropayChannel
    mapping(bytes32 => MicropayChannel) public channels;

    // Events
    event EscrowCreated(
        bytes32 indexed taskId,
        address indexed initiator,
        address indexed worker,
        uint256 amount,
        bytes32 taskSpecHash,
        uint256 deadline
    );

    event EscrowSettled(
        bytes32 indexed taskId,
        address indexed worker,
        uint256 amount,
        bytes32 proofHash
    );

    event EscrowRefunded(
        bytes32 indexed taskId,
        address indexed initiator,
        uint256 amount
    );

    event ChannelOpened(
        bytes32 indexed channelId,
        address indexed sender,
        address indexed receiver,
        uint256 deposit,
        uint256 expiration
    );

    event ChannelClaimed(
        bytes32 indexed channelId,
        address indexed receiver,
        uint256 amountClaimed
    );

    event ChannelClosed(
        bytes32 indexed channelId,
        uint256 remainingRefund
    );

    // Errors
    error EscrowAlreadyExists();
    error EscrowNotFound();
    error EscrowNotActive();
    error InvalidWorker();
    error InvalidAmount();
    error DeadlineNotPassed();
    error DeadlineExceeded();
    error InvalidSignature();
    error ChannelNotActive();
    error ExpirationNotReached();
    error TransferFailed();

    /**
     * @notice Initiator agent locks native HSK funds for a specific autonomous task.
     */
    function createEscrow(
        bytes32 taskId,
        address worker,
        bytes32 taskSpecHash,
        uint256 durationSeconds
    ) external payable {
        if (msg.value == 0) revert InvalidAmount();
        if (worker == address(0)) revert InvalidWorker();
        if (escrows[taskId].status != EscrowStatus.None) revert EscrowAlreadyExists();

        uint256 deadline = block.timestamp + durationSeconds;

        escrows[taskId] = TaskEscrow({
            initiator: msg.sender,
            worker: worker,
            amount: msg.value,
            taskSpecHash: taskSpecHash,
            deadline: deadline,
            status: EscrowStatus.Active
        });

        emit EscrowCreated(taskId, msg.sender, worker, msg.value, taskSpecHash, deadline);
    }

    /**
     * @notice Settles escrow upon cryptographic verification of task execution proof.
     * @param taskId Unique identifier of the task.
     * @param proofHash Hash of the execution artifact / test result.
     * @param signature Signature of the initiator (or verified guardrail agent) authorizing release.
     */
    function settleEscrow(
        bytes32 taskId,
        bytes32 proofHash,
        bytes calldata signature
    ) external {
        TaskEscrow storage escrow = escrows[taskId];
        if (escrow.status != EscrowStatus.Active) revert EscrowNotActive();
        if (block.timestamp > escrow.deadline) revert DeadlineExceeded();

        // Verify signature: message is keccak256(taskId, proofHash, address(this))
        bytes32 messageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(taskId, proofHash, address(this))))
        );
        address recoveredSigner = recoverSigner(messageHash, signature);

        // Signer must be the initiator or worker with initiator authorization
        if (recoveredSigner != escrow.initiator) revert InvalidSignature();

        escrow.status = EscrowStatus.Settled;
        uint256 payout = escrow.amount;

        (bool success, ) = escrow.worker.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit EscrowSettled(taskId, escrow.worker, payout, proofHash);
    }

    /**
     * @notice Initiator refunds escrow if deadline passed without valid execution.
     */
    function refundEscrow(bytes32 taskId) external {
        TaskEscrow storage escrow = escrows[taskId];
        if (escrow.status != EscrowStatus.Active) revert EscrowNotActive();
        if (block.timestamp <= escrow.deadline) revert DeadlineNotPassed();
        if (msg.sender != escrow.initiator) revert InvalidSignature();

        escrow.status = EscrowStatus.Refunded;
        uint256 refundAmount = escrow.amount;

        (bool success, ) = escrow.initiator.call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit EscrowRefunded(taskId, escrow.initiator, refundAmount);
    }

    /**
     * @notice Opens a streaming micropayment channel for high-frequency A2A interactions (per-token/per-call).
     */
    function openChannel(
        bytes32 channelId,
        address receiver,
        uint256 durationSeconds
    ) external payable {
        if (msg.value == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidWorker();
        if (channels[channelId].isOpen) revert EscrowAlreadyExists();

        uint256 expiration = block.timestamp + durationSeconds;

        channels[channelId] = MicropayChannel({
            sender: msg.sender,
            receiver: receiver,
            totalDeposit: msg.value,
            settledAmount: 0,
            expiration: expiration,
            isOpen: true
        });

        emit ChannelOpened(channelId, msg.sender, receiver, msg.value, expiration);
    }

    /**
     * @notice Receiver claims cumulative micropayments using an off-chain signed balance ticket.
     */
    function claimMicropayment(
        bytes32 channelId,
        uint256 cumulativeAmount,
        bytes calldata signature
    ) external {
        MicropayChannel storage channel = channels[channelId];
        if (!channel.isOpen) revert ChannelNotActive();
        if (msg.sender != channel.receiver) revert InvalidWorker();
        if (cumulativeAmount > channel.totalDeposit) revert InvalidAmount();
        if (cumulativeAmount <= channel.settledAmount) revert InvalidAmount();

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(channelId, cumulativeAmount, address(this)))
            )
        );
        address recoveredSigner = recoverSigner(messageHash, signature);
        if (recoveredSigner != channel.sender) revert InvalidSignature();

        uint256 paymentDelta = cumulativeAmount - channel.settledAmount;
        channel.settledAmount = cumulativeAmount;

        (bool success, ) = channel.receiver.call{value: paymentDelta}("");
        if (!success) revert TransferFailed();

        emit ChannelClaimed(channelId, channel.receiver, paymentDelta);
    }

    /**
     * @notice Closes channel after expiration, refunding unspent balance to sender.
     */
    function closeChannel(bytes32 channelId) external {
        MicropayChannel storage channel = channels[channelId];
        if (!channel.isOpen) revert ChannelNotActive();
        if (block.timestamp < channel.expiration && msg.sender != channel.receiver) {
            revert ExpirationNotReached();
        }

        channel.isOpen = false;
        uint256 remaining = channel.totalDeposit - channel.settledAmount;

        if (remaining > 0) {
            (bool success, ) = channel.sender.call{value: remaining}("");
            if (!success) revert TransferFailed();
        }

        emit ChannelClosed(channelId, remaining);
    }

    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        return ecrecover(hash, v, r, s);
    }
}
