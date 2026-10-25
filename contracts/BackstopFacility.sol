// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
/// @notice Standalone, annual bullet facility prototype. Cash collection is originator-reported.
/// It does not originate native XRPL loans or validate real-world loan performance.
contract BackstopFacility is ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum State { Funding, Active, Settled, Cancelled }
    struct Junior { address investor; uint256 principal; uint256 rateBps; }
    IERC20 public immutable token;
    address public immutable originator;
    address public immutable senior;
    address public immutable feeRecipient;
    uint256 public immutable seniorPrincipal;
    uint256 public immutable seniorRateBps;
    uint256 public immutable retainedPrincipal;
    uint256 public immutable feeBps;
    uint256 public immutable target;
    uint256 public immutable fundingDeadline;
    bytes32 public immutable termsHash;
    uint256 public maturity;
    uint256 public totalFunded;
    uint256 public totalCollections;
    State public state;
    Junior[] public juniors;
    mapping(address => uint256) public allocation;
    mapping(address => bool) public funded;
    mapping(address => uint256) public claimable;
    mapping(address => uint256) public principalPaid;
    mapping(address => uint256) public interestPaid;
    event TermsRegistered(bytes32 indexed termsHash, uint256 target);
    event CapitalCommitted(address indexed investor, uint256 amount);
    event Activated(uint256 principal, uint256 maturity);
    event CollectionRecorded(uint256 amount, uint256 total);
    event DistributionAllocated(address indexed investor, uint256 principal, uint256 interest);
    event Settled(uint256 collections, uint256 fee);
    event Claimed(address indexed investor, uint256 amount);
    event Cancelled();
    event Refunded(address indexed investor, uint256 amount);
    modifier onlyOriginator() { require(msg.sender == originator, 'Unauthorized'); _; }
    constructor(address token_, address senior_, uint256 seniorAmount_, uint256 seniorRate_, uint256 retained_, Junior[] memory juniors_, address feeRecipient_, uint256 feeBps_, uint256 deadline_, bytes32 termsHash_) {
        require(token_.code.length > 0 && senior_ != address(0) && feeRecipient_ != address(0), 'Invalid address');
        require(senior_ != msg.sender && feeRecipient_ != msg.sender && feeRecipient_ != senior_, 'Duplicate participant');
        require(seniorAmount_ > 0 && retained_ > 0 && seniorRate_ <= 10000 && feeBps_ <= 1000, 'Invalid terms');
        require(deadline_ > block.timestamp && juniors_.length <= 10, 'Invalid deadline or count');
        token = IERC20(token_); originator = msg.sender; senior = senior_; feeRecipient = feeRecipient_;
        seniorPrincipal = seniorAmount_; seniorRateBps = seniorRate_; retainedPrincipal = retained_; feeBps = feeBps_;
        fundingDeadline = deadline_; termsHash = termsHash_;
        allocation[senior_] = seniorAmount_; allocation[msg.sender] = retained_;
        uint256 total = seniorAmount_ + retained_;
        for (uint256 i; i < juniors_.length; i++) {
            Junior memory j = juniors_[i];
            require(j.investor != address(0) && j.investor != feeRecipient_ && allocation[j.investor] == 0, 'Duplicate participant');
            require(j.principal > 0 && j.rateBps <= 10000, 'Invalid junior');
            juniors.push(j); allocation[j.investor] = j.principal; total += j.principal;
        }
        target = total;
        emit TermsRegistered(termsHash_, total);
    }
    function commit() external nonReentrant {
        require(state == State.Funding && block.timestamp <= fundingDeadline, 'Funding closed');
        uint256 amount = allocation[msg.sender];
        require(amount > 0 && !funded[msg.sender], 'Invalid or duplicate commitment');
        funded[msg.sender] = true; totalFunded += amount;
        _receive(amount);
        emit CapitalCommitted(msg.sender, amount);
    }
    function activate() external onlyOriginator nonReentrant {
        require(state == State.Funding && totalFunded == target && block.timestamp <= fundingDeadline, 'Not fully funded');
        state = State.Active; maturity = block.timestamp + 365 days;
        token.safeTransfer(originator, target);
        emit Activated(target, maturity);
    }
    function recordCollection(uint256 amount) external onlyOriginator nonReentrant {
        require(state == State.Active && amount > 0, 'Invalid collection');
        totalCollections += amount; _receive(amount);
        emit CollectionRecorded(amount, totalCollections);
    }
    function settle() external onlyOriginator nonReentrant {
        require(state == State.Active && block.timestamp >= maturity, 'Not at maturity');
        state = State.Settled;
        uint256 cash = totalCollections;
        uint256 fee = cash * feeBps / 10000; cash -= fee;
        claimable[feeRecipient] = fee;
        uint256 si = _min(cash, seniorPrincipal * seniorRateBps / 10000); cash -= si;
        uint256 sp = _min(cash, seniorPrincipal); cash -= sp;
        _assign(senior, sp, si);
        uint256 jp; uint256 ji; uint256 lastInterestIndex;
        for (uint256 i; i < juniors.length; i++) { jp += juniors[i].principal; uint256 dueInterest = juniors[i].principal * juniors[i].rateBps / 10000; ji += dueInterest; if (dueInterest > 0) lastInterestIndex = i; }
        uint256 poolP = _min(cash, jp); cash -= poolP;
        uint256 poolI = _min(cash, ji); cash -= poolI;
        uint256 assignedP; uint256 assignedI;
        for (uint256 i; i < juniors.length; i++) {
            Junior memory j = juniors[i];
            uint256 paidP = i == juniors.length - 1 ? poolP - assignedP : poolP * j.principal / jp;
            uint256 due = j.principal * j.rateBps / 10000;
            uint256 paidI = ji == 0 ? 0 : i == lastInterestIndex ? poolI - assignedI : poolI * due / ji;
            assignedP += paidP; assignedI += paidI; _assign(j.investor, paidP, paidI);
        }
        uint256 retained = _min(cash, retainedPrincipal); cash -= retained;
        _assign(originator, retained, cash);
        emit Settled(totalCollections, fee);
    }
    function claim() external nonReentrant {
        require(state == State.Settled, 'Not settled');
        uint256 amount = claimable[msg.sender]; require(amount > 0, 'No claim');
        claimable[msg.sender] = 0; token.safeTransfer(msg.sender, amount); emit Claimed(msg.sender, amount);
    }
    function cancelExpired() external {
        require(state == State.Funding && block.timestamp > fundingDeadline, 'Not expired');
        state = State.Cancelled; emit Cancelled();
    }
    function refund() external nonReentrant {
        require(state == State.Cancelled && funded[msg.sender], 'No refund');
        funded[msg.sender] = false; uint256 amount = allocation[msg.sender]; totalFunded -= amount;
        token.safeTransfer(msg.sender, amount); emit Refunded(msg.sender, amount);
    }
    function _receive(uint256 amount) internal { uint256 beforeBalance = token.balanceOf(address(this)); token.safeTransferFrom(msg.sender, address(this), amount); require(token.balanceOf(address(this)) == beforeBalance + amount, 'Unsupported token behavior'); }
    function _assign(address investor, uint256 principal, uint256 interest) internal { principalPaid[investor] = principal; interestPaid[investor] = interest; claimable[investor] = principal + interest; emit DistributionAllocated(investor, principal, interest); }
    function _min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
}
