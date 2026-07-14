import { createConfig, http } from "wagmi"
import { gnosis } from "wagmi/chains"
import { injected } from "wagmi/connectors"
import { demoWalletEnabled, makeDemoProvider } from "./demoWallet"

// Injected-only connector — no WalletConnect project id required (the same
// minimal setup the Bread kit's own Storybook uses). With ?wallet=demo a
// built-in burner wallet appears too (used for the guide recordings).
const connectors = [injected()]

if (typeof window !== "undefined" && demoWalletEnabled()) {
  connectors.push(
    injected({
      target: {
        id: "longBreadDemo",
        name: "Demo wallet (burner)",
        provider: makeDemoProvider() as never,
      },
    }),
  )
}

export const wagmiConfig = createConfig({
  chains: [gnosis],
  connectors,
  transports: {
    [gnosis.id]: http("https://rpc.gnosischain.com"),
  },
})
