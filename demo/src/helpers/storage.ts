/**
 * Small wrapper around the Storage.sol ABI so we can deploy and use it as a
 * PentePrivateContract without repeating boilerplate.
 */
import PaladinClient, {
  PaladinVerifier,
  PentePrivacyGroup,
  PentePrivateContract,
} from "@lfdecentralizedtrust/paladin-sdk";
import storage from "../abis/Storage.json";

// First-time Pente EVM warm-up on a fresh cluster can take up to a minute.
// Keep this comfortably above the observed cold-start time.
const LONG_TIMEOUT = 120_000;

export const newPrivateStorage = async (
  pente: PentePrivacyGroup,
  from: PaladinVerifier,
  deployerClient?: PaladinClient,
) => {
  const groupOnDeployer = deployerClient ? pente.using(deployerClient) : pente;
  const address = await groupOnDeployer
    .deploy({
      abi: storage.abi,
      bytecode: storage.bytecode,
      from: from.lookup,
    })
    .waitForDeploy(LONG_TIMEOUT);
  return address ? new PrivateStorage(pente, address) : undefined;
};

export class PrivateStorage extends PentePrivateContract<{}> {
  constructor(
    protected evm: PentePrivacyGroup,
    public readonly address: string,
  ) {
    super(evm, storage.abi, address);
  }

  using(paladin: PaladinClient) {
    return new PrivateStorage(this.evm.using(paladin), this.address);
  }
}
