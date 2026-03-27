// Deploys the FairPayEscrow factory contract.
// No constructor arguments — the single contract manages all escrows.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FairPayEscrowModule = buildModule("FairPayEscrowModule", (m) => {
  const fairPayEscrow = m.contract("FairPayEscrow");

  return { fairPayEscrow };
});

export default FairPayEscrowModule;
