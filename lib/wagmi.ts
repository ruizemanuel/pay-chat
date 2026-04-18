import { createConfig, http } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected()],
  ssr: true,
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
