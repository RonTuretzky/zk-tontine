import { createConfig, http } from "wagmi"
import { gnosis } from "wagmi/chains"
import { injected } from "wagmi/connectors"
import { announceDemoWallet, demoWalletEnabled } from "./demoWallet"

// With ?wallet=demo a built-in burner wallet announces itself via EIP-6963
// (used for the guide recordings) and shows up in the connect modal beside
// any installed wallets. Announce BEFORE createConfig so wagmi's multi-
// injected discovery picks it up.
if (typeof window !== "undefined" && demoWalletEnabled()) {
  announceDemoWallet()
}

export const wagmiConfig = createConfig({
  chains: [gnosis],
  connectors: [injected()],
  transports: {
    [gnosis.id]: http("https://rpc.gnosischain.com"),
  },
})
