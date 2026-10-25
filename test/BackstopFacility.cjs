const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
async function fixture() {
  const [originator, senior, junior1, junior2, fee, outsider] =
    await ethers.getSigners();
  const token = await (await ethers.getContractFactory("MockUSD")).deploy();
  const deadline = (await time.latest()) + 3600;
  const facility = await (
    await ethers.getContractFactory("BackstopFacility")
  ).deploy(
    await token.getAddress(),
    senior.address,
    8000000,
    800,
    500000,
    [
      { investor: junior1.address, principal: 1000000, rateBps: 1600 },
      { investor: junior2.address, principal: 500000, rateBps: 1850 },
    ],
    fee.address,
    50,
    deadline,
    ethers.id("accepted-deal"),
  );
  const participants = [
    [senior, 8000000],
    [junior1, 1000000],
    [junior2, 500000],
    [originator, 500000],
  ];
  async function fund() {
    for (const [signer, amount] of participants) {
      await token.mint(signer.address, amount);
      await token.connect(signer).approve(await facility.getAddress(), amount);
      await facility.connect(signer).commit();
    }
  }
  async function collect(amount) {
    if (amount > 0) {
      await token.mint(originator.address, amount);
      await token.approve(await facility.getAddress(), amount);
      await facility.recordCollection(amount);
    }
  }
  async function mature() {
    await time.increase(365 * 24 * 60 * 60 + 1);
  }
  return {
    originator,
    senior,
    junior1,
    junior2,
    fee,
    outsider,
    token,
    facility,
    deadline,
    participants,
    fund,
    collect,
    mature,
  };
}
describe("BACKSTOP funded facility", function () {
  it("registers immutable terms and funds exactly the target", async () => {
    const { facility, fund, token, originator } = await loadFixture(fixture);
    await fund();
    expect(await facility.totalFunded()).to.equal(10000000);
    await expect(facility.activate()).to.emit(facility, "Activated");
    expect(await token.balanceOf(originator.address)).to.equal(10000000);
    expect(await facility.state()).to.equal(1);
  });
  it("blocks underfunded activation, unknown and double commitments", async () => {
    const { facility, fund, outsider, senior } = await loadFixture(fixture);
    await expect(facility.activate()).to.be.revertedWith("Not fully funded");
    await expect(facility.connect(outsider).commit()).to.be.revertedWith(
      "Invalid or duplicate commitment",
    );
    await fund();
    await expect(facility.connect(senior).commit()).to.be.revertedWith(
      "Invalid or duplicate commitment",
    );
  });
  it("rejects activation, collection, and settlement by an unauthorized actor", async () => {
    const { facility, fund, outsider } = await loadFixture(fixture);
    await fund();
    await expect(facility.connect(outsider).activate()).to.be.revertedWith(
      "Unauthorized",
    );
    await facility.activate();
    await expect(
      facility.connect(outsider).recordCollection(1),
    ).to.be.revertedWith("Unauthorized");
    await expect(facility.connect(outsider).settle()).to.be.revertedWith(
      "Unauthorized",
    );
  });
  it("locks funded obligations and disallows early or repeated settlement", async () => {
    const { facility, fund, collect, mature, senior } =
      await loadFixture(fixture);
    await fund();
    await facility.activate();
    await expect(facility.connect(senior).refund()).to.be.revertedWith(
      "No refund",
    );
    await expect(facility.connect(senior).claim()).to.be.revertedWith(
      "Not settled",
    );
    await expect(facility.settle()).to.be.revertedWith("Not at maturity");
    await collect(10000000);
    await mature();
    await facility.settle();
    await expect(facility.settle()).to.be.revertedWith("Not at maturity");
    await expect(facility.recordCollection(1)).to.be.revertedWith(
      "Invalid collection",
    );
  });
  for (const collections of [
    0, 1, 7000000, 8500000, 9500001, 10000000, 11507500,
  ]) {
    it(`reconciles every token unit at ${collections} cash collections`, async () => {
      const {
        facility,
        fund,
        collect,
        mature,
        participants,
        fee,
        token,
        senior,
        junior1,
        junior2,
        originator,
      } = await loadFixture(fixture);
      await fund();
      await facility.activate();
      await collect(collections);
      await mature();
      await facility.settle();
      let cash = collections;
      const take = (n) => {
        const v = Math.min(cash, n);
        cash -= v;
        return v;
      };
      const expectedFee = take(Math.floor((collections * 50) / 10000));
      const si = take(640000);
      const sp = take(8000000);
      const jp = take(1500000);
      const ji = take(252500);
      const ret = take(500000);
      const residual = take(cash);
      expect(await facility.principalPaid(senior.address)).to.equal(sp);
      expect(await facility.interestPaid(senior.address)).to.equal(si);
      expect(await facility.principalPaid(junior1.address)).to.equal(
        Math.floor((jp * 2) / 3),
      );
      expect(await facility.principalPaid(junior2.address)).to.equal(
        jp - Math.floor((jp * 2) / 3),
      );
      expect(await facility.interestPaid(junior1.address)).to.equal(
        Math.floor((ji * 160000) / 252500),
      );
      expect(await facility.interestPaid(junior2.address)).to.equal(
        ji - Math.floor((ji * 160000) / 252500),
      );
      expect(await facility.principalPaid(originator.address)).to.equal(ret);
      expect(await facility.interestPaid(originator.address)).to.equal(
        residual,
      );
      expect(await facility.claimable(fee.address)).to.equal(expectedFee);
      let total = 0n;
      for (const signer of [...participants.map((p) => p[0]), fee]) {
        const claim = await facility.claimable(signer.address);
        total += claim;
        if (claim > 0n) {
          await facility.connect(signer).claim();
          await expect(facility.connect(signer).claim()).to.be.revertedWith(
            "No claim",
          );
        }
      }
      expect(total).to.equal(collections);
      expect(await token.balanceOf(await facility.getAddress())).to.equal(0);
    });
  }
  it("allows expiry cancellation and a single refund of committed capital", async () => {
    const { facility, senior, token, deadline } = await loadFixture(fixture);
    await token.mint(senior.address, 8000000);
    await token.connect(senior).approve(await facility.getAddress(), 8000000);
    await facility.connect(senior).commit();
    await time.increaseTo(deadline + 1);
    await expect(facility.connect(senior).commit()).to.be.revertedWith(
      "Funding closed",
    );
    await facility.cancelExpired();
    await facility.connect(senior).refund();
    expect(await token.balanceOf(senior.address)).to.equal(8000000);
    await expect(facility.connect(senior).refund()).to.be.revertedWith(
      "No refund",
    );
    await expect(facility.activate()).to.be.revertedWith("Not fully funded");
  });
  it("rejects duplicate participants and invalid pricing", async () => {
    const { token, senior, fee, deadline } = await loadFixture(fixture);
    const Factory = await ethers.getContractFactory("BackstopFacility");
    await expect(
      Factory.deploy(
        await token.getAddress(),
        senior.address,
        8000000,
        800,
        500000,
        [{ investor: senior.address, principal: 1500000, rateBps: 1600 }],
        fee.address,
        50,
        deadline,
        ethers.id("bad"),
      ),
    ).to.be.revertedWith("Duplicate participant");
    await expect(
      Factory.deploy(
        await token.getAddress(),
        senior.address,
        8000000,
        10001,
        500000,
        [],
        fee.address,
        50,
        deadline,
        ethers.id("bad"),
      ),
    ).to.be.revertedWith("Invalid terms");
  });
});
describe("zero coupon rounding", () => {
  it("assigns interest residue only to a junior investor with interest due", async () => {
    const { originator, senior, junior1, junior2, fee, token } =
      await loadFixture(fixture);
    const facility = await (
      await ethers.getContractFactory("BackstopFacility")
    ).deploy(
      await token.getAddress(),
      senior.address,
      8000000,
      800,
      500000,
      [
        { investor: junior1.address, principal: 1000000, rateBps: 1600 },
        { investor: junior2.address, principal: 500000, rateBps: 0 },
      ],
      fee.address,
      0,
      (await time.latest()) + 3600,
      ethers.id("zero-rate"),
    );
    for (const [s, a] of [
      [senior, 8000000],
      [junior1, 1000000],
      [junior2, 500000],
      [originator, 500000],
    ]) {
      await token.mint(s.address, a);
      await token.connect(s).approve(await facility.getAddress(), a);
      await facility.connect(s).commit();
    }
    await facility.activate();
    await token.mint(originator.address, 10140001);
    await token.approve(await facility.getAddress(), 10140001);
    await facility.recordCollection(10140001);
    await time.increase(365 * 24 * 60 * 60 + 1);
    await facility.settle();
    expect(await facility.interestPaid(junior1.address)).to.equal(1);
    expect(await facility.interestPaid(junior2.address)).to.equal(0);
  });
});
